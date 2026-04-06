import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import multer from 'multer';
import mongoose from 'mongoose';
import NodeCache from 'node-cache';
import { createServer } from 'http';
import { initializeWebSocket, broadcastUpdate } from './websocket.js';
import dotenv from 'dotenv'; // Load environment variables from .env file
import crypto from 'crypto';
import nodemailer from 'nodemailer';

// Load environment variables from .env file (if it exists)
dotenv.config();

/**
 * DUPLICATE DELIVERY REQUEST PREVENTION SYSTEM
 * 
 * This system implements multiple layers of protection against duplicate delivery requests:
 * 
 * 1. DATABASE LEVEL: Unique compound index on (customerId, status) for active requests
 * 2. APPLICATION LEVEL: Server-side validation checking existing active requests
 * 3. RATE LIMITING: In-memory rate limiting (1 request per customer per 5 seconds)
 * 4. CLIENT LEVEL: Frontend cooldown tracking and visual indicators
 * 
 * This prevents the scenario where rapid submissions during the 2-3 second creation delay
 * could result in duplicate requests for the same customer.
 */

const app = express();
const PORT = process.env.PORT || 4000;

// PHASE 3: Create HTTP server for WebSocket integration
const server = createServer(app);

// PHASE 1 OPTIMIZATION: Response caching with 5 second TTL
const cache = new NodeCache({ stdTTL: 5, checkperiod: 6 });

app.use(cors());
app.use(bodyParser.json());

// MongoDB connection - Use local database for testing, production URI for deployment
// For local testing: mongodb://localhost:27017/PAANI (default)
// For production: Set MONGO_URI environment variable with your MongoDB Atlas URI
// Or create backend/.env file with: MONGO_URI=your_connection_string
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/PAANI';

const isLocalDB = MONGO_URI.includes('localhost') || MONGO_URI.includes('127.0.0.1') || !MONGO_URI.includes('mongodb+srv://');

console.log(`🔗 Connecting to MongoDB: ${isLocalDB ? 'LOCAL DATABASE (for testing)' : 'PRODUCTION DATABASE (MongoDB Atlas)'}`);
console.log('🔗 MongoDB URI:', MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'));

// Connection options - SSL only for remote MongoDB (Atlas), not for local
const connectionOptions = {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
};

// Only use SSL for remote MongoDB (MongoDB Atlas), not for local
if (!isLocalDB) {
  connectionOptions.ssl = true;
}

mongoose.connect(MONGO_URI, connectionOptions)
  .then(() => {
    console.log(`✅ Connected to MongoDB ${isLocalDB ? '(Local)' : '(Atlas)'} successfully`);
    console.log('Database name:', mongoose.connection.db.databaseName);
    // Create indexes after connection is established
    createIndexes();
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });

const db = mongoose.connection;
db.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});
db.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

// Counter collection for auto-incrementing integers
const counterSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.model('Counter', counterSchema);

// Customers
const customerSchema = new mongoose.Schema({
  id: { type: Number, unique: true, index: true, required: true }, // integer primary key
  name: { type: String, required: true },
  phone: { type: String, default: '' },
  address: { type: String, required: true },
  defaultCans: { type: Number, default: 1 },
  pricePerCan: { type: Number, required: true, min: 0, max: 999 },
  notes: { type: String, default: '' },
  paymentType: { type: String, enum: ['cash','account'], default: 'cash' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Customer = mongoose.model('Customer', customerSchema);

// Customer Credentials for dashboard access
const customerCredentialSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // Will be hashed
  hasDashboardAccess: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const CustomerCredential = mongoose.model('CustomerCredential', customerCredentialSchema);

// Price change notifications
const notificationSchema = new mongoose.Schema({
  type: { type: String, enum: ['price_change'], required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  customerIntId: { type: Number },
  customerName: { type: String, required: true },
  data: {
    oldPrice: { type: Number, required: true },
    newPrice: { type: Number, required: true },
  },
  isRead: { type: Boolean, default: false },
  isReadByAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});
const Notification = mongoose.model('Notification', notificationSchema);

// Delivery requests
const deliveryRequestSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  customerIntId: { type: Number, index: true },
  customerName: { type: String, required: true },
  address: { type: String, required: true },
  cans: { type: Number, required: true },
  orderDetails: { type: String, default: '' },
  priority: { type: String, enum: ['normal', 'urgent'], default: 'normal' },
  status: { type: String, enum: ['pending', 'pending_confirmation', 'processing', 'delivered', 'cancelled'], default: 'pending' },
  requestedAt: { type: Date, default: Date.now },
  scheduledFor: { type: Date },
  deliveredAt: { type: Date },
  completedAt: { type: Date },
  cancelledAt: { type: Date },
  cancelledBy: { type: String, enum: ['admin', 'staff', 'customer', 'system'] },
  cancellationReason: { type: String, enum: ['door_closed', 'duplicate', 'other', 'not_needed_today', 'ordered_by_mistake', 'system_problem', 'area_not_reachable', 'bad_weather', 'no_stock_available'] },
  cancellationNotes: { type: String },
  createdBy: { type: String, default: '' },
  internalNotes: { type: String, default: '' },
  pricePerCan: { type: Number },
  paymentType: { type: String, enum: ['cash', 'account'] },
});

const DeliveryRequest = mongoose.model('DeliveryRequest', deliveryRequestSchema);

// Create unique compound index to prevent duplicate delivery requests for the same customer
// This ensures only one active request per customer at a time
try {
  DeliveryRequest.collection.createIndex(
    { 
      customerId: 1, 
      status: 1 
    }, 
    { 
      unique: true,
      partialFilterExpression: { 
        status: { $in: ['pending', 'pending_confirmation', 'processing'] } 
      },
      name: 'unique_active_customer_request'
    }
  ).catch(() => {});
} catch {}

// Recurring requests
const recurringRequestSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  customerIntId: { type: Number, index: true },
  customerName: { type: String, required: true },
  address: { type: String, required: true },
  type: { type: String, enum: ['daily', 'weekly', 'one_time', 'alternating_days'], required: true },
  cans: { type: Number, required: true },
  days: { type: [Number], default: [] }, // 0-6 Sun-Sat
  date: { type: String, default: '' }, // ISO date string for one-time (yyyy-mm-dd)
  time: { type: String, default: '09:00' }, // HH:mm
  nextRun: { type: Date },
  priority: { type: String, enum: ['normal', 'urgent'], default: 'normal' },
  lastTriggeredAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
const RecurringRequest = mongoose.model('RecurringRequest', recurringRequestSchema);

// PHASE 1 OPTIMIZATION: Create indexes for optimal query performance
async function createIndexes() {
  try {
    // Delivery Request indexes - critical for dashboard metrics
    // Note: { customerId: 1, status: 1 } unique compound index already created above (line 123-136)
    // for duplicate prevention - don't recreate it here
    await DeliveryRequest.collection.createIndex({ status: 1 }, { background: true });
    await DeliveryRequest.collection.createIndex({ status: 1, deliveredAt: 1 }, { background: true });
    await DeliveryRequest.collection.createIndex({ status: 1, completedAt: 1 }, { background: true });
    await DeliveryRequest.collection.createIndex({ status: 1, priority: 1 }, { background: true });
    // { customerId: 1, status: 1 } - SKIPPED: Already exists as unique index (line 123-136)
    await DeliveryRequest.collection.createIndex({ deliveredAt: 1 }, { background: true });
    await DeliveryRequest.collection.createIndex({ completedAt: 1 }, { background: true });
    await DeliveryRequest.collection.createIndex({ requestedAt: -1 }, { background: true });
    
    // Customer indexes
    await Customer.collection.createIndex({ name: 'text', address: 'text' }, { background: true });
    await Customer.collection.createIndex({ pricePerCan: 1 }, { background: true });
    await Customer.collection.createIndex({ paymentType: 1 }, { background: true });
    await Customer.collection.createIndex({ id: -1 }, { background: true });
    
    // Recurring Request indexes
    // Note: customerIntId index already exists in schema (line 141)
    await RecurringRequest.collection.createIndex({ nextRun: 1 }, { background: true });
    await RecurringRequest.collection.createIndex({ customerId: 1 }, { background: true });
    
    console.log('✅ Database indexes created successfully');
  } catch (error) {
    // Index creation errors are non-critical, log but don't fail
    console.error('Error creating indexes (non-critical):', error.message);
  }
}

// File upload setup
const upload = multer({ dest: 'uploads/' });

// Root route handler - API documentation
app.get('/', (req, res) => {
  res.json({
    message: 'Paani Delivery System Backend API',
    version: '1.0.0',
    status: 'Running',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    endpoints: {
      health: '/api/health',
      customers: '/api/customers',
      deliveryRequests: '/api/delivery-requests',
      recurringRequests: '/api/recurring-requests',
      dashboardMetrics: '/api/dashboard/metrics',
      testCustomer: '/api/test-customer (POST)',
      auth: {
        login: '/api/auth/login (POST)',
        register: '/api/auth/register (POST)'
      },
      notifications: '/api/notifications',
      upload: '/api/upload (POST)'
    },
    documentation: 'Visit /api/health for system status'
  });
});

// Auth endpoints
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  // This part of the code was not provided in the original file,
  // so it's kept as is, but it will likely cause an error
  // as 'users' and 'uuidv4' are not defined.
  // Assuming 'users' is a global or defined elsewhere if this endpoint is meant to be functional.
  // For now, it's commented out to avoid immediate errors.
  // const user = users.find(u => u.email === email && u.password === password);
  // if (user) {
  //   res.json({ success: true, user: { id: user.id, email: user.email, role: user.role, verified: user.verified } });
  // } else {
  //   res.status(401).json({ success: false, message: 'Invalid credentials' });
  // }
  res.status(501).json({ message: 'Authentication endpoint not implemented' }); // Placeholder
});

