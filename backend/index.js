const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jsonwebtoken = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration
app.use(cors({
  origin: [
    'https://paani.online', 
    'http://72.60.89.107:5000',
    'http://72.60.89.107:3000',
    'http://72.60.89.107',
    'http://localhost:5000',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI environment variable is required');
  console.error('Please create a .env file with your MongoDB connection string');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas successfully');
    console.log('Database name:', mongoose.connection.db.databaseName);
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Rate limiting
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many login attempts, please try again later'
});

// Authentication utilities
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_change_in_production';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jsonwebtoken.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

const requireSuperAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'super_admin') {
    next();
  } else {
    res.status(403).json({ error: 'Super admin access required' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'super_admin')) {
    next();
  } else {
    res.status(403).json({ error: 'Admin access required' });
  }
};

// Logging utilities
const logSystemActivity = (action, details) => {
  console.log(`📝 System Activity: ${action}`, details);
};

const logSecurityEvent = (event, details) => {
  console.log(`🔒 Security Event: ${event}`, details);
};

// Schemas
const superAdminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, default: 'super_admin' },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date },
  isActive: { type: Boolean, default: true }
});

const adminUserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, default: 'admin' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin' },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date },
  isActive: { type: Boolean, default: true }
});

const systemLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId },
  userRole: { type: String },
  details: { type: mongoose.Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now },
  ipAddress: { type: String },
  userAgent: { type: String }
});

const securityEventSchema = new mongoose.Schema({
  eventType: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId },
  userRole: { type: String },
  details: { type: mongoose.Schema.Types.Mixed },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
  timestamp: { type: Date, default: Date.now },
  ipAddress: { type: String },
  userAgent: { type: String }
});

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  address: { type: String, required: true },
  area: { type: String, required: true },
  customerId: { type: Number, unique: true },
  createdAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
});

const deliveryRequestSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  customerAddress: { type: String, required: true },
  customerArea: { type: String, required: true },
  numberOfCans: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['cash', 'account'], required: true },
  status: { type: String, enum: ['pending', 'processing', 'delivered', 'cancelled'], default: 'pending' },
  amount: { type: Number, required: true },
  deliveryDate: { type: Date, default: Date.now },
  deliveredAt: { type: Date },
  deliveredBy: { type: String },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const recurringRequestSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  customerAddress: { type: String, required: true },
  customerArea: { type: String, required: true },
  numberOfCans: { type: Number, required: true },
  frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const counterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  value: { type: Number, default: 0 }
});

// Models
const SuperAdmin = mongoose.model('SuperAdmin', superAdminSchema);
const AdminUser = mongoose.model('AdminUser', adminUserSchema);
const SystemLog = mongoose.model('SystemLog', systemLogSchema);
const SecurityEvent = mongoose.model('SecurityEvent', securityEventSchema);
const Customer = mongoose.model('Customer', customerSchema);
const DeliveryRequest = mongoose.model('DeliveryRequest', deliveryRequestSchema);
const RecurringRequest = mongoose.model('RecurringRequest', recurringRequestSchema);
const Counter = mongoose.model('Counter', counterSchema);

// Create unique compound index for delivery requests
deliveryRequestSchema.index({ customerId: 1, status: 1 }, { unique: true, partialFilterExpression: { status: { $in: ['pending', 'processing'] } } });

// Routes
app.get('/api/health', (req, res) => {
  // Check actual database connection status
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const dbName = mongoose.connection.db ? mongoose.connection.db.databaseName : 'unknown';
  
  res.json({
    status: dbStatus === 'connected' ? 'OK' : 'ERROR',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    databaseName: dbName,
    message: 'Paani Delivery System Backend API',
    version: '1.0.0'
  });
});

