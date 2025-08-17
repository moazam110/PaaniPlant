import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import multer from 'multer';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';

// Load environment variables
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

app.use(cors());
app.use(bodyParser.json());

// MongoDB connection - Use environment variable
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI environment variable is required');
  console.error('Please create a .env file with your MongoDB connection string');
  process.exit(1);
}

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
  cancellationReason: { type: String, enum: ['door_closed', 'duplicate', 'other'] },
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
// Helpful indexes for scheduler performance (define on collection to ensure creation after model compile)
try {
  RecurringRequest.collection.createIndex({ nextRun: 1 }).catch(() => {});
  RecurringRequest.collection.createIndex({ customerId: 1 }).catch(() => {});
} catch {}

// Super Admin Schema
const superAdminSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true, immutable: true },
  username: { type: String, unique: true, required: true, immutable: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, default: 'super_admin', immutable: true },
  status: { type: String, enum: ['active', 'suspended', 'deleted'], default: 'active' },
  isSetupComplete: { type: Boolean, default: false },
  setupCompletedAt: { type: Date },
  lastLoginAt: { type: Date },
  loginAttempts: { type: Number, default: 0 },
  lockedUntil: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const SuperAdmin = mongoose.model('SuperAdmin', superAdminSchema);

// Admin User Schema (created by super admin)
const adminUserSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true, immutable: true },
  username: { type: String, unique: true, required: true, immutable: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['admin'], default: 'admin' },
  status: { type: String, enum: ['active', 'suspended', 'deleted'], default: 'active' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin', required: true },
  canModifyCredentials: { type: Boolean, default: false }, // Always false for regular admins
  lastLoginAt: { type: Date },
  loginAttempts: { type: Number, default: 0 },
  lockedUntil: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const AdminUser = mongoose.model('AdminUser', adminUserSchema);

// System Logs Schema
const systemLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now, index: true },
  user: { type: String, required: true },
  action: { type: String, required: true },
  ipAddress: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['authentication', 'admin_activity', 'security', 'system', 'database', 'email'],
    required: true 
  },
  severity: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low' 
  },
  details: { type: String, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
});

const SystemLog = mongoose.model('SystemLog', systemLogSchema);

// Security Events Schema
const securityEventSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now, index: true },
  type: { 
    type: String, 
    enum: ['failed_login', 'suspicious_ip', 'brute_force', 'account_locked', 'session_expired'],
    required: true 
  },
  user: { type: String },
  ipAddress: { type: String, required: true },
  details: { type: String, required: true },
  severity: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium' 
  },
  resolved: { type: Boolean, default: false },
  resolvedAt: { type: Date },
  resolvedBy: { type: String }
});

const SecurityEvent = mongoose.model('SecurityEvent', securityEventSchema);

// File upload setup
const upload = multer({ dest: 'uploads/' });



// JWT Secret - should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Rate limiting for authentication
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Super Admin only middleware
const requireSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
};

// Admin or Super Admin middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Logging utility
const logSystemActivity = async (user, action, ipAddress, type, severity, details, metadata = {}) => {
  try {
    await SystemLog.create({
      user,
      action,
      ipAddress,
      type,
      severity,
      details,
      metadata
    });
  } catch (error) {
    console.error('Failed to log system activity:', error);
  }
};

