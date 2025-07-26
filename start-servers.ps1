#!/usr/bin/env pwsh
# Paani Delivery System - Server Startup Script
# Run this script to start both backend and frontend servers

Write-Host "🚀 Starting Paani Delivery System..." -ForegroundColor Green

# Function to check if a port is in use
function Test-Port {
    param([int]$Port)
    $connection = Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue
    return $connection.TcpTestSucceeded
}

# Function to kill Node.js processes if needed
function Stop-NodeProcesses {
    Write-Host "🛑 Stopping existing Node.js processes..." -ForegroundColor Yellow
    try {
        taskkill /f /im node.exe 2>$null
        Start-Sleep 2
    } catch {
        Write-Host "No Node.js processes to kill" -ForegroundColor Gray
    }
}

# Check if ports are in use and kill processes if needed
$backendRunning = Test-Port -Port 4000
$frontendRunning = Test-Port -Port 9002

if ($backendRunning -or $frontendRunning) {
    Write-Host "⚠️  Ports 4000 or 9002 are in use. Cleaning up..." -ForegroundColor Yellow
    Stop-NodeProcesses
}

# Start Backend Server
Write-Host "🔧 Starting Backend Server (MongoDB + Express)..." -ForegroundColor Cyan
Start-Process PowerShell -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; npm run dev" -WindowStyle Normal

# Wait a bit for backend to start
Start-Sleep 5

# Verify backend is running
Write-Host "🔍 Checking backend health..." -ForegroundColor Blue
try {
    $response = Invoke-RestMethod -Uri "http://localhost:4000/api/health" -Method Get -TimeoutSec 10
    if ($response.status -eq "OK") {
        Write-Host "✅ Backend is running and healthy!" -ForegroundColor Green
        Write-Host "📊 Database status: $($response.database)" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Backend health check failed. Check the backend window for errors." -ForegroundColor Red
    Read-Host "Press Enter to continue or Ctrl+C to exit"
}

# Start Frontend Server
Write-Host "🎨 Starting Frontend Server (Next.js)..." -ForegroundColor Cyan
Start-Process PowerShell -ArgumentList "-NoExit", "-Command", "npm run dev" -WindowStyle Normal

# Wait for frontend to start
Start-Sleep 5

Write-Host "🌟 Startup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "🔗 Access your application:" -ForegroundColor White
Write-Host "   Frontend: http://localhost:9002" -ForegroundColor Cyan
Write-Host "   Backend:  http://localhost:4000" -ForegroundColor Cyan
Write-Host "   Health:   http://localhost:4000/api/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Troubleshooting:" -ForegroundColor White
Write-Host "   - If you see 'Failed to fetch' errors, run this script again" -ForegroundColor Gray
Write-Host "   - Check both PowerShell windows for error messages" -ForegroundColor Gray
Write-Host "   - Visit http://localhost:4000/api/health to verify backend" -ForegroundColor Gray
Write-Host ""
Write-Host "Press any key to exit this window..." -ForegroundColor Yellow
Read-Host 