// Detailed API info endpoint
app.get('/api/info', (req, res) => {
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
      auth: {
        login: '/api/auth/login (POST)',
        register: '/api/auth/register (POST)',
        superAdminSetup: '/api/auth/super-admin-setup (POST)',
        superAdminLogin: '/api/auth/super-admin-login (POST)'
      },
      superAdmin: {
        dashboard: '/api/super-admin/dashboard (GET)',
        admins: '/api/super-admin/admins (GET, POST, PUT, DELETE)',
        logs: '/api/super-admin/logs (GET)',
        security: '/api/super-admin/security (GET)',
        system: '/api/super-admin/system (GET, PUT)',
        audit: '/api/super-admin/audit (GET)'
      },
      notifications: '/api/notifications',
      upload: '/api/upload (POST)'
    },
    documentation: 'Visit /api/health for system status'
  });
});

// Super Admin Setup (one-time use)
app.post('/api/auth/super-admin-setup', async (req, res) => {
  try {
    const existingSuperAdmin = await SuperAdmin.findOne();
    if (existingSuperAdmin) {
      return res.status(400).json({ error: 'Super admin already exists' });
    }

    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const superAdmin = new SuperAdmin({
      email,
      password: hashedPassword,
      name
    });

    await superAdmin.save();
    logSystemActivity('Super admin created', { email, name });
    
    res.status(201).json({ message: 'Super admin created successfully' });
  } catch (error) {
    console.error('Super admin setup error:', error);
    res.status(500).json({ error: 'Failed to create super admin' });
  }
});

// Super Admin Login
app.post('/api/auth/super-admin-login', authRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const superAdmin = await SuperAdmin.findOne({ email, isActive: true });
    if (!superAdmin) {
      logSecurityEvent('Failed login attempt', { email, reason: 'User not found' });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, superAdmin.password);
    if (!isValidPassword) {
      logSecurityEvent('Failed login attempt', { email, reason: 'Invalid password' });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    superAdmin.lastLogin = new Date();
    await superAdmin.save();

    const token = jsonwebtoken.sign(
      { userId: superAdmin._id, email: superAdmin.email, role: superAdmin.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    logSecurityEvent('Successful login', { email, role: 'super_admin' });
    
    res.json({
      token,
      user: {
        id: superAdmin._id,
        email: superAdmin.email,
        name: superAdmin.name,
        role: superAdmin.role
      }
    });
  } catch (error) {
    console.error('Super admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Super Admin Dashboard
app.get('/api/super-admin/dashboard', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const totalAdmins = await AdminUser.countDocuments({ isActive: true });
    const totalCustomers = await Customer.countDocuments({ isActive: true });
    const totalDeliveryRequests = await DeliveryRequest.countDocuments();
    const totalRecurringRequests = await RecurringRequest.countDocuments({ isActive: true });

    const recentLogs = await SystemLog.find()
      .sort({ timestamp: -1 })
      .limit(10)
      .populate('userId', 'name email');

    const recentSecurityEvents = await SecurityEvent.find()
      .sort({ timestamp: -1 })
      .limit(10);

    res.json({
      metrics: {
        totalAdmins,
        totalCustomers,
        totalDeliveryRequests,
        totalRecurringRequests
      },
      recentLogs,
      recentSecurityEvents
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Admin Management
app.get('/api/super-admin/admins', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const admins = await AdminUser.find({ isActive: true }).select('-password');
    res.json(admins);
  } catch (error) {
    console.error('Fetch admins error:', error);
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

app.post('/api/super-admin/admins', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    const existingAdmin = await AdminUser.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ error: 'Admin with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const admin = new AdminUser({
      email,
      password: hashedPassword,
      name,
      createdBy: req.user.userId
    });

    await admin.save();
    logSystemActivity('Admin created', { email, name, createdBy: req.user.userId });
    
    res.status(201).json({ message: 'Admin created successfully', adminId: admin._id });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ error: 'Failed to create admin' });
  }
});

app.put('/api/super-admin/admins/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { name, isActive } = req.body;
    const admin = await AdminUser.findByIdAndUpdate(
      req.params.id,
      { name, isActive },
      { new: true }
    ).select('-password');

    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    logSystemActivity('Admin updated', { adminId: req.params.id, updatedBy: req.user.userId });
    res.json(admin);
  } catch (error) {
    console.error('Update admin error:', error);
    res.status(500).json({ error: 'Failed to update admin' });
  }
});

app.delete('/api/super-admin/admins/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const admin = await AdminUser.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    logSystemActivity('Admin deactivated', { adminId: req.params.id, deactivatedBy: req.user.userId });
    res.json({ message: 'Admin deactivated successfully' });
  } catch (error) {
    console.error('Deactivate admin error:', error);
    res.status(500).json({ error: 'Failed to deactivate admin' });
  }
});