app.post('/api/auth/register', (req, res) => {
  const { email, password, role } = req.body;
  // This part of the code was not provided in the original file,
  // so it's kept as is, but it will likely cause an error
  // as 'users' and 'uuidv4' are not defined.
  // Assuming 'users' is a global or defined elsewhere if this endpoint is meant to be functional.
  // For now, it's commented out to avoid immediate errors.
  // if (users.find(u => u.email === email)) {
  //   return res.status(400).json({ success: false, message: 'Email already exists' });
  // }
  // const newUser = { id: uuidv4(), email, password, role: role || 'admin', verified: false };
  // users.push(newUser);
  // res.json({ success: true, user: { id: newUser.id, email: newUser.email, role: newUser.role, verified: newUser.verified } });
  res.status(501).json({ message: 'Registration endpoint not implemented' }); // Placeholder
});

// Customers endpoints
// PHASE 4: Customers endpoint with pagination and filtering
app.get('/api/customers', async (req, res) => {
  try {
    // PHASE 4: Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    // PHASE 4: Filtering parameters
    const {
      search,
      minPrice,
      maxPrice,
      paymentType,
      sortBy = 'id',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};
    
    // Search filter (name, phone, address, or numeric ID)
    if (search) {
      const trimmedSearch = search.trim();
      // If search is purely numeric, search by customer ID (integer field)
      if (/^\d+$/.test(trimmedSearch)) {
        const numericId = parseInt(trimmedSearch, 10);
        query.id = numericId;
      } else {
        // Non-numeric search: search in customer name, address, phone
        query.$or = [
          { name: { $regex: trimmedSearch, $options: 'i' } },
          { phone: { $regex: trimmedSearch, $options: 'i' } },
          { address: { $regex: trimmedSearch, $options: 'i' } }
        ];
      }
    }
    
    // Price filter
    if (minPrice || maxPrice) {
      query.pricePerCan = {};
      if (minPrice) query.pricePerCan.$gte = Number(minPrice);
      if (maxPrice) query.pricePerCan.$lte = Number(maxPrice);
    }
    
    // Payment type filter
    if (paymentType) {
      query.paymentType = paymentType;
    }

    // PHASE 4: Fetch with pagination
    const limitNum = Number(limit);
    console.log(`👥 Customers - Page: ${page}, Limit: ${limitNum}, Skip: ${skip}`);
    const [customers, total] = await Promise.all([
      Customer.find(query)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Customer.countDocuments(query)
    ]);

    console.log(`👥 Fetched ${customers.length} customers (requested limit: ${limitNum}, page ${page} of ${Math.ceil(total / limitNum)})`);
    
    // PHASE 4: Return paginated response
    res.json({
      data: customers,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (err) {
    console.error('Error fetching customers:', err);
    res.status(500).json({ error: 'Failed to fetch customers', details: err.message });
  }
});

app.post('/api/customers', async (req, res) => {
  try {
    console.log('=== CREATING NEW CUSTOMER ===');
    // Validate required
    if (!req.body.name || !req.body.address) {
      return res.status(400).json({ error: 'Missing required fields', details: 'Name and address are required' });
    }
    // Validate price
    const pricePerCan = Number(req.body.pricePerCan);
    if (req.body.pricePerCan === undefined || req.body.pricePerCan === null || isNaN(pricePerCan) || pricePerCan < 0 || pricePerCan > 999) {
      return res.status(400).json({ error: 'Invalid price per can', details: 'Price per can is required and must be between 0 and 999' });
    }

    // Generate next integer id atomically
    const counter = await Counter.findOneAndUpdate(
      { key: 'customers' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const nextId = counter.seq;

    const customerData = {
      id: nextId,
      name: req.body.name.trim(),
      phone: req.body.phone || '',
      address: req.body.address.trim(),
      defaultCans: Number(req.body.defaultCans) || 1,
      pricePerCan,
      notes: req.body.notes || '',
      paymentType: req.body.paymentType === 'account' ? 'account' : 'cash',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const customer = new Customer(customerData);
    const savedCustomer = await customer.save();
    res.status(201).json(savedCustomer);
  } catch (err) {
    console.error('=== ERROR CREATING CUSTOMER ===');
    console.error('Error details:', err);
    res.status(400).json({ error: 'Failed to add customer', details: err.message });
  }
});

app.put('/api/customers/:id', async (req, res) => {
  try {
    console.log(`Updating customer ${req.params.id}:`, req.body);
    
    // Validate required fields if they are provided
    if (req.body.name && !req.body.name.trim()) {
      return res.status(400).json({ 
        error: 'Invalid name', 
        details: 'Customer name cannot be empty' 
      });
    }
    
    if (req.body.address && !req.body.address.trim()) {
      return res.status(400).json({ 
        error: 'Invalid address', 
        details: 'Address cannot be empty' 
      });
    }

    // Validate pricePerCan if provided
    if (req.body.pricePerCan !== undefined) {
      const pricePerCan = Number(req.body.pricePerCan);
      if (isNaN(pricePerCan) || pricePerCan < 0 || pricePerCan > 999) {
        return res.status(400).json({
          error: 'Invalid price per can',
          details: 'Price per can must be between 0 and 999'
        });
      }
      req.body.pricePerCan = pricePerCan;
    }

    // Fetch existing customer before update to detect price change
    const existingCustomer = await Customer.findById(req.params.id);
    if (!existingCustomer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Detect price change and create notification
    if (
      req.body.pricePerCan !== undefined &&
      Number(req.body.pricePerCan) !== existingCustomer.pricePerCan
    ) {
      const oldPrice = existingCustomer.pricePerCan;
      const newPrice = Number(req.body.pricePerCan);
      try {
        const notification = new Notification({
          type: 'price_change',
          customerId: existingCustomer._id,
          customerIntId: existingCustomer.id,
          customerName: existingCustomer.name,
          data: { oldPrice, newPrice },
        });
        await notification.save();
        broadcastUpdate('priceChange', {
          type: 'price_change',
          notificationId: String(notification._id),
          customerId: String(existingCustomer._id),
          customerIntId: existingCustomer.id,
          customerName: existingCustomer.name,
          oldPrice,
          newPrice,
          createdAt: notification.createdAt,
        });
        console.log(`💰 Price change notification created for ${existingCustomer.name}: Rs.${oldPrice} → Rs.${newPrice}`);
      } catch (notifErr) {
        console.error('Error creating price change notification:', notifErr);
        // Non-critical — don't fail the customer update
      }
    }

    console.log('Customer updated successfully:', customer);
    res.json(customer);
  } catch (err) {
    console.error('Error updating customer:', err);
    res.status(400).json({ error: 'Failed to update customer', details: err.message });
  }
});

// Recurring Requests endpoints
const computeNextRun = (payload) => {
  try {
    const now = new Date();
    const [hours, minutes] = String(payload.time || '09:00').split(':').map(s => parseInt(s || '0', 10));
    if (payload.type === 'one_time' && payload.date) {
      // Parse yyyy-mm-dd as local date to avoid timezone shifts
      const parts = String(payload.date).split('-').map(x => parseInt(x, 10));
      const year = parts[0];
      const monthZeroBased = (parts[1] || 1) - 1;
      const day = parts[2] || 1;
      return new Date(year, monthZeroBased, day, hours, minutes, 0, 0);
    }
    if (payload.type === 'daily') {
      const d = new Date();
      d.setHours(hours, minutes, 0, 0);
      if (d <= now) d.setDate(d.getDate() + 1);
      return d;
    }
    if (payload.type === 'alternating_days') {
      const d = new Date();
      d.setHours(hours, minutes, 0, 0);
      if (d <= now) d.setDate(d.getDate() + 2); // Every other day
      return d;
    }
    // weekly
    const days = Array.isArray(payload.days) ? [...payload.days].sort() : [];
    if (days.length === 0) {
      const d = new Date();
      d.setHours(hours, minutes, 0, 0);
      if (d <= now) d.setDate(d.getDate() + 7);
      return d;
    }
    const today = now.getDay();
    for (let i = 0; i < 7; i++) {
      const candidate = new Date();
      candidate.setDate(now.getDate() + i);
      const dow = (today + i) % 7;
      if (days.includes(dow)) {
        candidate.setHours(hours, minutes, 0, 0);
        if (candidate > now) return candidate;
      }
    }
    const fallback = new Date();
    fallback.setDate(now.getDate() + 7);
    fallback.setHours(hours, minutes, 0, 0);
    return fallback;
  } catch {
    return new Date(Date.now() + 60 * 60 * 1000); // +1h as safe fallback
  }
};

// Business/local timezone handling
const BUSINESS_TZ_OFFSET_MINUTES = Number(process.env.BUSINESS_TZ_OFFSET_MINUTES || '300'); // default +05:00

// Compute next run interpreting payload.time as local business time (offset minutes from UTC)
const computeNextRunWithOffset = (payload, baseNow = new Date()) => {
  try {
    const offsetMs = BUSINESS_TZ_OFFSET_MINUTES * 60 * 1000;
    const nowUtc = baseNow;
    const nowLocal = new Date(nowUtc.getTime() + offsetMs);
    const [h, m] = String(payload.time || '09:00').split(':').map(n => parseInt(n || '0', 10));
    if (payload.type === 'one_time' && payload.date) {
      const parts = String(payload.date).split('-').map(x => parseInt(x, 10));
      const local = new Date(parts[0], (parts[1] || 1) - 1, (parts[2] || 1), h, m, 0, 0);
      return new Date(local.getTime() - offsetMs);
    }
    if (payload.type === 'daily') {
      const local = new Date(nowLocal);
      local.setHours(h, m, 0, 0);
      if (local <= nowLocal) local.setDate(local.getDate() + 1);
      return new Date(local.getTime() - offsetMs);
    }
    if (payload.type === 'alternating_days') {
      const local = new Date(nowLocal);
      local.setHours(h, m, 0, 0);
      if (local <= nowLocal) local.setDate(local.getDate() + 2); // Every other day
      return new Date(local.getTime() - offsetMs);
    }
    // weekly
    const days = Array.isArray(payload.days) ? payload.days.slice().sort() : [];
    if (days.length === 0) {
      const local = new Date(nowLocal);
      local.setHours(h, m, 0, 0);
      if (local <= nowLocal) local.setDate(local.getDate() + 7);
      return new Date(local.getTime() - offsetMs);
    }
    const today = nowLocal.getDay();
    for (let i = 0; i < 7; i++) {
      const cand = new Date(nowLocal);
      cand.setDate(nowLocal.getDate() + i);
      const dow = (today + i) % 7;
      if (days.includes(dow)) {
        cand.setHours(h, m, 0, 0);
        if (cand > nowLocal) return new Date(cand.getTime() - offsetMs);
      }
    }
    const fallback = new Date(nowLocal);
    fallback.setDate(nowLocal.getDate() + 7);
    fallback.setHours(h, m, 0, 0);
    return new Date(fallback.getTime() - offsetMs);
  } catch {
    return computeNextRun(payload);
  }
};

// Compute the next run strictly based on the previous nextRun timestamp to preserve exact time-of-day
const computeNextAfterPrev = (rule) => {
  try {
    if (!rule || !rule.nextRun) return computeNextRun(rule || {});
    const prev = new Date(rule.nextRun);
    if (isNaN(prev.getTime())) return computeNextRun(rule);
    const hours = prev.getHours();
    const minutes = prev.getMinutes();
    const type = rule.type;
    if (type === 'daily') {
      const next = new Date(prev);
      next.setDate(prev.getDate() + 1);
      next.setHours(hours, minutes, 0, 0);
      return next;
    }
    if (type === 'alternating_days') {
      const next = new Date(prev);
      next.setDate(prev.getDate() + 2); // Every other day
      next.setHours(hours, minutes, 0, 0);
      return next;
    }
    if (type === 'weekly') {
      const allowed = Array.isArray(rule.days) ? rule.days.slice().sort() : [];
      // If no specific days provided, default to every 7 days from previous
      if (allowed.length === 0) {
        const next = new Date(prev);
        next.setDate(prev.getDate() + 7);
        next.setHours(hours, minutes, 0, 0);
        return next;
      }
      const prevDow = prev.getDay();
      for (let i = 1; i <= 7; i++) {
        const candidateDow = (prevDow + i) % 7;
        if (allowed.includes(candidateDow)) {
          const next = new Date(prev);
          next.setDate(prev.getDate() + i);
          next.setHours(hours, minutes, 0, 0);
          return next;
        }
      }
      // Fallback one week later
      const next = new Date(prev);
      next.setDate(prev.getDate() + 7);
      next.setHours(hours, minutes, 0, 0);
      return next;
    }
    // one_time has no next
    return null;
  } catch {
    return computeNextRun(rule || {});
  }
};

// Normalize time to 24-hour HH:mm format
const normalizeTime24 = (raw) => {
  try {
    if (!raw) return '09:00';
    const trimmed = String(raw).trim();
    const ampm = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (ampm) {
      let hh = parseInt(ampm[1] || '0', 10);
      const mm = parseInt(ampm[2] || '0', 10);
      const suffix = (ampm[4] || '').toUpperCase();
      if (suffix === 'PM' && hh < 12) hh += 12;
      if (suffix === 'AM' && hh === 12) hh = 0;
      const h2 = String(hh).padStart(2, '0');
      const m2 = String(mm).padStart(2, '0');
      return `${h2}:${m2}`;
    }
    const parts = trimmed.split(':');
    if (parts.length >= 2) {
      let hh = parseInt(parts[0] || '0', 10);
      let mm = parseInt(parts[1] || '0', 10);
      if (isNaN(hh)) hh = 0; if (isNaN(mm)) mm = 0;
      hh = Math.max(0, Math.min(23, hh));
      mm = Math.max(0, Math.min(59, mm));
      const h2 = String(hh).padStart(2, '0');
      const m2 = String(mm).padStart(2, '0');
      return `${h2}:${m2}`;
    }
    return '09:00';
  } catch {
    return '09:00';
  }
};

// GET all recurring requests
app.get('/api/recurring-requests', async (req, res) => {
  try {
    // On-demand tick to ensure due jobs are processed even on sleeping hosts
    try { await tryGenerateFromRecurring(); } catch {}
    const rec = await RecurringRequest.find().sort({ nextRun: 1, updatedAt: -1 });
    res.json(rec);
  } catch (err) {
    console.error('Error fetching recurring requests:', err);
    res.status(500).json({ error: 'Failed to fetch recurring requests', details: err.message });
  }
});

// CREATE recurring request
app.post('/api/recurring-requests', async (req, res) => {
  try {
    const body = { ...req.body };
    body.time = normalizeTime24(body.time || '09:00');
    // Normalize from customer
    const cust = await Customer.findById(body.customerId);
    if (!cust) return res.status(400).json({ error: 'Invalid customerId' });
    if (!body.customerName) body.customerName = cust.name;
    if (!body.address) body.address = cust.address;
    if (body.customerIntId == null) body.customerIntId = cust.id;
    // Compute nextRun if not provided
    const next = body.nextRun ? new Date(body.nextRun) : computeNextRunWithOffset(body);
    const rec = new RecurringRequest({
      ...body,
      nextRun: next,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const saved = await rec.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('Error creating recurring request:', err);
    res.status(400).json({ error: 'Failed to create recurring request', details: err.message });
  }
});

// UPDATE recurring request
app.put('/api/recurring-requests/:id', async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.time != null) body.time = normalizeTime24(body.time || '09:00');
    // If customer changed, refresh denormalized
    if (body.customerId) {
      const cust = await Customer.findById(body.customerId);
      if (!cust) return res.status(400).json({ error: 'Invalid customerId' });
      if (body.customerName == null) body.customerName = cust.name;
      if (body.address == null) body.address = cust.address;
      if (body.customerIntId == null) body.customerIntId = cust.id;
    }
    // Recompute nextRun if any schedule-related field changed
    const scheduleFields = ['type','days','date','time'];
    const shouldRecompute = scheduleFields.some(k => Object.prototype.hasOwnProperty.call(body, k));
    if (shouldRecompute || !body.nextRun) {
      body.nextRun = computeNextRunWithOffset({ ...body });
    }
    body.updatedAt = new Date();
    const updated = await RecurringRequest.findByIdAndUpdate(req.params.id, body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Recurring request not found' });
    res.json(updated);
  } catch (err) {
    console.error('Error updating recurring request:', err);
    res.status(400).json({ error: 'Failed to update recurring request', details: err.message });
  }
});

// DELETE recurring request
app.delete('/api/recurring-requests/:id', async (req, res) => {
  try {
    await RecurringRequest.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting recurring request:', err);
    res.status(400).json({ error: 'Failed to delete recurring request', details: err.message });
  }
});

// Delivery Requests endpoints
// PHASE 4: Delivery requests endpoint with pagination and filtering
app.get('/api/delivery-requests', async (req, res) => {
  try {
    // On-demand tick before listing to surface newly generated requests immediately
    try { await tryGenerateFromRecurring(); } catch {}
    
    // Pagination parameters - defaults to 50 if not provided
    const page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 50;
    
    // Safety check: If limit is provided but parsed incorrectly (e.g., NaN), use default
    if (isNaN(limit) || limit <= 0) {
      limit = 50;
    }
    
    const skip = (page - 1) * limit;
    
    // PHASE 4: Filtering parameters
    const status = req.query.status;
    const priority = req.query.priority;
    const customerId = req.query.customerId;
    const search = req.query.search; // Search in customer name or address
    const startDate = req.query.startDate; // Filter by date range (start)
    const endDate = req.query.endDate; // Filter by date range (end)
    
    // Build query
    const query = {};
    if (status) {
      if (Array.isArray(status)) {
        query.status = { $in: status };
      } else {
        query.status = status;
      }
    }
    if (priority) {
      query.priority = priority;
    }
    if (customerId) {
      query.customerId = customerId;
    }
    
    // Date range filter
    if (startDate || endDate) {
      query.requestedAt = {};
      if (startDate) {
        query.requestedAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.requestedAt.$lt = new Date(endDate);
      }
    }
    
    // Search filter (if provided, we'll need to populate and filter)
    let searchQuery = query;
    if (search) {
      const trimmedSearch = search.trim();
      let customerIds;
      
      // If search is purely numeric, search ONLY by customer ID (integer field)
      if (/^\d+$/.test(trimmedSearch)) {
        const numericId = parseInt(trimmedSearch, 10);
        customerIds = await Customer.find({
          id: numericId
        }).select('_id').lean();
      } else {
        // Non-numeric search: search in customer name, address, phone
        customerIds = await Customer.find({
          $or: [
            { name: { $regex: trimmedSearch, $options: 'i' } },
            { address: { $regex: trimmedSearch, $options: 'i' } },
            { phone: { $regex: trimmedSearch, $options: 'i' } }
          ]
        }).select('_id').lean();
      }
      
      if (customerIds.length > 0) {
        // Convert customer _id to ObjectId if needed
        const customerObjectIds = customerIds.map(c => {
          // Ensure _id is properly formatted as ObjectId
          if (typeof c._id === 'string') {
            return mongoose.Types.ObjectId.createFromHexString(c._id);
          }
          return c._id;
        });
        
        query.customerId = { $in: customerObjectIds };
      } else {
        // No matching customers, return empty result
        return res.json({
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false
          }
        });
      }
    }
    
    // Fetch with pagination
    const limitNum = Number(limit);
    
    const [requests, total] = await Promise.all([
      DeliveryRequest.find(query)
        .sort({ requestedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('customerId', 'pricePerCan paymentType name address phone')
        .lean(),
      DeliveryRequest.countDocuments(query)
    ]);
    
    // Backfill denormalized fields for older docs
    const normalized = requests.map(r => {
      if (r.pricePerCan == null && r.customerId && r.customerId.pricePerCan != null) {
        r.pricePerCan = r.customerId.pricePerCan;
      }
      if (r.paymentType == null && r.customerId && r.customerId.paymentType != null) {
        r.paymentType = r.customerId.paymentType;
      }
      return r;
    });
    
    // Return paginated response
    res.json({
      data: normalized,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: page * limitNum < total,
        hasPrev: page > 1
      }
    });
  } catch (err) {
    console.error('Error fetching delivery requests:', err);
    res.status(500).json({ error: 'Failed to fetch delivery requests', details: err.message });
  }
});

app.post('/api/delivery-requests', async (req, res) => {
  try {
    console.log('Creating delivery request:', req.body);
    
    // RATE LIMITING: Prevent rapid duplicate submissions
    if (req.body.customerId) {
      const now = Date.now();
      const customerKey = `delivery_${req.body.customerId}`;
      const customerRateLimit = deliveryRequestRateLimit.get(customerKey);
      
      if (customerRateLimit) {
        const { count, resetTime } = customerRateLimit;
        if (now < resetTime && count >= RATE_LIMIT_MAX_REQUESTS) {
          const remainingTime = Math.ceil((resetTime - now) / 1000);
          console.log('Rate limit exceeded for customer:', req.body.customerId);
          return res.status(429).json({
            error: 'Rate limit exceeded',
            details: `Too many requests. Please wait ${remainingTime} seconds.`,
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: remainingTime
          });
        }
        
        if (now >= resetTime) {
          // Reset window
          deliveryRequestRateLimit.set(customerKey, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
        } else {
          // Increment count
          deliveryRequestRateLimit.set(customerKey, { count: count + 1, resetTime });
        }
      } else {
        // First request for this customer
        deliveryRequestRateLimit.set(customerKey, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
      }
    }
    
    // STRONG DUPLICATE PREVENTION LOGIC
    // Check for existing active requests for the same customer
    if (req.body.customerId) {
      const existingActiveRequest = await DeliveryRequest.findOne({
        customerId: req.body.customerId,
        status: { $in: ['pending', 'pending_confirmation', 'processing'] }
      });
      
      if (existingActiveRequest) {
        console.log('Duplicate prevention: Active request already exists for customer:', req.body.customerId);
        return res.status(409).json({ 
          error: 'Duplicate request prevented', 
          details: 'Customer already has an active delivery request',
          existingRequestId: existingActiveRequest._id,
          existingStatus: existingActiveRequest.status
        });
      }
    }
    
    // Derive missing denormalized fields from customer
    let pricePerCan = req.body.pricePerCan;
    let paymentType = req.body.paymentType;
    let customerIntId = req.body.customerIntId;
    if ((!pricePerCan || !paymentType || !customerIntId) && req.body.customerId) {
      const cust = await Customer.findById(req.body.customerId);
      if (cust) {
        if (!pricePerCan) pricePerCan = cust.pricePerCan;
        if (!paymentType) paymentType = cust.paymentType;
        if (!customerIntId) customerIntId = cust.id;
      }
    }

    // Set createdBy default to 'admin' if not provided (for backward compatibility)
    // Only override if explicitly set to 'customer_portal' by customer
    const createdBy = req.body.createdBy || 'admin';
    
    const request = new DeliveryRequest({
      ...req.body,
      pricePerCan,
      paymentType,
      customerIntId,
      createdBy, // Ensure createdBy is always set
    });
    
    // Use save() with error handling for duplicate key errors
    let savedRequest;
    try {
      savedRequest = await request.save();
    } catch (saveError) {
      // Handle MongoDB duplicate key errors (additional safety net)
      if (saveError.code === 11000) {
        console.log('MongoDB duplicate key error caught for customer:', req.body.customerId);
        return res.status(409).json({ 
          error: 'Duplicate request prevented', 
          details: 'A delivery request for this customer already exists',
          code: 'DUPLICATE_REQUEST'
        });
      }
      throw saveError;
    }
    
    console.log('Delivery request saved:', savedRequest);
    
    // PHASE 3: Broadcast WebSocket update for new delivery request
    broadcastUpdate('deliveryRequests', { type: 'created', data: savedRequest });
    broadcastUpdate('dashboardMetrics', { type: 'refresh' });
    
    res.status(201).json(savedRequest);
  } catch (err) {
    console.error('Error creating delivery request:', err);
    
    // Enhanced error handling for duplicate scenarios
    if (err.code === 11000) {
      return res.status(409).json({ 
        error: 'Duplicate request prevented', 
        details: 'A delivery request for this customer already exists',
        code: 'DUPLICATE_REQUEST'
      });
    }
    
    res.status(400).json({ error: 'Failed to create delivery request', details: err.message });
  }
});

app.put('/api/delivery-requests/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    console.log(`Updating request ${req.params.id} status to:`, status);
    
    // Validate status value
    const validStatuses = ['pending', 'pending_confirmation', 'processing', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status', 
        details: `Status must be one of: ${validStatuses.join(', ')}` 
      });
    }
    
    const updateData = { status, updatedAt: new Date() };
    
    if (status === 'delivered') {
      updateData.deliveredAt = new Date();
      updateData.completedAt = new Date();
    } else if (status === 'cancelled') {
      updateData.cancelledAt = new Date();
      updateData.completedAt = new Date();
    }
    
    const request = await DeliveryRequest.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }
    console.log('Request status updated:', request);
    
    // PHASE 3: Broadcast WebSocket update
    broadcastUpdate('deliveryRequests', { type: 'updated', data: request });
    broadcastUpdate('dashboardMetrics', { type: 'refresh' });
    
    res.json(request);
  } catch (err) {
    console.error('Error updating request status:', err);
    res.status(400).json({ error: 'Failed to update request status', details: err.message });
  }
});

app.put('/api/delivery-requests/:id', async (req, res) => {
  try {
    const body = { ...req.body };
    // If customerId is provided (changing target), refresh denormalized fields
    if (body.customerId) {
      const cust = await Customer.findById(body.customerId);
      if (cust) {
        if (body.pricePerCan == null) body.pricePerCan = cust.pricePerCan;
        if (body.paymentType == null) body.paymentType = cust.paymentType;
        if (body.customerIntId == null) body.customerIntId = cust.id;
      }
    }
    const request = await DeliveryRequest.findByIdAndUpdate(
      req.params.id,
      { ...body, updatedAt: new Date() },
      { new: true }
    );
    if (!request) return res.status(404).json({ error: 'Request not found' });
    console.log('Delivery request updated:', request);
    res.json(request);
  } catch (err) {
    console.error('Error updating delivery request:', err);
    res.status(400).json({ error: 'Failed to update delivery request', details: err.message });
  }
});

// DELETE delivery request
app.delete('/api/delivery-requests/:id', async (req, res) => {
  try {
    const request = await DeliveryRequest.findByIdAndDelete(req.params.id);
    if (!request) return res.status(404).json({ error: 'Delivery request not found' });
    res.json({ message: 'Delivery request deleted successfully' });
  } catch (err) {
    console.error('Error deleting delivery request:', err);
    res.status(500).json({ error: 'Failed to delete delivery request', details: err.message });
  }
});

// CANCEL delivery request
app.post('/api/delivery-requests/:id/cancel', async (req, res) => {
  try {
    const { reason, notes, cancelledBy } = req.body;
    
    // Validate required fields
    if (!reason || !cancelledBy) {
      return res.status(400).json({ error: 'Cancellation reason and cancelledBy are required' });
    }

    const request = await DeliveryRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Delivery request not found' });
    }

    // Only allow cancellation of pending or processing requests
    if (request.status !== 'pending' && request.status !== 'pending_confirmation' && request.status !== 'processing') {
      return res.status(400).json({ error: 'Only pending or processing requests can be cancelled' });
    }

    // Update request with cancellation details
    request.status = 'cancelled';
    request.cancelledAt = new Date();
    request.cancelledBy = cancelledBy;
    request.cancellationReason = reason;
    request.cancellationNotes = notes || '';

    await request.save();
    
    // PHASE 3: Broadcast WebSocket update for cancelled request
    broadcastUpdate('deliveryRequests', { type: 'updated', data: request });
    broadcastUpdate('dashboardMetrics', { type: 'refresh' });
    
    res.json(request);
  } catch (err) {
    console.error('Error cancelling delivery request:', err);
    res.status(500).json({ error: 'Failed to cancel delivery request', details: err.message });
  }
});

// Rate limiting for delivery request creation to prevent rapid duplicate submissions
const deliveryRequestRateLimit = new Map();
const RATE_LIMIT_WINDOW_MS = 5000; // 5 seconds
const RATE_LIMIT_MAX_REQUESTS = 1; // Max 1 request per customer per window

// Cleanup expired rate limit entries every minute to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of deliveryRequestRateLimit.entries()) {
    if (now >= value.resetTime) {
      deliveryRequestRateLimit.delete(key);
    }
  }
}, 60000); // Clean up every minute

