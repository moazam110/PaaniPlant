#!/usr/bin/env pwsh
# Paani Delivery System - Environment Setup Script
# This script helps you create environment files from examples

Write-Host "🌍 Paani Delivery System - Environment Setup" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green

# Check if environment files already exist
$frontendEnvExists = Test-Path ".env.local"
$backendEnvExists = Test-Path "backend\.env"

if ($frontendEnvExists -or $backendEnvExists) {
    Write-Host "⚠️  Environment files already exist:" -ForegroundColor Yellow
    if ($frontendEnvExists) { Write-Host "   - .env.local (Frontend)" -ForegroundColor Yellow }
    if ($backendEnvExists) { Write-Host "   - backend\.env (Backend)" -ForegroundColor Yellow }
    Write-Host ""
    
    $overwrite = Read-Host "Do you want to overwrite them? (y/N)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "Setup cancelled. Environment files unchanged." -ForegroundColor Gray
        exit
    }
}

# Create frontend environment file
Write-Host "📁 Setting up Frontend Environment..." -ForegroundColor Cyan
if (Test-Path "env.example") {
    Copy-Item "env.example" ".env.local" -Force
    Write-Host "✅ Created .env.local from env.example" -ForegroundColor Green
} else {
    Write-Host "❌ env.example not found. Creating basic .env.local..." -ForegroundColor Red
    @"
# Frontend Environment Variables
# Edit these values for your setup

# API Configuration (REQUIRED)
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000

# Development Ports (Optional)
NEXT_PUBLIC_FRONTEND_PORT=9002
NEXT_PUBLIC_BACKEND_PORT=4000

# Feature Flags (Optional)
NEXT_PUBLIC_ENABLE_DEBUG_LOGGING=false
NEXT_PUBLIC_ENABLE_ANALYTICS=false
"@ | Out-File -FilePath ".env.local" -Encoding UTF8
    Write-Host "✅ Created basic .env.local" -ForegroundColor Green
}

# Create backend environment file
Write-Host "🔧 Setting up Backend Environment..." -ForegroundColor Cyan
if (Test-Path "backend\env.example") {
    Copy-Item "backend\env.example" "backend\.env" -Force
    Write-Host "✅ Created backend\.env from env.example" -ForegroundColor Green
} else {
    Write-Host "❌ backend\env.example not found. Creating basic backend\.env..." -ForegroundColor Red
    @"
# Backend Environment Variables
# Edit these values for your setup

# Server Configuration
PORT=4000
NODE_ENV=development

# Database Configuration (REQUIRED)
MONGO_URI=mongodb://localhost:27017/your-database-name

# Security (REQUIRED)
JWT_SECRET=dev-secret-key-change-in-production
SESSION_SECRET=dev-session-secret-change-in-production

# CORS Configuration
CORS_ORIGIN=http://localhost:9002

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# File Upload
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads

# Logging
LOG_LEVEL=info
ENABLE_REQUEST_LOGGING=true
"@ | Out-File -FilePath "backend\.env" -Encoding UTF8
    Write-Host "✅ Created basic backend\.env" -ForegroundColor Green
}

Write-Host ""
Write-Host "🎉 Environment setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor White
Write-Host "1. Edit .env.local with your frontend configuration" -ForegroundColor Gray
Write-Host "2. Edit backend\.env with your backend configuration" -ForegroundColor Gray
Write-Host "3. Set MONGO_URI to your MongoDB connection string" -ForegroundColor Gray
Write-Host "4. Generate strong JWT_SECRET and SESSION_SECRET values" -ForegroundColor Gray
Write-Host "5. Run 'npm install' in both root and backend directories" -ForegroundColor Gray
Write-Host "6. Start servers with './start-servers.ps1'" -ForegroundColor Gray
Write-Host ""
Write-Host "🔐 Security Reminder:" -ForegroundColor Yellow
Write-Host "- Never commit .env files to version control" -ForegroundColor Gray
Write-Host "- Use strong, unique secrets for production" -ForegroundColor Gray
Write-Host "- Keep your MongoDB credentials secure" -ForegroundColor Gray
Write-Host ""
Write-Host "📚 For detailed instructions, see ENVIRONMENT_SETUP.md" -ForegroundColor Cyan
