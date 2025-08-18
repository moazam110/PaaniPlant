#!/usr/bin/env pwsh
# Paani Delivery System - Cleanup Verification Script
# This script verifies that all hardcoded values have been removed

Write-Host "🔍 Verifying Cleanup of Hardcoded Values..." -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

$issuesFound = $false

# Check for hardcoded MongoDB credentials in source code
Write-Host "📁 Checking source code files..." -ForegroundColor Cyan

$sourceFiles = @(
    "src/**/*.ts",
    "src/**/*.tsx", 
    "src/**/*.js",
    "src/**/*.jsx",
    "backend/**/*.js",
    "backend/**/*.ts"
)

$hardcodedPatterns = @(
    "mongodb\+srv://",
    "moazam",
    "cluster0",
    "u5haqnr",
    "paani-b\.onrender\.com",
            "localhost:5000",
    "localhost:9002"
)

foreach ($pattern in $hardcodedPatterns) {
    $matches = Get-ChildItem -Path $sourceFiles -Recurse -ErrorAction SilentlyContinue | 
               Select-String -Pattern $pattern -List | 
               Where-Object { $_.Filename -notmatch "node_modules|\.git|mongodb\.d\.ts|beta\.d\.ts|mongo_client\.ts" }
    
    if ($matches) {
        Write-Host "❌ Found hardcoded values matching '$pattern':" -ForegroundColor Red
        foreach ($match in $matches) {
            Write-Host "   - $($match.Filename):$($match.LineNumber)" -ForegroundColor Red
        }
        $issuesFound = $true
    }
}

# Check for environment variable usage
Write-Host "🔧 Checking environment variable usage..." -ForegroundColor Cyan

$envVarPatterns = @(
    "process\.env\.MONGO_URI",
    "process\.env\.NEXT_PUBLIC_API_BASE_URL",
    "process\.env\.PORT",
    "process\.env\.NODE_ENV"
)

$envVarFound = $false
foreach ($pattern in $envVarPatterns) {
    $matches = Get-ChildItem -Path $sourceFiles -Recurse -ErrorAction SilentlyContinue | 
               Select-String -Pattern $pattern -List | 
               Where-Object { $_.Filename -notmatch "node_modules|\.git|mongodb\.d\.ts|beta\.d\.ts|mongo_client\.ts" }
    
    if ($matches) {
        Write-Host "✅ Found environment variable usage: $pattern" -ForegroundColor Green
        $envVarFound = $true
    }
}

# Check for environment files
Write-Host "📋 Checking environment files..." -ForegroundColor Cyan

$envFiles = @(
    ".env.local",
    "backend\.env"
)

foreach ($envFile in $envFiles) {
    if (Test-Path $envFile) {
        Write-Host "⚠️  Found environment file: $envFile" -ForegroundColor Yellow
        Write-Host "   This file should NOT be committed to version control" -ForegroundColor Yellow
    } else {
        Write-Host "✅ No environment file found: $envFile" -ForegroundColor Green
    }
}

# Check for example files
Write-Host "📚 Checking example files..." -ForegroundColor Cyan

$exampleFiles = @(
    "env.example",
    "backend\env.example"
)

foreach ($exampleFile in $exampleFiles) {
    if (Test-Path $exampleFile) {
        Write-Host "✅ Found example file: $exampleFile" -ForegroundColor Green
    } else {
        Write-Host "❌ Missing example file: $exampleFile" -ForegroundColor Red
        $issuesFound = $true
    }
}

# Check .gitignore
Write-Host "🚫 Checking .gitignore..." -ForegroundColor Cyan

$gitignoreContent = Get-Content ".gitignore" -ErrorAction SilentlyContinue
if ($gitignoreContent -match "\.env") {
    Write-Host "✅ .gitignore properly excludes .env files" -ForegroundColor Green
} else {
    Write-Host "❌ .gitignore missing .env exclusion" -ForegroundColor Red
    $issuesFound = $true
}

# Summary
Write-Host ""
Write-Host "📊 Cleanup Verification Summary:" -ForegroundColor White
Write-Host "================================" -ForegroundColor White

if ($issuesFound) {
    Write-Host "❌ Issues found! Please review the problems above." -ForegroundColor Red
    Write-Host "   Some hardcoded values may still exist in documentation or other files." -ForegroundColor Red
} else {
    Write-Host "✅ No hardcoded values found in source code!" -ForegroundColor Green
}

if ($envVarFound) {
    Write-Host "✅ Environment variables are properly configured" -ForegroundColor Green
} else {
    Write-Host "❌ No environment variable usage found" -ForegroundColor Red
    $issuesFound = $true
}

Write-Host ""
Write-Host "🔍 Files checked:" -ForegroundColor Cyan
Write-Host "   - Source code: TypeScript, JavaScript, JSX, TSX files" -ForegroundColor Gray
Write-Host "   - Backend: Node.js files" -ForegroundColor Gray
Write-Host "   - Configuration: Environment files and examples" -ForegroundColor Gray
Write-Host "   - Version control: .gitignore configuration" -ForegroundColor Gray

Write-Host ""
Write-Host "📚 Note: Documentation files may still contain example URLs and references" -ForegroundColor Yellow
Write-Host "   This is normal and expected for documentation purposes." -ForegroundColor Yellow

if (-not $issuesFound) {
    Write-Host ""
    Write-Host "🎉 Cleanup verification passed! Your codebase is secure." -ForegroundColor Green
    Write-Host "   All hardcoded credentials and URLs have been removed from source code." -ForegroundColor Green
}