// Simple server-side scheduler to auto-generate delivery requests from recurring rules
const SCHEDULER_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes
const TRIGGER_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes to avoid duplicates

const tryGenerateFromRecurring = async () => {
  try {
    const now = new Date();
    // Find all recurring rules with nextRun due in the past (with tolerance covering the scheduler interval)
    // Fetch all rules due up to now; rely on lastTriggeredAt cooldown and nextRun advancement to prevent duplicates
    const dueRules = await RecurringRequest.find({ nextRun: { $lte: now } }).sort({ nextRun: 1 }).lean();
    if (!dueRules.length) return;

    for (const rule of dueRules) {
      // Debounce if recently triggered (but allow if nextRun moved ahead since lastTriggeredAt)
      if (rule.lastTriggeredAt) {
        const lastTs = new Date(rule.lastTriggeredAt).getTime();
        const nextTs = new Date(rule.nextRun).getTime();
        if ((now - lastTs) < TRIGGER_COOLDOWN_MS && nextTs <= lastTs) {
        continue;
        }
      }

      // Skip if active request already exists for this customer
      const hasActive = await DeliveryRequest.exists({
        customerId: rule.customerId,
        status: { $in: ['pending','pending_confirmation','processing'] }
      });
      if (hasActive) {
        // Still update nextRun for daily/weekly to avoid piling up
        if (rule.type !== 'one_time') {
          const next = computeNextAfterPrev(rule);
          await RecurringRequest.updateOne({ _id: rule._id }, { $set: { nextRun: next, updatedAt: new Date() } });
        }
        continue;
      }

      // Ensure customer details
      const cust = await Customer.findById(rule.customerId);
      if (!cust) {
        // If customer missing, skip and push nextRun forward to prevent tight loop
        const next = rule.type !== 'one_time' ? computeNextRun(rule) : null;
        await RecurringRequest.updateOne({ _id: rule._id }, { $set: { nextRun: next, updatedAt: new Date(), lastTriggeredAt: new Date() } });
        continue;
      }

      // Create delivery request
      const requestDoc = new DeliveryRequest({
        customerId: rule.customerId,
        customerIntId: cust.id,
        customerName: cust.name,
        address: cust.address,
        cans: rule.cans,
        orderDetails: '',
        priority: rule.priority || 'normal',
        status: 'pending',
        requestedAt: new Date(),
        pricePerCan: cust.pricePerCan,
        paymentType: cust.paymentType,
      });
      await requestDoc.save();

      // Update or delete the recurring rule
      if (rule.type === 'one_time') {
        await RecurringRequest.deleteOne({ _id: rule._id });
      } else {
        const next = computeNextAfterPrev({ ...rule, nextRun: new Date(rule.nextRun) });
        await RecurringRequest.updateOne({ _id: rule._id }, { $set: { nextRun: next, updatedAt: new Date(), lastTriggeredAt: new Date() } });
      }
    }
  } catch (err) {
    console.error('Recurring scheduler error:', err);
  }
};