// System Logs
app.get('/api/super-admin/logs', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, action, userId } = req.query;
    const query = {};
    
    if (action) query.action = action;
    if (userId) query.userId = userId;

    const logs = await SystemLog.find(query)
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('userId', 'name email');

    const total = await SystemLog.countDocuments(query);

    res.json({
      logs,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Fetch logs error:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Security Events
app.get('/api/super-admin/security', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, eventType, severity } = req.query;
    const query = {};
    
    if (eventType) query.eventType = eventType;
    if (severity) query.severity = severity;

    const events = await SecurityEvent.find(query)
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('userId', 'name email');

    const total = await SecurityEvent.countDocuments(query);

    res.json({
      events,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Fetch security events error:', error);
    res.status(500).json({ error: 'Failed to fetch security events' });
  }
});

// Customer routes
app.get('/api/customers', async (req, res) => {
  try {
    console.log(' Fetching customers...');
    
    // Try different query approaches
    const allCustomers = await Customer.find();
    console.log('📊 Total customers found:', allCustomers.length);
    
    // Try without the isActive filter first
    const customers = await Customer.find().sort({ createdAt: -1 }).limit(50);
    console.log(' First 50 customers:', customers.length);
    
    // Log some customer details for debugging
    if (customers.length > 0) {
      console.log(' Sample customer:', {
        id: customers[0]._id,
        name: customers[0].name,
        phone: customers[0].phone
      });
    }
    
    res.json({
      success: true,
      count: customers.length,
      total: allCustomers.length,
      data: customers,
      message: 'Customers fetched successfully'
    });
    
  } catch (error) {
    console.error('❌ Error fetching customers:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch customers',
      details: error.message 
    });
  }
});

