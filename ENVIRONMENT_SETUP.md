# 🌍 Environment Configuration Guide

This guide explains how to set up environment variables for the Paani Delivery System to ensure security and flexibility.

## 🚨 Security Notice

**NEVER commit actual environment files (`.env`, `.env.local`) to version control!**
- These files contain sensitive information like database credentials
- Only commit the example files (`.env.example`, `env.example`)
- Add actual environment files to `.gitignore`

## 📁 Frontend Environment Setup

### 1. Create Environment File
Copy the example file and create your actual environment file:
```bash
# Copy the example
cp env.example .env.local

# Edit with your actual values
nano .env.local  # or use your preferred editor
```

### 2. Required Variables
```bash
# API Configuration (REQUIRED)
NEXT_PUBLIC_API_BASE_URL=https://your-backend-domain.com

# Development Ports (Optional - will use defaults)
NEXT_PUBLIC_FRONTEND_PORT=9002
NEXT_PUBLIC_BACKEND_PORT=4000

# Feature Flags (Optional)
NEXT_PUBLIC_ENABLE_DEBUG_LOGGING=false
NEXT_PUBLIC_ENABLE_ANALYTICS=false
```

### 3. Environment-Specific Examples

#### Local Development
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_FRONTEND_PORT=9002
NEXT_PUBLIC_BACKEND_PORT=4000
```

#### Production
```bash
NEXT_PUBLIC_API_BASE_URL=https://your-backend-domain.com
NEXT_PUBLIC_FRONTEND_PORT=3000
NEXT_PUBLIC_BACKEND_PORT=4000
```

## 🔧 Backend Environment Setup

### 1. Create Environment File
```bash
cd backend
cp env.example .env

# Edit with your actual values
nano .env  # or use your preferred editor
```

### 2. Required Variables
```bash
# Server Configuration
PORT=4000
NODE_ENV=development

# Database Configuration (REQUIRED)
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority

# Security (REQUIRED)
JWT_SECRET=your-super-secret-jwt-key-here
SESSION_SECRET=your-session-secret-key-here

# CORS Configuration
CORS_ORIGIN=http://localhost:9002,https://your-frontend-domain.com
```

### 3. Environment-Specific Examples

#### Local Development
```bash
PORT=4000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/your-database-name
JWT_SECRET=dev-secret-key-change-in-production
SESSION_SECRET=dev-session-secret-change-in-production
CORS_ORIGIN=http://localhost:9002
```

#### Production
```bash
PORT=4000
NODE_ENV=production
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/your-database?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-here
SESSION_SECRET=your-super-secret-session-key-here
CORS_ORIGIN=https://your-frontend-domain.com
```

## 🔐 Security Best Practices

### 1. Strong Secrets
- Use long, random strings for secrets
- Generate unique secrets for each environment
- Never reuse secrets across projects

### 2. Database Security
- Use environment-specific database URLs
- Avoid hardcoding credentials in code
- Use read-only database users when possible

### 3. CORS Configuration
- Restrict CORS origins to only necessary domains
- Don't use `*` in production
- Include both HTTP and HTTPS versions if needed

## 🚀 Deployment Configuration

### Frontend Deployment (Vercel, Netlify, etc.)
Set these environment variables in your hosting platform:
```bash
NEXT_PUBLIC_API_BASE_URL=https://your-backend-domain.com
```

### Backend Deployment (Render, Heroku, etc.)
Set these environment variables in your hosting platform:
```bash
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/your-database
JWT_SECRET=your-production-secret
SESSION_SECRET=your-production-session-secret
CORS_ORIGIN=https://your-frontend-domain.com
NODE_ENV=production
```

## 🔍 Troubleshooting

### Common Issues

#### 1. "MONGO_URI environment variable is required"
- Ensure `.env` file exists in backend directory
- Check that `MONGO_URI` is properly set
- Verify file permissions

#### 2. "NEXT_PUBLIC_API_BASE_URL environment variable is required"
- Ensure `.env.local` file exists in root directory
- Check that `NEXT_PUBLIC_API_BASE_URL` is properly set
- Restart frontend development server

#### 3. CORS Errors
- Verify `CORS_ORIGIN` includes your frontend domain
- Check that backend is accessible from frontend
- Ensure protocol (HTTP/HTTPS) matches

### Debug Commands
```bash
# Check environment variables
echo $NEXT_PUBLIC_API_BASE_URL
echo $MONGO_URI

# Test backend connection
curl http://localhost:4000/api/health

# Check frontend environment
npm run dev
# Look for console logs showing environment variables
```

## 📋 Environment File Checklist

### Frontend (`.env.local`)
- [ ] `NEXT_PUBLIC_API_BASE_URL` set
- [ ] Port configurations (optional)
- [ ] Feature flags (optional)

### Backend (`.env`)
- [ ] `MONGO_URI` set
- [ ] `JWT_SECRET` set
- [ ] `SESSION_SECRET` set
- [ ] `PORT` configured
- [ ] `NODE_ENV` set
- [ ] `CORS_ORIGIN` configured

## 🎯 Next Steps

1. **Create environment files** using the examples above
2. **Test locally** to ensure everything works
3. **Deploy backend** with production environment variables
4. **Deploy frontend** with production environment variables
5. **Verify connections** in production environment

## 📚 Additional Resources

- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Node.js Environment Variables](https://nodejs.org/docs/latest/api/process.html#processenv)
- [MongoDB Connection String Format](https://docs.mongodb.com/manual/reference/connection-string/)
- [CORS Configuration](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