// Align execution to the next 3-minute boundary for accuracy
const alignAndStartScheduler = () => {
  const now = new Date();
  const secondsIntoMinute = now.getSeconds() + now.getMilliseconds() / 1000;
  const minutesMod = now.getMinutes() % 3;
  const minutesToAdd = (3 - minutesMod) % 3 || 3; // if already on boundary, schedule to next boundary
  const nextBoundary = new Date(now.getTime());
  nextBoundary.setSeconds(0, 0);
  nextBoundary.setMinutes(nextBoundary.getMinutes() + minutesToAdd);
  const delay = Math.max(0, nextBoundary.getTime() - now.getTime());
  setTimeout(() => {
    tryGenerateFromRecurring();
    setInterval(tryGenerateFromRecurring, SCHEDULER_INTERVAL_MS);
  }, delay + 50);
};
alignAndStartScheduler();

// Test endpoint to verify PKT date calculation
app.get('/api/test-pkt-dates', (req, res) => {
  try {
    const now = new Date();
    
    // Helper function to create PKT date boundaries
    const createPKTDateBoundaries = (year, month, day) => {
      // For PKT (UTC+05:00), we need to create UTC boundaries that represent
      // the PKT business day from 00:00:00 to 23:59:59
      
      // PKT 00:00:00 = UTC 19:00:00 (previous day)
      const startUTC = new Date(Date.UTC(year, month - 1, day - 1, 19, 0, 0, 0));
      
      // PKT 23:59:59 = UTC 18:59:59 (same day)
      const endUTC = new Date(Date.UTC(year, month - 1, day, 18, 59, 59, 999));
      
      return { startUTC, endUTC };
    };
    
    // Get current PKT time
    const pktOffset = 5 * 60 * 60 * 1000; // 5 hours in milliseconds
    const pktNow = new Date(now.getTime() + pktOffset);
    
    // Get PKT date components
    const pktYear = pktNow.getUTCFullYear();
    const pktMonth = pktNow.getUTCMonth() + 1;
    const pktDay = pktNow.getUTCDate();
    
    // Create boundaries for today in PKT
    const boundaries = createPKTDateBoundaries(pktYear, pktMonth, pktDay);
    
    const testData = {
      currentUTC: now.toISOString(),
      currentPKT: pktNow.toISOString(),
      pktDate: `${pktYear}-${pktMonth.toString().padStart(2, '0')}-${pktDay.toString().padStart(2, '0')}`,
      pktBoundaries: {
        start: boundaries.startUTC.toISOString(),
        end: boundaries.endUTC.toISOString(),
        startPKT: boundaries.startUTC.toLocaleString('en-US', { timeZone: 'Asia/Karachi' }),
        endPKT: boundaries.endUTC.toLocaleString('en-US', { timeZone: 'Asia/Karachi' })
      },
      explanation: {
        pktStart: `PKT ${pktYear}-${pktMonth}-${pktDay} 00:00:00`,
        pktEnd: `PKT ${pktYear}-${pktMonth}-${pktDay} 23:59:59`,
        utcStart: `UTC ${boundaries.startUTC.toISOString()}`,
        utcEnd: `UTC ${boundaries.endUTC.toISOString()}`
      }
    };
    
    res.json(testData);
  } catch (err) {
    res.status(500).json({ error: 'Test failed', details: err.message });
  }
});