app.post('/api/customers', async (req, res) => {
  try {
    console.log('=== CREATING NEW CUSTOMER ===');
    console.log('Request body:', req.body);
    
    const { name, phone, address, area } = req.body;
    
    if (!name || !phone || !address || !area) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if customer with same phone already exists
    const existingCustomer = await Customer.findOne({ phone });
    if (existingCustomer) {
      return res.status(400).json({ error: 'Customer with this phone number already exists' });
    }

    // Get next customer ID
    let counter = await Counter.findOneAndUpdate(
      { name: 'customerId' },
      { $inc: { value: 1 } },
      { upsert: true, new: true }
    );

    const customer = new Customer({
      name,
      phone,
      address,
      area,
      customerId: counter.value
    });

    const savedCustomer = await customer.save();
    console.log('Customer saved successfully:', savedCustomer);
    
    res.status(201).json(savedCustomer);
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

app.put('/api/customers/:id', async (req, res) => {
  try {
    console.log(`Updating customer ${req.params.id}:`, req.body);
    
    const { name, phone, address, area } = req.body;
    
    // Check if phone number is being changed and if it conflicts with existing customer
    if (phone) {
      const existingCustomer = await Customer.findOne({ phone, _id: { $ne: req.params.id } });
      if (existingCustomer) {
        return res.status(400).json({ error: 'Phone number already exists with another customer' });
      }
    }

    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { name, phone, address, area },
      { new: true, runValidators: true }
    );

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    console.log('Customer updated successfully:', customer);
    res.json(customer);
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// Delivery Request routes
app.get('/api/delivery-requests', async (req, res) => {
  try {
    console.log('Fetching delivery requests from database...');
    const requests = await DeliveryRequest.find().sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    console.error('Error fetching delivery requests:', error);
    res.status(500).json({ error: 'Failed to fetch delivery requests' });
  }
});

app.post('/api/delivery-requests', async (req, res) => {
  try {
    console.log('Creating delivery request:', req.body);
    
    const { customerId, numberOfCans, paymentMethod, amount, notes } = req.body;
    
    if (!customerId || !numberOfCans || !paymentMethod || !amount) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    // Check if customer has active request
      const existingActiveRequest = await DeliveryRequest.findOne({
      customerId,
      status: { $in: ['pending', 'processing'] }
      });
      
      if (existingActiveRequest) {
      console.log('Duplicate prevention: Active request already exists for customer:', customerId);
      return res.status(400).json({ 
        error: 'Customer already has an active delivery request',
        existingRequest: existingActiveRequest
      });
    }

    // Get customer details
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const deliveryRequest = new DeliveryRequest({
      customerId,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerAddress: customer.address,
      customerArea: customer.area,
      numberOfCans,
      paymentMethod,
      amount,
      notes
    });

    const savedRequest = await deliveryRequest.save();
    console.log('Delivery request saved:', savedRequest);
    
    res.status(201).json(savedRequest);
  } catch (error) {
    if (error.code === 11000) {
      console.log('MongoDB duplicate key error caught for customer:', req.body.customerId);
      return res.status(400).json({ 
        error: 'Customer already has an active delivery request',
        details: 'Duplicate prevention triggered'
      });
    }
    console.error('Error creating delivery request:', error);
    res.status(500).json({ error: 'Failed to create delivery request' });
  }
});

app.put('/api/delivery-requests/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    console.log(`Updating request ${req.params.id} status to:`, status);
    
    if (!['pending', 'processing', 'delivered', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updateData = { status };
    if (status === 'delivered') {
      updateData.deliveredAt = new Date();
    }
    
    const request = await DeliveryRequest.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    
    if (!request) {
      return res.status(404).json({ error: 'Delivery request not found' });
    }

    console.log('Request status updated:', request);
    res.json(request);
  } catch (error) {
    console.error('Error updating delivery request status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

app.put('/api/delivery-requests/:id', async (req, res) => {
  try {
    const { numberOfCans, paymentMethod, amount, notes } = req.body;
    
    const request = await DeliveryRequest.findByIdAndUpdate(
      req.params.id,
      { numberOfCans, paymentMethod, amount, notes },
      { new: true, runValidators: true }
    );

    if (!request) {
      return res.status(404).json({ error: 'Delivery request not found' });
    }

    console.log('Delivery request updated:', request);
    res.json(request);
  } catch (error) {
    console.error('Error updating delivery request:', error);
    res.status(500).json({ error: 'Failed to update delivery request' });
  }
});

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

    // Get all delivery requests (excluding cancelled ones from all counts)
    const allRequests = await DeliveryRequest.find({ status: { $ne: 'cancelled' } });
    
    // Get deliveries for the selected period (excluding cancelled)
    const periodDeliveries = await DeliveryRequest.find({
      status: 'delivered',
      $or: [
        { deliveredAt: { $gte: startOfDay, $lte: endOfDay } },
        { completedAt: { $gte: startOfDay, $lte: endOfDay } }
      ]
    });

    // Get pending requests (excluding cancelled) - always current
    const pendingRequests = await DeliveryRequest.find({
      status: { $in: ['pending', 'pending_confirmation'] }
    });

    // Get processing requests (excluding cancelled) - always current
    const processingRequests = await DeliveryRequest.find({
      status: 'processing'
    });

    // Get urgent requests (excluding cancelled) - always current
    const urgentRequests = await DeliveryRequest.find({
      priority: 'urgent',
      status: { $in: ['pending', 'pending_confirmation', 'processing'] }
    });

    // Calculate total cans delivered for the period (excluding cancelled)
    const totalCansForPeriod = periodDeliveries.reduce((sum, req) => sum + (req.cans || 0), 0);

    // Calculate total generated amount and cash amount for the period (excluding cancelled)
    let totalAmountGenerated = 0;
    let totalCashAmountGenerated = 0;
    let cashDeliveries = 0;
    let accountDeliveries = 0;

    for (const delivery of periodDeliveries) {
      // Get unit price from delivery request or customer
      const unitPrice = delivery.pricePerCan || 0;
      const payType = delivery.paymentType || 'cash';
      const amount = delivery.cans * unitPrice;
      
      totalAmountGenerated += amount;
      
      if (payType === 'cash') {
        totalCashAmountGenerated += amount;
        cashDeliveries++;
      } else if (payType === 'account') {
        accountDeliveries++;
      }
    }

    // Get total customers
    const totalCustomers = await Customer.countDocuments();

    const metrics = {
      totalCustomers,
      pendingRequests: pendingRequests.length,
      processingRequests: processingRequests.length,
      urgentRequests: urgentRequests.length,
      deliveries: periodDeliveries.length,
      totalCans: totalCansForPeriod,
      totalAmountGenerated,
      totalCashAmountGenerated,
      cashDeliveries,
      accountDeliveries,
      timeLabel,
      startDate: startOfDay.toISOString(),
      endDate: endOfDay.toISOString(),
      timestamp: now.toISOString()
    };

    console.log(`📊 Metrics calculated:`, {
      deliveries: metrics.deliveries,
      totalCans: metrics.totalCans,
      totalAmount: metrics.totalAmountGenerated,
      cashAmount: metrics.totalCashAmountGenerated,
      timeLabel: metrics.timeLabel,
      periodDeliveriesCount: periodDeliveries.length
    });

    res.json(metrics);
  } catch (err) {
    console.error('Error fetching dashboard metrics:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics', details: err.message });
  }
});

// Test dashboard metrics endpoint
app.get('/api/test-dashboard', async (req, res) => {
  try {
    res.json({
      message: 'Dashboard metrics endpoint is working',
      timestamp: new Date().toISOString(),
      test: 'success'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Customer stats
app.get('/api/customers/:id/stats', async (req, res) => {
  try {
    console.log(`Fetching stats for customer ${req.params.id}...`);
    
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    console.log(`Customer found: ${customer.name}`);
    
    const { start, end } = req.query;
    let startDate, endDate;
    
    if (start && end) {
      startDate = new Date(start);
      endDate = new Date(end);
    } else {
      // Default to current month
      const now = new Date();
      const monthNum = now.getMonth() + 1;
      const yearNum = now.getFullYear();
      startDate = new Date(yearNum, monthNum - 1, 1);
      endDate = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);
        
        console.log(`Filtering for month ${monthNum}/${yearNum}: ${startDate} to ${endDate}`);
    }

    const deliveredRequests = await DeliveryRequest.find({
      customerId: req.params.id,
      status: 'delivered',
      deliveredAt: { $gte: startDate, $lte: endDate }
    });
    
    console.log(`Found ${deliveredRequests.length} delivered requests for customer ${customer.name}`);
    console.log('Delivered requests:', deliveredRequests.map(r => ({ 
      id: r._id, 
      cans: r.numberOfCans,
      amount: r.amount,
      date: r.deliveredAt
    })));
    
    const totalCans = deliveredRequests.reduce((sum, req) => sum + req.numberOfCans, 0);
    const totalAmount = deliveredRequests.reduce((sum, req) => sum + req.amount, 0);
    const totalDeliveries = deliveredRequests.length;
    
    const stats = {
      customerId: req.params.id,
      customerName: customer.name,
      period: { start: startDate, end: endDate },
      totalCans,
      totalAmount,
      totalDeliveries,
      averageCansPerDelivery: totalDeliveries > 0 ? (totalCans / totalDeliveries).toFixed(2) : 0,
      averageAmountPerDelivery: totalDeliveries > 0 ? (totalAmount / totalDeliveries).toFixed(2) : 0
    };
    
    console.log(`Customer ${customer.name} stats:`, stats);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching customer stats:', error);
    res.status(500).json({ error: 'Failed to fetch customer stats' });
  }
});

// Stats summary
app.get('/api/stats/summary', async (req, res) => {
  try {
    const { start, end } = req.query;
    console.log('Stats summary request:', { start, end });
    
    let startDate, endDate;
    
    if (start && end) {
      startDate = new Date(start);
      endDate = new Date(end);
    } else {
      // Default to current month
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    const match = {
      createdAt: { $gte: startDate, $lte: endDate }
    };

    console.log('MongoDB match query:', JSON.stringify(match, null, 2));

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          totalCans: { $sum: '$numberOfCans' },
          totalAmount: { $sum: '$amount' },
          cashAmount: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'cash'] }, '$amount', 0] } },
          accountAmount: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'account'] }, '$amount', 0] } }
        }
      }
    ];

    console.log('Aggregation pipeline:', JSON.stringify(pipeline, null, 2));

    const results = await DeliveryRequest.aggregate(pipeline);
    console.log('Aggregation results count:', results.length);
    console.log('First 3 results:', results.slice(0, 3));
    
    const data = results.length > 0 ? results[0] : {
      totalRequests: 0,
      totalCans: 0,
      totalAmount: 0,
      cashAmount: 0,
      accountAmount: 0
    };

    console.log('Mapped data:', data);

    res.json({
      period: { start: startDate, end: endDate },
      summary: data
    });
  } catch (error) {
    console.error('Error fetching stats summary:', error);
    res.status(500).json({ error: 'Failed to fetch stats summary' });
  }
});