// Security event logging
const logSecurityEvent = async (type, ipAddress, details, severity = 'medium', user = null) => {
  try {
    await SecurityEvent.create({
      type,
      user,
      ipAddress,
      details,
      severity
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
};

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

// Super Admin Setup Route (one-time use)
app.post('/api/auth/super-admin-setup', async (req, res) => {
  try {
    // Check if super admin already exists
    const existingSuperAdmin = await SuperAdmin.findOne({ role: 'super_admin' });
    if (existingSuperAdmin) {
      return res.status(400).json({ 
        error: 'Super admin already exists. Setup cannot be performed again.' 
      });
    }

    const { email, username, password, name } = req.body;

    // Validate input
    if (!email || !username || !password || !name) {
      return res.status(400).json({ 
        error: 'All fields are required: email, username, password, name' 
      });
    }

    // Check if email or username already exists
    const existingUser = await SuperAdmin.findOne({ 
      $or: [{ email }, { username }] 
    });
    if (existingUser) {
      return res.status(400).json({ 
        error: 'Email or username already exists' 
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create super admin
    const superAdmin = new SuperAdmin({
      email,
      username,
      password: hashedPassword,
      name,
      role: 'super_admin',
      status: 'active',
      isSetupComplete: true,
      setupCompletedAt: new Date()
    });

    await superAdmin.save();

    // Log the setup
    await logSystemActivity(
      'system',
      'Super Admin Setup',
      req.ip,
      'system',
      'high',
      `Super admin account created: ${email}`,
      { username, name }
    );

    res.status(201).json({
      message: 'Super admin account created successfully',
      user: {
        id: superAdmin._id,
        email: superAdmin.email,
        username: superAdmin.username,
        name: superAdmin.name,
        role: superAdmin.role
      }
    });

  } catch (error) {
    console.error('Super admin setup error:', error);
    res.status(500).json({ error: 'Failed to create super admin account' });
  }
});

// Super Admin Login Route
app.post('/api/auth/super-admin-login', authRateLimit, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find super admin by username
    const superAdmin = await SuperAdmin.findOne({ username, role: 'super_admin' });
    if (!superAdmin) {
      await logSecurityEvent('failed_login', req.ip, `Failed login attempt for username: ${username}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if account is locked
    if (superAdmin.lockedUntil && superAdmin.lockedUntil > new Date()) {
      return res.status(423).json({ 
        error: 'Account is locked. Please try again later.',
        lockedUntil: superAdmin.lockedUntil
      });
    }

    // Check if account is suspended
    if (superAdmin.status !== 'active') {
      return res.status(423).json({ error: 'Account is suspended' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, superAdmin.password);
    if (!isValidPassword) {
      // Increment failed login attempts
      superAdmin.loginAttempts += 1;
      
      // Lock account after 5 failed attempts
      if (superAdmin.loginAttempts >= 5) {
        superAdmin.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        await logSecurityEvent('account_locked', req.ip, `Account locked due to multiple failed logins: ${username}`, 'high');
      }
      
      await superAdmin.save();
      await logSecurityEvent('failed_login', req.ip, `Failed login attempt for username: ${username}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Reset failed login attempts on successful login
    superAdmin.loginAttempts = 0;
    superAdmin.lockedUntil = null;
    superAdmin.lastLoginAt = new Date();
    await superAdmin.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: superAdmin._id, 
        username: superAdmin.username, 
        role: superAdmin.role,
        name: superAdmin.name
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Log successful login
    await logSystemActivity(
      superAdmin.username,
      'Login Success',
      req.ip,
      'authentication',
      'low',
      `Super admin logged in successfully`
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: superAdmin._id,
        username: superAdmin.username,
        name: superAdmin.name,
        role: superAdmin.role
      }
    });

  } catch (error) {
    console.error('Super admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Super Admin Dashboard API Routes

// Get dashboard metrics
app.get('/api/super-admin/dashboard', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    // Get admin statistics
    const totalAdmins = await AdminUser.countDocuments({ status: { $ne: 'deleted' } });
    const activeAdmins = await AdminUser.countDocuments({ status: 'active' });
    const suspendedAdmins = await AdminUser.countDocuments({ status: 'suspended' });

    // Get security statistics
    const failedLogins = await SecurityEvent.countDocuments({ 
      type: 'failed_login', 
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    });
    
    const suspiciousActivities = await SecurityEvent.countDocuments({ 
      type: { $in: ['suspicious_ip', 'brute_force'] },
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    // Get activity metrics
    const newAdmins = await AdminUser.countDocuments({ 
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    });

    const systemLogins = await SystemLog.countDocuments({ 
      type: 'authentication',
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    const actionsToday = await SystemLog.countDocuments({ 
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    // Log the dashboard access
    await logSystemActivity(
      req.user.username,
      'Dashboard Access',
      req.ip,
      'admin_activity',
      'low',
      'Super admin accessed dashboard'
    );

    res.json({
      systemStats: {
        totalAdmins,
        activeAdmins,
        suspendedAdmins,
        failedLogins,
        suspiciousActivities,
        lastSecurityScan: '2h ago' // This would be calculated based on actual security scans
      },
      activityMetrics: {
        newAdmins,
        systemLogins,
        actionsToday
      }
    });

  } catch (error) {
    console.error('Dashboard metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
});

// Admin Management Routes

// Get all admin users
app.get('/api/super-admin/admins', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const admins = await AdminUser.find({ status: { $ne: 'deleted' } })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json(admins);

  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({ error: 'Failed to fetch admin users' });
  }
});

// Create new admin user
app.post('/api/super-admin/admins', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { email, username, password, name } = req.body;

    // Validate input
    if (!email || !username || !password || !name) {
      return res.status(400).json({ 
        error: 'All fields are required: email, username, password, name' 
      });
    }

    // Check if email or username already exists
    const existingUser = await AdminUser.findOne({ 
      $or: [{ email }, { username }] 
    });
    if (existingUser) {
      return res.status(400).json({ 
        error: 'Email or username already exists' 
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create admin user
    const adminUser = new AdminUser({
      email,
      username,
      password: hashedPassword,
      name,
      role: 'admin',
      status: 'active',
      createdBy: req.user.id,
      canModifyCredentials: false
    });

    await adminUser.save();

    // Log the admin creation
    await logSystemActivity(
      req.user.username,
      'Create Admin',
      req.ip,
      'admin_activity',
      'medium',
      `New admin user created: ${email}`,
      { adminId: adminUser._id, adminUsername: username }
    );

    // Return admin details (without password)
    const adminData = adminUser.toObject();
    delete adminData.password;

    res.status(201).json({
      message: 'Admin user created successfully',
      admin: adminData,
      credentials: {
        username,
        password // Return plain password only once for super admin to share
      }
    });

  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ error: 'Failed to create admin user' });
  }
});

// Update admin user
app.put('/api/super-admin/admins/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, status, password } = req.body;

    const adminUser = await AdminUser.findById(id);
    if (!adminUser) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    // Update fields
    if (name) adminUser.name = name;
    if (status) adminUser.status = status;
    if (password) {
      const saltRounds = 12;
      adminUser.password = await bcrypt.hash(password, saltRounds);
    }

    adminUser.updatedAt = new Date();
    await adminUser.save();

    // Log the update
    await logSystemActivity(
      req.user.username,
      'Update Admin',
      req.ip,
      'admin_activity',
      'medium',
      `Admin user updated: ${adminUser.email}`,
      { adminId: id, updatedFields: Object.keys(req.body) }
    );

    const adminData = adminUser.toObject();
    delete adminData.password;

    res.json({
      message: 'Admin user updated successfully',
      admin: adminData
    });

  } catch (error) {
    console.error('Update admin error:', error);
    res.status(500).json({ error: 'Failed to update admin user' });
  }
});

// Delete admin user (soft delete)
app.delete('/api/super-admin/admins/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const adminUser = await AdminUser.findById(id);
    if (!adminUser) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    // Soft delete
    adminUser.status = 'deleted';
    adminUser.updatedAt = new Date();
    await adminUser.save();

    // Log the deletion
    await logSystemActivity(
      req.user.username,
      'Delete Admin',
      req.ip,
      'admin_activity',
      'high',
      `Admin user deleted: ${adminUser.email}`,
      { adminId: id }
    );

    res.json({ message: 'Admin user deleted successfully' });

  } catch (error) {
    console.error('Delete admin error:', error);
    res.status(500).json({ error: 'Failed to delete admin user' });
  }
});

// System Logs Routes

// Get system logs with filtering
app.get('/api/super-admin/logs', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { 
      type, 
      severity, 
      search, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 50 
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (type && type !== 'all') filter.type = type;
    if (severity && severity !== 'all') filter.severity = severity;
    
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    if (search) {
      filter.$or = [
        { user: { $regex: search, $options: 'i' } },
        { action: { $regex: search, $options: 'i' } },
        { details: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Get logs with pagination
    const logs = await SystemLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalLogs = await SystemLog.countDocuments(filter);

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalLogs,
        pages: Math.ceil(totalLogs / limit)
      }
    });

  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ error: 'Failed to fetch system logs' });
  }
});

// Export logs (placeholder for future implementation)
app.post('/api/super-admin/logs/export', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { type, severity, startDate, endDate } = req.body;

    // Build filter object
    const filter = {};
    
    if (type && type !== 'all') filter.type = type;
    if (severity && severity !== 'all') filter.severity = severity;
    
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const logs = await SystemLog.find(filter).sort({ timestamp: -1 });

    // Log the export
    await logSystemActivity(
      req.user.username,
      'Export Logs',
      req.ip,
      'admin_activity',
      'low',
      `Exported ${logs.length} log entries`,
      { type, severity, startDate, endDate }
    );

    res.json({
      message: 'Logs exported successfully',
      count: logs.length,
      logs
    });

  } catch (error) {
    console.error('Export logs error:', error);
    res.status(500).json({ error: 'Failed to export logs' });
  }
});

// Security Monitoring Routes

// Get security overview
app.get('/api/super-admin/security', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    // Get security statistics for last 24 hours
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const failedLogins = await SecurityEvent.countDocuments({ 
      type: 'failed_login', 
      timestamp: { $gte: last24Hours } 
    });
    
    const suspiciousIPs = await SecurityEvent.countDocuments({ 
      type: 'suspicious_ip',
      timestamp: { $gte: last24Hours }
    });
    
    const bruteForceAttempts = await SecurityEvent.countDocuments({ 
      type: 'brute_force',
      timestamp: { $gte: last24Hours }
    });

    // Get active sessions (this would need session management implementation)
    const activeSessions = 3; // Placeholder

    // Get locked accounts
    const lockedAccounts = await AdminUser.countDocuments({ 
      lockedUntil: { $gt: new Date() } 
    });

    // Get password expiry (this would need password policy implementation)
    const passwordExpiry = 2; // Placeholder

    // Get blocked IPs (this would need IP blocking implementation)
    const blockedIPs = 2; // Placeholder
    const whitelistedIPs = 5; // Placeholder

    res.json({
      securityStats: {
        failedLogins,
        suspiciousIPs,
        bruteForceAttempts,
        activeSessions,
        lockedAccounts,
        passwordExpiry,
        blockedIPs,
        whitelistedIPs,
        recentBlocked: 1 // Placeholder
      }
    });

  } catch (error) {
    console.error('Security overview error:', error);
    res.status(500).json({ error: 'Failed to fetch security overview' });
  }
});