// Dashboard metrics endpoint
app.get('/api/dashboard/metrics', async (req, res) => {
  try {
    // PHASE 1 OPTIMIZATION: Check cache first
    const cacheKey = `metrics-${req.query.day || ''}-${req.query.month || ''}-${req.query.year || ''}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('📦 Serving from cache:', cacheKey);
      return res.json(cached);
    }

    const now = new Date();
    const { day, month, year } = req.query;
    
    let startOfDay, endOfDay, timeLabel;
    
    // Helper function to create PKT date boundaries
    const createPKTDateBoundaries = (year, month, day) => {
      // For PKT (UTC+05:00), we need to create UTC boundaries that represent
      // the PKT business day from 00:00:00 to 23:59:59
      
      // PKT 00:00:00 = UTC 19:00:00 (previous day)
      const startUTC = new Date(Date.UTC(year, month - 1, day - 1, 19, 0, 0, 0));
      
      // PKT 23:59:59 = UTC 18:59:59 (same day)
      const endUTC = new Date(Date.UTC(year, month - 1, day, 18, 59, 59, 999));
      
      return { startUTC, endUTC };
    };
    
    if (day && month && year) {
      // Specific date selected
      const dayNum = parseInt(day);
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);
      
      if (!isNaN(dayNum) && !isNaN(monthNum) && !isNaN(yearNum)) {
        // Create PKT date boundaries
        const boundaries = createPKTDateBoundaries(yearNum, monthNum, dayNum);
        startOfDay = boundaries.startUTC;
        endOfDay = boundaries.endUTC;
        timeLabel = `${dayNum}/${monthNum}/${yearNum}`;
      }
    } else if (month && year) {
      // Month view selected
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);
      
      if (!isNaN(monthNum) && !isNaN(yearNum)) {
        const boundaries = createPKTDateBoundaries(yearNum, monthNum, 1);
        startOfDay = boundaries.startUTC;
        
        // Last day of month
        const lastDay = new Date(yearNum, monthNum, 0).getDate();
        const endBoundaries = createPKTDateBoundaries(yearNum, monthNum, lastDay);
        endOfDay = endBoundaries.endUTC;
        
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        timeLabel = `${monthNames[monthNum - 1]} ${yearNum}`;
      }
    } else if (year) {
      // Year view selected
      const yearNum = parseInt(year);
      
      if (!isNaN(yearNum)) {
        const boundaries = createPKTDateBoundaries(yearNum, 1, 1);
        startOfDay = boundaries.startUTC;
        
        const endBoundaries = createPKTDateBoundaries(yearNum, 12, 31);
        endOfDay = endBoundaries.endUTC;
        
        timeLabel = `${yearNum}`;
      }
    }
    
    // Default to today in PKT if no specific date provided
    if (!startOfDay || !endOfDay) {
      // Get current UTC time
      const utcNow = new Date();
      
      // Calculate current PKT time (UTC+05:00)
      const pktOffset = 5 * 60 * 60 * 1000; // 5 hours in milliseconds
      const pktNow = new Date(utcNow.getTime() + pktOffset);
      
      // Get PKT date components
      const pktYear = pktNow.getUTCFullYear();
      const pktMonth = pktNow.getUTCMonth() + 1;
      const pktDay = pktNow.getUTCDate();
      
      // Create boundaries for today in PKT
      const boundaries = createPKTDateBoundaries(pktYear, pktMonth, pktDay);
      startOfDay = boundaries.startUTC;
      endOfDay = boundaries.endUTC;
      timeLabel = 'Today';
    }

    console.log(`📅 Dashboard metrics for: ${timeLabel}`);
    console.log(`📅 Date range: ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);
    console.log(`📅 PKT Time: ${startOfDay.toLocaleString('en-US', { timeZone: 'Asia/Karachi' })} to ${endOfDay.toLocaleString('en-US', { timeZone: 'Asia/Karachi' })}`);
    console.log(`📅 Current UTC: ${now.toISOString()}`);

    // PHASE 1 OPTIMIZATION: Single aggregation pipeline replaces 6 sequential queries
    // This reduces query time from 4-8 seconds to 200-500ms
    const [metricsResult, totalCustomers] = await Promise.all([
      DeliveryRequest.aggregate([
        {
          $facet: {
            // Period deliveries with calculations
            periodDeliveries: [
              {
                $match: {
      status: 'delivered',
      $or: [
        { deliveredAt: { $gte: startOfDay, $lte: endOfDay } },
        { completedAt: { $gte: startOfDay, $lte: endOfDay } }
      ]
                }
              },
              {
                $group: {
                  _id: null,
                  count: { $sum: 1 },
                  totalCans: { $sum: '$cans' },
                  totalAmount: {
                    $sum: {
                      $multiply: [
                        '$cans',
                        { $ifNull: ['$pricePerCan', 0] }
                      ]
                    }
                  },
                  cashAmount: {
                    $sum: {
                      $cond: [
                        { $eq: ['$paymentType', 'cash'] },
                        {
                          $multiply: [
                            '$cans',
                            { $ifNull: ['$pricePerCan', 0] }
                          ]
                        },
                        0
                      ]
                    }
                  },
                  cashDeliveries: {
                    $sum: {
                      $cond: [{ $eq: ['$paymentType', 'cash'] }, 1, 0]
                    }
                  },
                  accountDeliveries: {
                    $sum: {
                      $cond: [{ $eq: ['$paymentType', 'account'] }, 1, 0]
                    }
                  }
                }
              }
            ],
            // Pending requests count
            pendingRequests: [
              {
                $match: {
      status: { $in: ['pending', 'pending_confirmation'] }
                }
              },
              { $count: 'count' }
            ],
            // Processing requests count
            processingRequests: [
              { $match: { status: 'processing' } },
              { $count: 'count' }
            ],
            // Urgent requests count
            urgentRequests: [
              {
                $match: {
      priority: 'urgent',
      status: { $in: ['pending', 'pending_confirmation', 'processing'] }
                }
              },
              { $count: 'count' }
            ]
          }
        }
      ]),
      Customer.countDocuments()
    ]);

    // Extract results from aggregation pipeline
    const periodData = metricsResult[0]?.periodDeliveries[0] || {};
    const pendingCount = metricsResult[0]?.pendingRequests[0]?.count || 0;
    const processingCount = metricsResult[0]?.processingRequests[0]?.count || 0;
    const urgentCount = metricsResult[0]?.urgentRequests[0]?.count || 0;

    const metrics = {
      totalCustomers,
      pendingRequests: pendingCount,
      processingRequests: processingCount,
      urgentRequests: urgentCount,
      deliveries: periodData.count || 0,
      totalCans: periodData.totalCans || 0,
      totalAmountGenerated: periodData.totalAmount || 0,
      totalCashAmountGenerated: periodData.cashAmount || 0,
      cashDeliveries: periodData.cashDeliveries || 0,
      accountDeliveries: periodData.accountDeliveries || 0,
      timeLabel,
      startDate: startOfDay.toISOString(),
      endDate: endOfDay.toISOString(),
      timestamp: now.toISOString()
    };

    console.log(`📊 Metrics calculated (optimized aggregation):`, {
      deliveries: metrics.deliveries,
      totalCans: metrics.totalCans,
      totalAmount: metrics.totalAmountGenerated,
      cashAmount: metrics.totalCashAmountGenerated,
      timeLabel: metrics.timeLabel
    });

    // PHASE 1 OPTIMIZATION: Store in cache
    cache.set(cacheKey, metrics);
    console.log('💾 Cached metrics:', cacheKey);

    res.json(metrics);
  } catch (err) {
    console.error('Error fetching dashboard metrics:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics', details: err.message });
  }
});

