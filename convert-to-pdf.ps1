# PowerShell script to convert HTML report to PDF
# PAANI Project Report Converter

Write-Host "🚀 PAANI Project Report PDF Converter" -ForegroundColor Green
Write-Host "=" * 50

$htmlFile = "PAANI_PROJECT_REPORT.html"
$pdfFile = "PAANI_PROJECT_REPORT.pdf"

# Check if HTML file exists
if (-not (Test-Path $htmlFile)) {
    Write-Host "❌ Error: $htmlFile not found!" -ForegroundColor Red
    exit 1
}

Write-Host "📄 HTML Report found: $htmlFile" -ForegroundColor Green

# Method 1: Using Chrome/Edge headless (Recommended)
Write-Host "`n🔄 Method 1: Using Chrome/Edge Headless" -ForegroundColor Yellow
Write-Host "Copy and run this command:" -ForegroundColor Cyan

$chromeCommand = 'chrome --headless --disable-gpu --print-to-pdf="' + $pdfFile + '" "' + (Resolve-Path $htmlFile).Path + '"'
Write-Host $chromeCommand -ForegroundColor White

Write-Host "`nOr if you have Microsoft Edge:" -ForegroundColor Cyan
$edgeCommand = 'msedge --headless --disable-gpu --print-to-pdf="' + $pdfFile + '" "' + (Resolve-Path $htmlFile).Path + '"'
Write-Host $edgeCommand -ForegroundColor White

# Method 2: Open in browser for manual save
Write-Host "`n🔄 Method 2: Manual Browser Save" -ForegroundColor Yellow
Write-Host "1. Opening HTML file in default browser..." -ForegroundColor Cyan

try {
    Start-Process $htmlFile
    Write-Host "✅ HTML file opened in browser" -ForegroundColor Green
    Write-Host "2. Press Ctrl+P and select 'Save as PDF'" -ForegroundColor Cyan
    Write-Host "3. Use these print settings for best results:" -ForegroundColor Cyan
    Write-Host "   - Paper size: A4" -ForegroundColor White
    Write-Host "   - Margins: Minimum" -ForegroundColor White
    Write-Host "   - Include background graphics: Yes" -ForegroundColor White
    Write-Host "   - Scale: Fit to page width" -ForegroundColor White
} catch {
    Write-Host "❌ Could not open browser automatically" -ForegroundColor Red
    Write-Host "Please manually open: $htmlFile" -ForegroundColor Yellow
}

# Method 3: Online converter suggestion
Write-Host "`n🔄 Method 3: Online Converter" -ForegroundColor Yellow
Write-Host "Upload the HTML file to any of these online converters:" -ForegroundColor Cyan
Write-Host "• https://www.ilovepdf.com/html-to-pdf" -ForegroundColor White
Write-Host "• https://pdfcrowd.com/html-to-pdf/" -ForegroundColor White
Write-Host "• https://www.sejda.com/html-to-pdf" -ForegroundColor White

Write-Host "`n📋 Report Statistics:" -ForegroundColor Green
Write-Host "• File size: $((Get-Item $htmlFile).Length / 1KB) KB" -ForegroundColor White
Write-Host "• Total lines: 1,008 lines" -ForegroundColor White
Write-Host "• Sections: 12 detailed sections" -ForegroundColor White
Write-Host "• Content: Complete technical documentation" -ForegroundColor White

Write-Host "`n✅ Report Generation Complete!" -ForegroundColor Green
Write-Host "The HTML report is ready for PDF conversion." -ForegroundColor White 