// Check active requests
app.get('/api/customers/:id/active-requests', async (req, res) => {
  try {
    console.log(`Checking active requests for customer ${req.params.id}...`);
    
    const activeRequests = await DeliveryRequest.find({
      customerId: req.params.id,
      status: { $in: ['pending', 'processing'] }
    });
    
    console.log(`Customer ${req.params.id} has ${activeRequests.length} active requests`);
    
    res.json({ 
      customerId: req.params.id,
      activeRequests: activeRequests.length,
      requests: activeRequests
    });
  } catch (error) {
    console.error('Error checking active requests:', error);
    res.status(500).json({ error: 'Failed to check active requests' });
  }
});

// Backfill endpoint for data consistency
app.post('/api/admin/backfill', async (req, res) => {
  try {
    // Get all customers and find the maximum customerId
    const customers = await Customer.find().sort({ customerId: -1 });
    const currentMaxId = customers.length > 0 ? customers[0].customerId : 0;

    // Update counter to match the maximum ID
    await Counter.findOneAndUpdate(
      { name: 'customerId' },
      { value: currentMaxId },
      { upsert: true }
    );

    // Update any customers with missing customerId
    let updatedCustomers = 0;
    for (let i = 0; i < customers.length; i++) {
      if (!customers[i].customerId) {
        customers[i].customerId = i + 1;
        await customers[i].save();
        updatedCustomers++;
      }
    }

    // Update any delivery requests with missing customer references
    const requests = await DeliveryRequest.find();
    let updatedRequests = 0;
    for (const request of requests) {
      if (!request.customerId) {
        // Find customer by phone number
        const customer = await Customer.findOne({ phone: request.customerPhone });
        if (customer) {
          request.customerId = customer._id;
          await request.save();
          updatedRequests++;
        }
      }
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

// Recurring Requests routes
app.get('/api/recurring-requests', async (req, res) => {
  try {
    console.log('Fetching recurring requests from database...');
    const requests = await RecurringRequest.find().sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    console.error('Error fetching recurring requests:', error);
    res.status(500).json({ error: 'Failed to fetch recurring requests' });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend running on http://0.0.0.0:${PORT}`);
  console.log(`🔍 Health check: http://0.0.0.0:${PORT}/api/health`);
}); 