// ─── Chart Data Endpoints ────────────────────────────────────────────────────

// Helper: PKT (UTC+5) month boundaries as UTC
const getPKTMonthBounds = (yearNum, monthNum) => {
  // PKT day-1 00:00 = UTC prev-day 19:00
  const start = new Date(Date.UTC(yearNum, monthNum - 1, 0, 19, 0, 0, 0));
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  const end = new Date(Date.UTC(yearNum, monthNum - 1, daysInMonth, 18, 59, 59, 999));
  return { start, end, daysInMonth };
};

const chartAmountExpr = { $multiply: ['$cans', { $ifNull: ['$pricePerCan', 0] }] };
const chartCashExpr = {
  $cond: [{ $eq: ['$paymentType', 'cash'] }, { $multiply: ['$cans', { $ifNull: ['$pricePerCan', 0] }] }, 0]
};
const chartDateField = { $ifNull: ['$deliveredAt', '$completedAt'] };

// GET /api/stats/chart/yearly?year=2025 → monthly breakdown
app.get('/api/stats/chart/yearly', async (req, res) => {
  try {
    const yearNum = parseInt(req.query.year) || new Date().getFullYear();
    const { start: yearStart } = getPKTMonthBounds(yearNum, 1);
    const { end: yearEnd } = getPKTMonthBounds(yearNum, 12);

    const results = await DeliveryRequest.aggregate([
      {
        $match: {
          status: 'delivered',
          $or: [
            { deliveredAt: { $gte: yearStart, $lte: yearEnd } },
            { completedAt: { $gte: yearStart, $lte: yearEnd } }
          ]
        }
      },
      {
        $group: {
          _id: { $month: { date: chartDateField, timezone: '+05:00' } },
          deliveries: { $sum: 1 },
          cans: { $sum: '$cans' },
          amount: { $sum: chartAmountExpr },
          cashAmount: { $sum: chartCashExpr }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const data = monthNames.map((name, i) => {
      const found = results.find(r => r._id === i + 1);
      return { month: name, deliveries: found?.deliveries || 0, cans: found?.cans || 0, amount: found?.amount || 0, cashAmount: found?.cashAmount || 0 };
    });

    res.json({ year: yearNum, data });
  } catch (err) {
    console.error('Yearly chart error:', err);
    res.status(500).json({ error: 'Failed to fetch yearly stats' });
  }
});

// GET /api/stats/chart/monthly?year=2025&month=4 → weekly breakdown
app.get('/api/stats/chart/monthly', async (req, res) => {
  try {
    const yearNum = parseInt(req.query.year) || new Date().getFullYear();
    const monthNum = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const { start, end, daysInMonth } = getPKTMonthBounds(yearNum, monthNum);

    const results = await DeliveryRequest.aggregate([
      {
        $match: {
          status: 'delivered',
          $or: [
            { deliveredAt: { $gte: start, $lte: end } },
            { completedAt: { $gte: start, $lte: end } }
          ]
        }
      },
      {
        $addFields: {
          pktDay: { $dayOfMonth: { date: chartDateField, timezone: '+05:00' } }
        }
      },
      {
        $addFields: { weekNum: { $ceil: { $divide: ['$pktDay', 7] } } }
      },
      {
        $group: {
          _id: '$weekNum',
          deliveries: { $sum: 1 },
          cans: { $sum: '$cans' },
          amount: { $sum: chartAmountExpr },
          cashAmount: { $sum: chartCashExpr }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const firstDow = new Date(yearNum, monthNum - 1, 1).getDay();
    const totalWeeks = Math.ceil((daysInMonth + firstDow) / 7);
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    const data = Array.from({ length: totalWeeks }, (_, i) => {
      const wn = i + 1;
      const found = results.find(r => r._id === wn);
      const startDay = (wn - 1) * 7 + 1;
      const endDay = Math.min(wn * 7, daysInMonth);
      return {
        week: `Week ${wn}`,
        dateRange: `${monthNames[monthNum - 1]} ${startDay}–${endDay}`,
        deliveries: found?.deliveries || 0,
        cans: found?.cans || 0,
        amount: found?.amount || 0,
        cashAmount: found?.cashAmount || 0
      };
    });

    res.json({ year: yearNum, month: monthNum, data });
  } catch (err) {
    console.error('Monthly chart error:', err);
    res.status(500).json({ error: 'Failed to fetch monthly stats' });
  }
});

// GET /api/stats/chart/dayofweek?year=2025&month=4 → day-of-week analysis
app.get('/api/stats/chart/dayofweek', async (req, res) => {
  try {
    const yearNum = parseInt(req.query.year) || new Date().getFullYear();
    const monthNum = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const { start, end, daysInMonth } = getPKTMonthBounds(yearNum, monthNum);

    const results = await DeliveryRequest.aggregate([
      {
        $match: {
          status: 'delivered',
          $or: [
            { deliveredAt: { $gte: start, $lte: end } },
            { completedAt: { $gte: start, $lte: end } }
          ]
        }
      },
      {
        $group: {
          // MongoDB $dayOfWeek: 1=Sun, 2=Mon, ..., 7=Sat
          _id: { $dayOfWeek: { date: chartDateField, timezone: '+05:00' } },
          deliveries: { $sum: 1 },
          cans: { $sum: '$cans' },
          amount: { $sum: chartAmountExpr },
          cashAmount: { $sum: chartCashExpr }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Count occurrences of each weekday in this month
    const weekdayCounts = Array(7).fill(0); // index 0=Sun … 6=Sat (JS getDay)
    for (let d = 1; d <= daysInMonth; d++) {
      weekdayCounts[new Date(yearNum, monthNum - 1, d).getDay()]++;
    }

    // Mon–Sun order; mongoId maps to MongoDB $dayOfWeek value
    const dayDefs = [
      { day: 'Mon', mongoId: 2, jsDay: 1 },
      { day: 'Tue', mongoId: 3, jsDay: 2 },
      { day: 'Wed', mongoId: 4, jsDay: 3 },
      { day: 'Thu', mongoId: 5, jsDay: 4 },
      { day: 'Fri', mongoId: 6, jsDay: 5 },
      { day: 'Sat', mongoId: 7, jsDay: 6 },
      { day: 'Sun', mongoId: 1, jsDay: 0 },
    ];

    const data = dayDefs.map(({ day, mongoId, jsDay }) => {
      const found = results.find(r => r._id === mongoId);
      const count = weekdayCounts[jsDay];
      return {
        day,
        count,
        label: `${day} ×${count}`,
        deliveries: found?.deliveries || 0,
        cans: found?.cans || 0,
        amount: found?.amount || 0,
        cashAmount: found?.cashAmount || 0,
        avgDeliveries: count > 0 ? Math.round((found?.deliveries || 0) / count * 10) / 10 : 0
      };
    });

    res.json({ year: yearNum, month: monthNum, data });
  } catch (err) {
    console.error('Day-of-week chart error:', err);
    res.status(500).json({ error: 'Failed to fetch day-of-week stats' });
  }
});

// GET /api/stats/chart/daily?year=2025&month=4 → every day of the month
app.get('/api/stats/chart/daily', async (req, res) => {
  try {
    const yearNum = parseInt(req.query.year) || new Date().getFullYear();
    const monthNum = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const { start, end, daysInMonth } = getPKTMonthBounds(yearNum, monthNum);

    const results = await DeliveryRequest.aggregate([
      {
        $match: {
          status: 'delivered',
          $or: [
            { deliveredAt: { $gte: start, $lte: end } },
            { completedAt: { $gte: start, $lte: end } }
          ]
        }
      },
      {
        $group: {
          _id: { $dayOfMonth: { date: chartDateField, timezone: '+05:00' } },
          deliveries: { $sum: 1 },
          cans: { $sum: '$cans' },
          amount: { $sum: chartAmountExpr },
          cashAmount: { $sum: chartCashExpr }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const data = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dow = new Date(yearNum, monthNum - 1, day).getDay();
      const found = results.find(r => r._id === day);
      return {
        day,
        dayName: dayNames[dow],
        dow,
        deliveries: found?.deliveries || 0,
        cans: found?.cans || 0,
        amount: found?.amount || 0,
        cashAmount: found?.cashAmount || 0
      };
    });

    res.json({ year: yearNum, month: monthNum, data });
  } catch (err) {
    console.error('Daily chart error:', err);
    res.status(500).json({ error: 'Failed to fetch daily stats' });
  }
});

// ─── End Chart Data Endpoints ─────────────────────────────────────────────────

// Customer statistics endpoint
app.get('/api/customers/:id/stats', async (req, res) => {
  try {
    console.log(`Fetching stats for customer ${req.params.id}...`);
    
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    console.log(`Customer found: ${customer.name}`);
    
    // Build query filter based on optional month and year parameters
    const query = {
      $or: [
        { customerId: req.params.id },
        { customerId: mongoose.Types.ObjectId.createFromHexString(req.params.id) }
      ],
      status: 'delivered'
    };

    // Add date filtering if month and year are provided
    const { month, year } = req.query;
    if (month && year) {
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);
      
      if (monthNum >= 1 && monthNum <= 12 && yearNum > 1900) {
        // Create start and end dates for the specified month
        const startDate = new Date(yearNum, monthNum - 1, 1); // month is 0-indexed
        const endDate = new Date(yearNum, monthNum, 1); // first day of next month
        
        query.deliveredAt = {
          $gte: startDate,
          $lt: endDate
        };
        
        console.log(`Filtering for month ${monthNum}/${yearNum}: ${startDate} to ${endDate}`);
      }
    }
    
    // Aggregate stats using per-request pricePerCan (not current customer price)
    // This ensures historical records are not affected when customer price is updated
    const aggResult = await DeliveryRequest.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalDeliveries: { $sum: 1 },
          totalCansReceived: { $sum: '$cans' },
          totalPrice: {
            $sum: {
              $multiply: ['$cans', { $ifNull: ['$pricePerCan', 0] }]
            }
          }
        }
      }
    ]);

    const aggData = aggResult[0] || { totalDeliveries: 0, totalCansReceived: 0, totalPrice: 0 };

    console.log(`Found ${aggData.totalDeliveries} delivered requests for customer ${customer.name}`);

    const totalDeliveries = aggData.totalDeliveries;
    const totalCansReceived = aggData.totalCansReceived;
    const totalPrice = aggData.totalPrice;
    
    const stats = {
      totalDeliveries,
      totalCansReceived,
      totalPrice,
      pricePerCan: customer.pricePerCan,
      month: month || null,
      year: year || null
    };
    
    console.log(`Customer ${customer.name} stats:`, stats);
    res.json(stats);
  } catch (err) {
    console.error('Error fetching customer stats:', err);
    res.status(500).json({ error: 'Failed to fetch customer stats', details: err.message });
  }
});

// Aggregate total cans per customer in optional date range
app.get('/api/customers/stats-summary', async (req, res) => {
  try {
    const { start, end } = req.query;
    console.log('Stats summary request:', { start, end });
    let match = { status: 'delivered' };

    // Build optional date range for deliveredAt/completedAt
    let startDate = null;
    let endDate = null;
    if (start) {
      const d = new Date(start);
      if (!isNaN(d.getTime())) startDate = d;
    }
    if (end) {
      const d = new Date(end);
      if (!isNaN(d.getTime())) endDate = d;
    }

    if (startDate || endDate) {
      const range = {};
      if (startDate) range.$gte = startDate;
      if (endDate) range.$lt = endDate;
      match.$or = [
        { deliveredAt: range },
        { completedAt: range },
      ];
    }

    console.log('MongoDB match query:', JSON.stringify(match, null, 2));

    const pipeline = [
      { $match: match },
      { $group: { _id: '$customerId', totalCans: { $sum: '$cans' } } },
    ];

    console.log('Aggregation pipeline:', JSON.stringify(pipeline, null, 2));

    const results = await DeliveryRequest.aggregate(pipeline);
    console.log('Aggregation results count:', results.length);
    console.log('First 3 results:', results.slice(0, 3));
    
    // Map to simple objects
    const data = results.map(r => ({ customerObjectId: String(r._id), totalCans: r.totalCans }));
    console.log('Mapped data count:', data.length);
    res.json({ success: true, data });
  } catch (err) {
    console.error('stats-summary error:', err);
    res.status(500).json({ success: false, error: 'Failed to aggregate customer stats', details: err.message });
  }
});

// Check if customer has active requests (pending/processing)
app.get('/api/customers/:id/active-requests', async (req, res) => {
  try {
    console.log(`Checking active requests for customer ${req.params.id}...`);
    
    const activeRequests = await DeliveryRequest.find({
      customerId: req.params.id,
      status: { $in: ['pending', 'pending_confirmation', 'processing'] }
    });
    
    const hasActiveRequests = activeRequests.length > 0;
    
    console.log(`Customer ${req.params.id} has ${activeRequests.length} active requests`);
    res.json({ 
      hasActiveRequests,
      activeRequestsCount: activeRequests.length,
      activeRequests: activeRequests
    });
  } catch (err) {
    console.error('Error checking active requests:', err);
    res.status(500).json({ error: 'Failed to check active requests', details: err.message });
  }
});

// File upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ url: `/uploads/${req.file.filename}` });
});

// Test endpoint to verify MongoDB connection
app.post('/api/test-customer', async (req, res) => {
  try {
    console.log('Creating test customer...');
    const testCustomer = new Customer({
      name: 'Test Customer ' + Date.now(),
      phone: '123-456-7890',
      address: 'Test Address',
      defaultCans: 1,
      pricePerCan: 50,
      notes: 'Test customer created via API',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const savedCustomer = await testCustomer.save();
    console.log('Test customer created:', savedCustomer);
    res.json({ success: true, customer: savedCustomer });
  } catch (err) {
    console.error('Error creating test customer:', err);
    res.status(500).json({ error: 'Failed to create test customer', details: err.message });
  }
});

// Admin backfill endpoint: set integer id on customers and customerIntId on delivery requests
app.post('/api/admin/backfill-customer-ids', async (req, res) => {
  try {
    // 1) Gather existing used ids and max id
    const existingIds = new Set(await Customer.distinct('id'));
    const maxIdDoc = await Customer.find({ id: { $exists: true } }).sort({ id: -1 }).limit(1);
    let currentMaxId = (maxIdDoc[0] && maxIdDoc[0].id) ? maxIdDoc[0].id : 0;

    // 2) Find customers missing id
    const customersMissingId = await Customer.find({ $or: [{ id: { $exists: false } }, { id: null }] });

    let updatedCustomers = 0;
    for (const cust of customersMissingId) {
      let proposedId = cust.serialNumber; // may be undefined if never had serialNumber
      if (typeof proposedId !== 'number' || existingIds.has(proposedId)) {
        // Assign next available unique id
        do { currentMaxId += 1; } while (existingIds.has(currentMaxId));
        proposedId = currentMaxId;
      }
      // Update document
      await Customer.updateOne({ _id: cust._id }, { $set: { id: proposedId } });
      existingIds.add(proposedId);
      if (proposedId > currentMaxId) currentMaxId = proposedId;
      updatedCustomers += 1;
    }

    // 3) Ensure counter is set to max id
    await Counter.findOneAndUpdate(
      { key: 'customers' },
      { $set: { seq: currentMaxId } },
      { upsert: true, new: true }
    );

    // 4) Backfill delivery requests with customerIntId where missing
    const requestsMissingIntId = await DeliveryRequest.find({ $or: [{ customerIntId: { $exists: false } }, { customerIntId: null }] });
    const uniqueCustomerObjectIds = Array.from(new Set(requestsMissingIntId.map(r => String(r.customerId)).filter(Boolean)));

    // Build map from customer _id -> id
    const customersMapDocs = await Customer.find({ _id: { $in: uniqueCustomerObjectIds } }, { _id: 1, id: 1, pricePerCan: 1, paymentType: 1 });
    const idMap = new Map(customersMapDocs.map(doc => [String(doc._id), { id: doc.id, pricePerCan: doc.pricePerCan, paymentType: doc.paymentType }]));

    let updatedRequests = 0;
    const bulkOps = [];
    for (const reqDoc of requestsMissingIntId) {
      const key = String(reqDoc.customerId);
      const info = idMap.get(key);
      if (!info) continue;
      const setFields = { customerIntId: info.id };
      if (reqDoc.pricePerCan == null && info.pricePerCan != null) setFields.pricePerCan = info.pricePerCan;
      if (reqDoc.paymentType == null && info.paymentType != null) setFields.paymentType = info.paymentType;
      bulkOps.push({ updateOne: { filter: { _id: reqDoc._id }, update: { $set: setFields } } });
      updatedRequests += 1;
    }
    if (bulkOps.length > 0) {
      await DeliveryRequest.bulkWrite(bulkOps);
    }

    return res.json({
      success: true,
      updatedCustomers,
      maxId: currentMaxId,
      updatedRequests,
      message: 'Backfill completed. Counter aligned to max id.'
    });
  } catch (err) {
    console.error('Backfill error:', err);
    return res.status(500).json({ success: false, error: 'Backfill failed', details: err.message });
  }
});

// Simple password hashing function (for production, use bcrypt)
const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

// Customer Credentials API Endpoints

// Get all customer credentials (for admin)
app.get('/api/customer-credentials', async (req, res) => {
  try {
    const credentials = await CustomerCredential.find()
      .populate('customerId', '_id id name address phone')
      .select('-password'); // Don't send password hash
    res.json(credentials);
  } catch (err) {
    console.error('Error fetching customer credentials:', err);
    res.status(500).json({ error: 'Failed to fetch customer credentials' });
  }
});

// Get credential for a specific customer
app.get('/api/customer-credentials/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    const credential = await CustomerCredential.findOne({ customerId })
      .populate('customerId', 'id name address phone')
      .select('-password');
    
    if (!credential) {
      return res.status(404).json({ error: 'Credential not found' });
    }
    res.json(credential);
  } catch (err) {
    console.error('Error fetching customer credential:', err);
    res.status(500).json({ error: 'Failed to fetch customer credential' });
  }
});

// Create or update customer credential (for admin)
app.post('/api/customer-credentials', async (req, res) => {
  try {
    const { customerId, username, password, hasDashboardAccess } = req.body;
    
    if (!customerId || !username || !password) {
      return res.status(400).json({ error: 'customerId, username, and password are required' });
    }

    // Check if customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Check if username is already taken
    const existingCredential = await CustomerCredential.findOne({ username });
    if (existingCredential && existingCredential.customerId.toString() !== customerId) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Hash password
    const hashedPassword = hashPassword(password);

    // Create or update credential
    const credential = await CustomerCredential.findOneAndUpdate(
      { customerId },
      {
        username,
        password: hashedPassword,
        hasDashboardAccess: hasDashboardAccess !== undefined ? hasDashboardAccess : true,
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    ).populate('customerId', 'id name address phone');

    // Don't send password hash
    const response = credential.toObject();
    delete response.password;

    // Broadcast logout event if password was changed (force customer to re-login)
    if (password) {
      broadcastUpdate('customerLogout', { 
        type: 'password_changed', 
        customerId: String(customerId),
        message: 'Your password has been changed. Please login again.'
      });
      console.log(`🔐 Password changed for customer ${customerId}, broadcasting logout event`);
    }

    res.json(response);
  } catch (err) {
    console.error('Error creating/updating customer credential:', err);
    res.status(500).json({ error: 'Failed to create/update customer credential', details: err.message });
  }
});

// Customer login
app.post('/api/customer-credentials/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const hashedPassword = hashPassword(password);
    const credential = await CustomerCredential.findOne({ username, password: hashedPassword })
      .populate('customerId', 'id name address phone defaultCans pricePerCan paymentType');

    if (!credential) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (!credential.hasDashboardAccess) {
      return res.status(403).json({ error: 'Dashboard access is not enabled for this customer' });
    }

    // Don't send password hash
    const response = credential.toObject();
    delete response.password;

    res.json({
      success: true,
      credential: response,
      customer: credential.customerId,
    });
  } catch (err) {
    console.error('Error during customer login:', err);
    res.status(500).json({ error: 'Login failed', details: err.message });
  }
});

// Update customer credential (for admin)
app.put('/api/customer-credentials/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    const { username, password, hasDashboardAccess } = req.body;

    const updateData = { updatedAt: new Date() };
    
    if (username) {
      // Check if username is already taken by another customer
      const existingCredential = await CustomerCredential.findOne({ username });
      if (existingCredential && existingCredential.customerId.toString() !== customerId) {
        return res.status(400).json({ error: 'Username already taken' });
      }
      updateData.username = username;
    }

    if (password) {
      updateData.password = hashPassword(password);
    }

    if (hasDashboardAccess !== undefined) {
      updateData.hasDashboardAccess = hasDashboardAccess;
    }

    const credential = await CustomerCredential.findOneAndUpdate(
      { customerId },
      updateData,
      { new: true }
    ).populate('customerId', 'id name address phone');

    if (!credential) {
      return res.status(404).json({ error: 'Credential not found' });
    }

    // Don't send password hash
    const response = credential.toObject();
    delete response.password;

    // Broadcast logout event if password was changed or access was disabled
    if (password) {
      broadcastUpdate('customerLogout', { 
        type: 'password_changed', 
        customerId: String(customerId),
        message: 'Your password has been changed. Please login again.'
      });
      console.log(`🔐 Password changed for customer ${customerId}, broadcasting logout event`);
    }
    
    if (hasDashboardAccess !== undefined && !hasDashboardAccess) {
      broadcastUpdate('customerLogout', { 
        type: 'access_revoked', 
        customerId: String(customerId),
        message: 'Your dashboard access has been revoked.'
      });
      console.log(`🚫 Access revoked for customer ${customerId}, broadcasting logout event`);
    }

    res.json(response);
  } catch (err) {
    console.error('Error updating customer credential:', err);
    res.status(500).json({ error: 'Failed to update customer credential', details: err.message });
  }
});

// Delete customer credential (for admin)
app.delete('/api/customer-credentials/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    const credential = await CustomerCredential.findOneAndDelete({ customerId });

    if (!credential) {
      return res.status(404).json({ error: 'Credential not found' });
    }

    res.json({ success: true, message: 'Credential deleted successfully' });
  } catch (err) {
    console.error('Error deleting customer credential:', err);
    res.status(500).json({ error: 'Failed to delete customer credential', details: err.message });
  }
});

// ─── Customer Registration Request ────────────────────────────────────────────

app.post('/api/register-request', async (req, res) => {
  try {
    const { name, mobile, address, cans, notes } = req.body;

    if (!name || !mobile || !address) {
      return res.status(400).json({ error: 'Name, mobile, and address are required.' });
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER || 'moazam2k1@gmail.com',
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"The Paani" <${process.env.EMAIL_USER || 'paani.online786@gmail.com'}>`,
      to: 'moazamabbasi2k1@gmail.com, jsoomro79@gmail.com, abbasi.suhail@icloud.com, fahadjanabro@gmail.com, paani.online786@gmail.com, suhail.abbasi@smbbmu.edu.pk',
      subject: '🆕 New Customer Registration Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #3f51b5, #303f9f); padding: 20px; text-align: center;">
            <h2 style="color: white; margin: 0; font-size: 20px;">PAANI RO PLANT</h2>
            <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 13px;">New Customer Registration Request</p>
          </div>
          <div style="padding: 24px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; color: #666; font-size: 13px; width: 140px; font-weight: 600;">Name</td>
                <td style="padding: 10px 0; color: #222; font-size: 14px;">${name}</td>
              </tr>
              <tr style="border-top: 1px solid #f0f0f0;">
                <td style="padding: 10px 0; color: #666; font-size: 13px; font-weight: 600;">WhatsApp / Mobile</td>
                <td style="padding: 10px 0; color: #222; font-size: 14px;">${mobile}</td>
              </tr>
              <tr style="border-top: 1px solid #f0f0f0;">
                <td style="padding: 10px 0; color: #666; font-size: 13px; font-weight: 600;">Address</td>
                <td style="padding: 10px 0; color: #222; font-size: 14px;">${address}</td>
              </tr>
              <tr style="border-top: 1px solid #f0f0f0;">
                <td style="padding: 10px 0; color: #666; font-size: 13px; font-weight: 600;">Cans Required</td>
                <td style="padding: 10px 0; color: #222; font-size: 14px;">${cans || 'Not specified'}</td>
              </tr>
              <tr style="border-top: 1px solid #f0f0f0;">
                <td style="padding: 10px 0; color: #666; font-size: 13px; font-weight: 600;">Note</td>
                <td style="padding: 10px 0; color: #222; font-size: 14px;">${notes || 'None'}</td>
              </tr>
            </table>
          </div>
          <div style="background: #f9f9f9; padding: 12px 24px; text-align: center; border-top: 1px solid #e0e0e0;">
            <p style="margin: 0; color: #999; font-size: 11px;">Sent via Paani RO Plant App · ${new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Registration request sent successfully.' });
  } catch (err) {
    console.error('Error sending registration email:', err);
    res.status(500).json({ error: 'Failed to send registration request. Please try again.' });
  }
});

// ─── Notification API Endpoints ───────────────────────────────────────────────

// GET /api/notifications/admin — all price change notifications for admin panel
// Query params: page (default 1), limit (default 20), customerIntId (optional filter)
app.get('/api/notifications/admin', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.customerIntId) {
      const intId = parseInt(req.query.customerIntId);
      if (!isNaN(intId)) filter.customerIntId = intId;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ isReadByAdmin: false }),
    ]);

    res.json({
      notifications,
      unreadCount,
      pagination: { page, limit, total, hasMore: skip + notifications.length < total },
    });
  } catch (err) {
    console.error('Error fetching admin notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications', details: err.message });
  }
});

// GET /api/notifications/customer/:customerId — all notifications for a customer
app.get('/api/notifications/customer/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    const notifications = await Notification.find({ customerId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    const unreadCount = notifications.filter(n => !n.isRead).length;
    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error('Error fetching customer notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications', details: err.message });
  }
});

// PUT /api/notifications/:id/read — mark single notification as read (customer)
app.put('/api/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findByIdAndUpdate(
      id,
      { isRead: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ success: true, notification });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ error: 'Failed to mark notification as read', details: err.message });
  }
});

// PUT /api/notifications/customer/:customerId/read-all — mark all customer notifications as read
app.put('/api/notifications/customer/:customerId/read-all', async (req, res) => {
  try {
    const { customerId } = req.params;
    await Notification.updateMany({ customerId, isRead: false }, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    res.status(500).json({ error: 'Failed to mark notifications as read', details: err.message });
  }
});

// PUT /api/notifications/admin/read-all — mark all admin notifications as read
app.put('/api/notifications/admin/read-all', async (req, res) => {
  try {
    await Notification.updateMany({ isReadByAdmin: false }, { isReadByAdmin: true });
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking admin notifications as read:', err);
    res.status(500).json({ error: 'Failed to mark notifications as read', details: err.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    databaseName: mongoose.connection.db ? mongoose.connection.db.databaseName : 'unknown'
  });
});

// PHASE 3: Initialize WebSocket server
initializeWebSocket(server);

// Start server
server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Test customer: http://localhost:${PORT}/api/test-customer`);
  console.log(`🔌 WebSocket server ready on ws://localhost:${PORT}`);
}); 