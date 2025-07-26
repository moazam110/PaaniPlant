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

// Mongoose Customer schema/model
const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, default: '' },
  address: { type: String, required: true },
  defaultCans: { type: Number, default: 1 },
  pricePerCan: { type: Number, required: true, min: 1, max: 999 },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Customer = mongoose.model('Customer', customerSchema);

// Mongoose DeliveryRequest schema/model
const deliveryRequestSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
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
});

const DeliveryRequest = mongoose.model('DeliveryRequest', deliveryRequestSchema);

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
    const customers = await Customer.find().sort({ createdAt: -1 });
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
    console.log('Received customer data:', JSON.stringify(req.body, null, 2));
    
    // Validate required fields
    if (!req.body.name || !req.body.address) {
      console.log('Validation failed: Missing required fields');
      return res.status(400).json({ 
        error: 'Missing required fields', 
        details: 'Name and address are required' 
      });
    }

    // Validate pricePerCan
    const pricePerCan = Number(req.body.pricePerCan);
    if (!req.body.pricePerCan || isNaN(pricePerCan) || pricePerCan < 1 || pricePerCan > 999) {
      console.log('Validation failed: Invalid price per can');
      return res.status(400).json({ 
        error: 'Invalid price per can', 
        details: 'Price per can is required and must be between 1 and 999' 
      });
    }

    const customerData = {
      name: req.body.name.trim(),
      phone: req.body.phone || '',
      address: req.body.address.trim(),
      defaultCans: Number(req.body.defaultCans) || 1,
      pricePerCan: pricePerCan,
      notes: req.body.notes || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log('Sanitized customer data:', JSON.stringify(customerData, null, 2));
    console.log('Creating Mongoose document...');

    const customer = new Customer(customerData);
    console.log('Saving to MongoDB...');
    
    const savedCustomer = await customer.save();
    
    console.log('Customer saved successfully with ID:', savedCustomer._id);
    console.log('Saved customer:', JSON.stringify(savedCustomer, null, 2));
    
    res.status(201).json(savedCustomer);
  } catch (err) {
    console.error('=== ERROR CREATING CUSTOMER ===');
    console.error('Error details:', err);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
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
      if (isNaN(pricePerCan) || pricePerCan < 1 || pricePerCan > 999) {
        return res.status(400).json({ 
          error: 'Invalid price per can', 
          details: 'Price per can must be between 1 and 999' 
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

// Delivery Requests endpoints
app.get('/api/delivery-requests', async (req, res) => {
  try {
    console.log('Fetching delivery requests from database...');
    const requests = await DeliveryRequest.find().sort({ requestedAt: -1 });
    console.log(`Found ${requests.length} delivery requests`);
    res.json(requests);
  } catch (err) {
    console.error('Error fetching delivery requests:', err);
    res.status(500).json({ error: 'Failed to fetch delivery requests', details: err.message });
  }
});

app.post('/api/delivery-requests', async (req, res) => {
  try {
    console.log('Creating delivery request:', req.body);
    const request = new DeliveryRequest(req.body);
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
    
    const updateData = { status, updatedAt: new Date() };
    
    if (status === 'delivered') {
      updateData.deliveredAt = new Date();
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
    console.log(`Updating delivery request ${req.params.id}:`, req.body);
    const request = await DeliveryRequest.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }
    console.log('Delivery request updated:', request);
    res.json(request);
  } catch (err) {
    console.error('Error updating delivery request:', err);
    res.status(400).json({ error: 'Failed to update delivery request', details: err.message });
  }
});

// Dashboard metrics endpoint
app.get('/api/dashboard/metrics', async (req, res) => {
  try {
    console.log('Fetching dashboard metrics...');
    const totalCustomers = await Customer.countDocuments();
    const pendingRequests = await DeliveryRequest.countDocuments({ 
      status: { $in: ['pending', 'pending_confirmation'] } 
    });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayDeliveries = await DeliveryRequest.find({
      status: 'delivered',
      deliveredAt: { $gte: today, $lt: tomorrow }
    });
    
    const totalCansToday = todayDeliveries.reduce((sum, req) => sum + req.cans, 0);
    
    const metrics = {
      totalCustomers,
      pendingRequests,
      deliveriesToday: todayDeliveries.length,
      totalCansToday
    };
    
    console.log('Dashboard metrics:', metrics);
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
    
    // Get all delivered requests for this customer - handle both ObjectId and string formats
    const deliveredRequests = await DeliveryRequest.find({
      $or: [
        { customerId: req.params.id },
        { customerId: mongoose.Types.ObjectId.createFromHexString(req.params.id) }
      ],
      status: 'delivered'
    });
    
    console.log(`Found ${deliveredRequests.length} delivered requests for customer ${customer.name}`);
    console.log('Delivered requests:', deliveredRequests.map(r => ({ 
      id: r._id, 
      cans: r.cans, 
      customerId: r.customerId,
      status: r.status 
    })));
    
    const totalDeliveries = deliveredRequests.length;
    const totalCansReceived = deliveredRequests.reduce((sum, req) => sum + req.cans, 0);
    const totalPrice = totalCansReceived * customer.pricePerCan;
    
    const stats = {
      totalDeliveries,
      totalCansReceived,
      totalPrice,
      pricePerCan: customer.pricePerCan
    };
    
    console.log(`Customer ${customer.name} stats:`, stats);
    res.json(stats);
  } catch (err) {
    console.error('Error fetching customer stats:', err);
    res.status(500).json({ error: 'Failed to fetch customer stats', details: err.message });
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Test customer: http://localhost:${PORT}/api/test-customer`);
}); 