// Get active sessions (placeholder)
app.get('/api/super-admin/security/sessions', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    // This would need actual session management implementation
    // For now, return placeholder data
    const activeSessions = [
      { id: '1', user: 'john_a', ip: '192.168.1.5', location: 'Office', lastActivity: '2 min ago' },
      { id: '2', user: 'sarah_m', ip: '192.168.1.10', location: 'Office', lastActivity: '15 min ago' },
      { id: '3', user: 'mike_k', ip: '192.168.1.15', location: 'Remote', lastActivity: '1 hour ago' }
    ];

    res.json(activeSessions);

  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch active sessions' });
  }
});

// Force logout all users (placeholder)
app.post('/api/super-admin/security/force-logout-all', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    // This would need actual session management implementation
    // For now, just log the action
    
    await logSystemActivity(
      req.user.username,
      'Force Logout All',
      req.ip,
      'security',
      'high',
      'Force logout all users initiated'
    );

    res.json({ message: 'Force logout initiated for all users' });

  } catch (error) {
    console.error('Force logout error:', error);
    res.status(500).json({ error: 'Failed to force logout users' });
  }
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
app.get('/api/delivery-requests', async (req, res) => {
  try {
    // On-demand tick before listing to surface newly generated requests immediately
    try { await tryGenerateFromRecurring(); } catch {}
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

    const request = new DeliveryRequest({
      ...req.body,
      pricePerCan,
      paymentType,
      customerIntId,
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

}); 