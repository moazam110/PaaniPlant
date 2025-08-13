import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import multer from 'multer';
import mongoose from 'mongoose';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(bodyParser.json());

// MongoDB connection with Atlas URI - corrected format
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://moazam:e4U92jBllqwtoGLc@cluster0.u5haqnr.mongodb.net/PAANI?retryWrites=true&w=majority&appName=Cluster0';

console.log('Connecting to MongoDB with URI:', MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'));

mongoose.connect(MONGO_URI, {
  ssl: true,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
})
  .then(() => {
    console.log('Connected to MongoDB Atlas successfully');
    console.log('Database name:', mongoose.connection.db.databaseName);
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

// Delivery requests
const deliveryRequestSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true }, // ObjectId reference
  customerIntId: { type: Number, index: true }, // integer primary id snapshot
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
  createdBy: { type: String, default: '' },
  internalNotes: { type: String, default: '' },
  // denormalized for fast rendering
  pricePerCan: { type: Number },
  paymentType: { type: String, enum: ['cash','account'] },
});

const DeliveryRequest = mongoose.model('DeliveryRequest', deliveryRequestSchema);

// Recurring requests
const recurringRequestSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  customerIntId: { type: Number, index: true },
  customerName: { type: String, required: true },
  address: { type: String, required: true },
  type: { type: String, enum: ['daily', 'weekly', 'one_time'], required: true },
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
app.get('/api/customers', async (req, res) => {
  try {
    console.log('Fetching customers from database...');
    const customers = await Customer.find().sort({ id: -1, createdAt: -1 });
    console.log(`Found ${customers.length} customers`);
    res.json(customers);
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

    const customer = await Customer.findByIdAndUpdate(
      req.params.id, 
      { ...req.body, updatedAt: new Date() }, 
      { new: true, runValidators: true }
    );
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
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
      const d = new Date(payload.date);
      d.setHours(hours, minutes, 0, 0);
      return d;
    }
    if (payload.type === 'daily') {
      const d = new Date();
      d.setHours(hours, minutes, 0, 0);
      if (d <= now) d.setDate(d.getDate() + 1);
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

// GET all recurring requests
app.get('/api/recurring-requests', async (req, res) => {
  try {
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
    // Normalize from customer
    const cust = await Customer.findById(body.customerId);
    if (!cust) return res.status(400).json({ error: 'Invalid customerId' });
    if (!body.customerName) body.customerName = cust.name;
    if (!body.address) body.address = cust.address;
    if (body.customerIntId == null) body.customerIntId = cust.id;
    // Compute nextRun if not provided
    const next = body.nextRun ? new Date(body.nextRun) : computeNextRun(body);
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
      body.nextRun = computeNextRun({ ...body });
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
app.get('/api/delivery-requests', async (req, res) => {
  try {
    console.log('Fetching delivery requests from database...');
    const requests = await DeliveryRequest.find().sort({ requestedAt: -1 })
      .populate('customerId', 'pricePerCan paymentType')
      .lean();
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
    res.json(normalized);
  } catch (err) {
    console.error('Error fetching delivery requests:', err);
    res.status(500).json({ error: 'Failed to fetch delivery requests', details: err.message });
  }
});

app.post('/api/delivery-requests', async (req, res) => {
  try {
    console.log('Creating delivery request:', req.body);
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

    const request = new DeliveryRequest({
      ...req.body,
      pricePerCan,
      paymentType,
      customerIntId,
    });
    const savedRequest = await request.save();
    console.log('Delivery request saved:', savedRequest);
    res.status(201).json(savedRequest);
  } catch (err) {
    console.error('Error creating delivery request:', err);
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

// Cancel delivery request endpoint
app.put('/api/delivery-requests/:id/cancel', async (req, res) => {
  try {
    console.log(`Cancelling delivery request ${req.params.id}`);
    
    // Find the request first to check if it can be cancelled
    const existingRequest = await DeliveryRequest.findById(req.params.id);
    if (!existingRequest) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    // Check if request can be cancelled (only pending and processing requests)
    const cancellableStatuses = ['pending', 'pending_confirmation', 'processing'];
    if (!cancellableStatuses.includes(existingRequest.status)) {
      return res.status(400).json({ 
        error: 'Cannot cancel request', 
        details: `Only requests with status ${cancellableStatuses.join(', ')} can be cancelled. Current status: ${existingRequest.status}` 
      });
    }
    
    const updateData = {
      status: 'cancelled',
      cancelledAt: new Date(),
      completedAt: new Date(),
      updatedAt: new Date()
    };
    
    const request = await DeliveryRequest.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    
    console.log('Delivery request cancelled:', request);
    res.json(request);
  } catch (err) {
    console.error('Error cancelling delivery request:', err);
    res.status(400).json({ error: 'Failed to cancel delivery request', details: err.message });
  }
});

// Simple server-side scheduler to auto-generate delivery requests from recurring rules
const SCHEDULER_INTERVAL_MS = 60 * 1000; // 1 minute
const TRIGGER_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes to avoid duplicates

const tryGenerateFromRecurring = async () => {
  try {
    const now = new Date();
    // Find all recurring rules with nextRun due in the past (with small tolerance)
    const dueRules = await RecurringRequest.find({ nextRun: { $lte: now } }).sort({ nextRun: 1 }).lean();
    if (!dueRules.length) return;

    for (const rule of dueRules) {
      // Debounce if recently triggered
      if (rule.lastTriggeredAt && (now - new Date(rule.lastTriggeredAt)) < TRIGGER_COOLDOWN_MS) {
        continue;
      }

      // Skip if active request already exists for this customer
      const hasActive = await DeliveryRequest.exists({
        customerId: rule.customerId,
        status: { $in: ['pending','pending_confirmation','processing'] }
      });
      if (hasActive) {
        // Still update nextRun for daily/weekly to avoid piling up
        if (rule.type !== 'one_time') {
          const next = computeNextRun(rule);
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
        const next = computeNextRun(rule);
        await RecurringRequest.updateOne({ _id: rule._id }, { $set: { nextRun: next, updatedAt: new Date(), lastTriggeredAt: new Date() } });
      }
    }
  } catch (err) {
    console.error('Recurring scheduler error:', err);
  }
};

setInterval(tryGenerateFromRecurring, SCHEDULER_INTERVAL_MS);
// Run once on startup to catch any overdue jobs
tryGenerateFromRecurring();

// Dashboard metrics endpoint
app.get('/api/dashboard/metrics', async (req, res) => {
  try {
    console.log('Fetching dashboard metrics...');
    const month = req.query.month;
    const year = req.query.year;
    const day = req.query.day;
    console.log('Dashboard metrics request params:', { day, month, year });

    const totalCustomers = await Customer.countDocuments();
    const pendingRequests = await DeliveryRequest.countDocuments({ 
      status: { $in: ['pending', 'pending_confirmation', 'processing'] } 
    });

    let dateQuery = {};
    let timeLabel = 'All Time';
    let isMonthlyView = false;
    let isYearView = false;

    // Helper to build start/end date
    const makeRange = (start, end) => ({ $gte: start, $lt: end });
    let startDate = null;
    let endDate = null;

    if (day && month && year) {
      const dayNum = parseInt(day);
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);
      if (!isNaN(dayNum) && !isNaN(monthNum) && !isNaN(yearNum) && dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum > 1900) {
        startDate = new Date(yearNum, monthNum - 1, dayNum);
        endDate = new Date(yearNum, monthNum - 1, dayNum + 1);
        timeLabel = startDate.toLocaleDateString('en-GB');
        console.log(`Specific day query: ${dayNum}/${monthNum}/${yearNum}`);
        console.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
      }
    } else if (month && year) {
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);
      if (monthNum >= 1 && monthNum <= 12 && yearNum > 1900) {
        startDate = new Date(yearNum, monthNum - 1, 1);
        endDate = new Date(yearNum, monthNum, 1);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        timeLabel = `${monthNames[monthNum - 1]} ${yearNum}`;
        isMonthlyView = true;
      }
    } else if (year) {
      const yearNum = parseInt(year);
      if (!isNaN(yearNum) && yearNum > 1900) {
        startDate = new Date(yearNum, 0, 1);
        endDate = new Date(yearNum + 1, 0, 1);
        timeLabel = `${yearNum}`;
        isYearView = true;
      }
    } else {
      // All-time history (no time limit)
      timeLabel = 'All Time';
    }

    if (startDate && endDate) {
      const range = makeRange(startDate, endDate);
      // Consider both deliveredAt and completedAt to handle historical data
      dateQuery = {
        $or: [
          { deliveredAt: range },
          { completedAt: range },
        ],
      };
    } else {
      dateQuery = {};
    }

    console.log('Date filter setup:', { startDate, endDate, timeLabel });
    console.log('Date query:', JSON.stringify(dateQuery, null, 2));

    const deliveries = await DeliveryRequest.find({
      status: 'delivered',
      ...dateQuery
    }).populate('customerId', 'pricePerCan paymentType');

    console.log(`Found ${deliveries.length} delivered requests for query`);

    // Additional debugging: check all delivered requests today
    if (day && month && year) {
      const allTodayDelivered = await DeliveryRequest.find({ status: 'delivered' });
      const todayStart = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      const todayEnd = new Date(parseInt(year), parseInt(month) - 1, parseInt(day) + 1);
      
      console.log(`Total delivered requests in DB: ${allTodayDelivered.length}`);
      console.log(`Looking for deliveries between ${todayStart.toISOString()} and ${todayEnd.toISOString()}`);
      
      const matchingByDeliveredAt = allTodayDelivered.filter(d => {
        if (!d.deliveredAt) return false;
        const deliveredDate = new Date(d.deliveredAt);
        return deliveredDate >= todayStart && deliveredDate < todayEnd;
      });
      
      const matchingByCompletedAt = allTodayDelivered.filter(d => {
        if (!d.completedAt) return false;
        const completedDate = new Date(d.completedAt);
        return completedDate >= todayStart && completedDate < todayEnd;
      });
      
      console.log(`Matching by deliveredAt: ${matchingByDeliveredAt.length}`);
      console.log(`Matching by completedAt: ${matchingByCompletedAt.length}`);
      
      // Sample of recent deliveries
      const recentDeliveries = allTodayDelivered.slice(0, 5);
      console.log('Sample deliveries:', recentDeliveries.map(d => ({
        id: d._id,
        status: d.status,
        deliveredAt: d.deliveredAt,
        completedAt: d.completedAt,
        cans: d.cans,
        paymentType: d.paymentType
      })));
    }

    const totalCans = deliveries.reduce((sum, req) => sum + req.cans, 0);

    let totalAmountGenerated = 0;
    let totalCashAmountGenerated = 0;
    let cashDeliveries = 0;
    let accountDeliveries = 0;
    
    for (const delivery of deliveries) {
      const unitPrice = (delivery.pricePerCan != null)
        ? delivery.pricePerCan
        : (delivery.customerId && delivery.customerId.pricePerCan) ? delivery.customerId.pricePerCan : 0;
      const payType = (delivery.paymentType != null)
        ? delivery.paymentType
        : (delivery.customerId && delivery.customerId.paymentType) ? delivery.customerId.paymentType : undefined;
      const amount = delivery.cans * (unitPrice || 0);
      totalAmountGenerated += amount;
      
      if (payType === 'cash') {
        totalCashAmountGenerated += amount;
        cashDeliveries++;
      } else if (payType === 'account') {
        accountDeliveries++;
      }
      
      // Debug each delivery
      if (deliveries.length <= 10) {
        console.log(`Delivery: ${delivery._id}, cans: ${delivery.cans}, payType: ${payType}, price: ${unitPrice}, amount: ${amount}`);
      }
    }
    
    console.log('Payment breakdown:', { 
      totalDeliveries: deliveries.length,
      cashDeliveries, 
      accountDeliveries, 
      totalCashAmountGenerated,
      totalAmountGenerated 
    });

    const metrics = {
      totalCustomers,
      pendingRequests,
      deliveries: deliveries.length,
      totalCans,
      totalAmountGenerated,
      totalCashAmountGenerated,
      timeLabel,
      isMonthlyView,
      isYearView,
    };

    console.log(`Dashboard metrics for ${timeLabel}:`, metrics);
    res.json(metrics);
  } catch (err) {
    console.error('Error fetching dashboard metrics:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics', details: err.message });
  }
});

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
    
    // Get all delivered requests for this customer with optional date filtering
    const deliveredRequests = await DeliveryRequest.find(query);
    
    console.log(`Found ${deliveredRequests.length} delivered requests for customer ${customer.name}`);
    console.log('Delivered requests:', deliveredRequests.map(r => ({ 
      id: r._id, 
      cans: r.cans, 
      customerId: r.customerId,
      status: r.status,
      deliveredAt: r.deliveredAt
    })));
    
    const totalDeliveries = deliveredRequests.length;
    const totalCansReceived = deliveredRequests.reduce((sum, req) => sum + req.cans, 0);
    const totalPrice = totalCansReceived * customer.pricePerCan;
    
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

// Notifications endpoints
app.get('/api/notifications', (req, res) => {
  // This part of the code was not provided in the original file,
  // so it's kept as is, but it will likely cause an error
  // as 'notifications' is not defined.
  // Assuming 'notifications' is a global or defined elsewhere if this endpoint is meant to be functional.
  // For now, it's commented out to avoid immediate errors.
  // res.json(notifications);
  res.status(501).json({ message: 'Notifications endpoint not implemented' }); // Placeholder
});

app.post('/api/notifications', (req, res) => {
  // This part of the code was not provided in the original file,
  // so it's kept as is, but it will likely cause an error
  // as 'notifications' and 'uuidv4' are not defined.
  // Assuming 'notifications' is a global or defined elsewhere if this endpoint is meant to be functional.
  // For now, it's commented out to avoid immediate errors.
  // const { message, userId } = req.body;
  // const newNotification = {
  //   id: uuidv4(),
  //   message,
  //   userId,
  //   createdAt: new Date()
  // };
  // notifications.push(newNotification);
  // res.json(newNotification);
  res.status(501).json({ message: 'Notifications endpoint not implemented' }); // Placeholder
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    databaseName: mongoose.connection.db ? mongoose.connection.db.databaseName : 'unknown'
  });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Test customer: http://localhost:${PORT}/api/test-customer`);
}); 