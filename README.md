b# PAANI RO PLANT - Delivery Management System

A comprehensive water delivery management system built with Next.js, React, and Express.js. This system provides separate dashboards for Admin, Staff, and Customers to manage water delivery requests efficiently.

## 🌟 Features

### Admin Dashboard
- **Delivery Request Management**: Create, edit, and manage delivery requests
- **Customer Management**: Add, edit, and manage customer information
- **Real-time Updates**: WebSocket-powered real-time synchronization
- **Advanced Filtering**: Filter requests by date, payment type, cans, price, and status
- **Statistics Dashboard**: View comprehensive delivery statistics and metrics
- **Recurring Requests**: Manage automated recurring delivery requests
- **Customer Access Management**: Grant/revoke customer dashboard access and manage credentials
- **Dark Mode**: Toggle between light and dark themes
- **All Customers View**: Quick access to all customers for manual request creation

### Staff Dashboard
- **Request Queue**: View and manage delivery requests
- **Status Updates**: Mark requests as processing or delivered
- **Real-time Sync**: Instant updates via WebSocket
- **Request Filtering**: Filter by status, priority, and date

### Customer Dashboard
- **Request History**: View personal delivery request history with status tracking
- **Create Requests**: Submit new delivery requests
- **Billing Statistics**: View monthly billing and delivery statistics
- **Date Filtering**: Filter requests by date range
- **Real-time Updates**: Automatic status updates synchronized with admin dashboard

## 🚀 Tech Stack .

### Frontend
- **Framework**: Next.js 15.3.3 (React 18.3.1)
- **Styling**: Tailwind CSS with custom animations
- **UI Components**: Radix UI primitives
- **Forms**: React Hook Form with Zod validation
- **Real-time**: WebSocket integration
- **State Management**: React Hooks (useState, useEffect, useMemo)
- **Date Handling**: date-fns

### Backend
- **Runtime**: Node.js with Express.js
- **Database**: MongoDB with Mongoose
- **Real-time**: WebSocket (ws)
- **Caching**: Node-cache for performance optimization
- **File Upload**: Multer for image uploads

## 📋 Prerequisites

- Node.js 18+ and npm
- MongoDB database
- Modern web browser

## 🛠️ Installation

### 1. Clone the repository
```bash
git clone <repository-url>
cd PaaniPlant-feature-mobile-ui
```

### 2. Install Frontend Dependencies
```bash
npm install
```

### 3. Install Backend Dependencies
```bash
cd backend
npm install
cd ..
```

### 4. Environment Setup

Create a `.env` file in the root directory:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
MONGODB_URI=your_mongodb_connection_string
PORT=4000
```

Create a `.env.local` file for Next.js (optional):
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

### 5. Start Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

The application will be available at:
- Frontend: http://localhost:9002
- Backend API: http://localhost:4000

## 📁 Project Structure

```
PaaniPlant-feature-mobile-ui/
├── backend/
│   ├── index.js              # Express server and API endpoints
│   ├── websocket.js          # WebSocket server implementation
│   ├── middleware/          # Express middleware
│   └── package.json
├── src/
│   ├── app/                  # Next.js app router pages
│   │   ├── admin/           # Admin dashboard pages
│   │   ├── staff/           # Staff dashboard pages
│   │   ├── customer/        # Customer dashboard pages
│   │   └── page.tsx         # Landing page
│   ├── components/          # React components
│   │   ├── admin/          # Admin-specific components
│   │   ├── customer/       # Customer-specific components
│   │   ├── staff/          # Staff-specific components
│   │   └── ui/             # Reusable UI components
│   ├── hooks/               # Custom React hooks
│   ├── lib/                # Utility functions and API clients
│   ├── contexts/           # React contexts (Theme, etc.)
│   └── types/              # TypeScript type definitions
├── public/                  # Static assets
└── package.json
```

## 🔐 Authentication

### Admin & Staff
- Hardcoded credentials (for development)
- Admin: `admin@paani.com` / `admin123`
- Staff: `staff@paani.com` / `staff123`

### Customer
- Username/password managed by admin
- Credentials stored securely with password hashing
- Dashboard access can be granted/revoked by admin

## 🌐 API Endpoints

### Delivery Requests
- `GET /api/delivery-requests` - Get all delivery requests (with pagination)
- `POST /api/delivery-requests` - Create new delivery request
- `PUT /api/delivery-requests/:id/status` - Update request status
- `POST /api/delivery-requests/:id/cancel` - Cancel request

### Customers
- `GET /api/customers` - Get all customers (with pagination and filtering)
- `POST /api/customers` - Create new customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer
- `GET /api/customers/:id/stats` - Get customer statistics

### Customer Credentials
- `GET /api/customer-credentials` - Get all customer credentials
- `POST /api/customer-credentials` - Create/update customer credentials
- `POST /api/customer-credentials/login` - Customer login
- `PUT /api/customer-credentials/:customerId` - Update credentials
- `DELETE /api/customer-credentials/:customerId` - Delete credentials

### Dashboard Metrics
- `GET /api/dashboard/metrics` - Get dashboard statistics

## 🎨 UI Features

- **Web3-Inspired Design**: Modern, vibrant landing page with animated gradients
- **Glassmorphism**: Frosted glass effects on cards and dialogs
- **Responsive Design**: Mobile-first approach with breakpoints
- **Dark Mode**: Available for admin dashboard
- **Real-time Animations**: Smooth transitions and loading states

## 🔄 Real-time Updates

The system uses WebSocket for real-time synchronization:
- Delivery request updates broadcast instantly
- Dashboard metrics refresh automatically
- Customer logout events for access revocation
- Multi-client synchronization

## 📊 Key Features

### Search & Filtering
- **Fast Search**: Backend-powered search for customers and requests
- **ID Search**: Search customers by numeric ID
- **Advanced Filters**: Date range, payment type, cans, price filters
- **Address Sorting**: Sort requests by delivery address

### Request Management
- **Status Tracking**: Pending → Processing → Delivered workflow
- **Priority Levels**: Normal and Urgent requests
- **Cancellation**: Cancel requests with reason tracking
- **Duplicate Prevention**: Prevents duplicate active requests per customer

### Customer Access
- **Granular Control**: Grant/revoke access per customer
- **Credential Management**: Generate and manage usernames/passwords
- **Automatic Sign-out**: Customers auto-logout when access is revoked

## 🧪 Development

### Running Tests
```bash
npm run typecheck  # TypeScript type checking
npm run lint       # ESLint checking
```

### Building for Production
```bash
npm run build
npm start
```

## 📝 Notes

- The system uses MongoDB for data persistence
- WebSocket server runs on the same port as the Express server
- Customer passwords are hashed using Node.js crypto
- Real-time updates require WebSocket connection
- Dark mode is only available for admin dashboard

## 🤝 Contributing

1. Follow the existing code style
2. Ensure TypeScript types are properly defined
3. Test all features before submitting
4. Update documentation for new features

## 📄 License

See LICENSE file for details.

## 🔗 Links

- Website: www.paani.online
- Admin Dashboard: `/admin`
- Staff Dashboard: `/staff`
- Customer Dashboard: `/customer/dashboard`

---

**Version**: 1.0.0  
**Last Updated**: December 2025

