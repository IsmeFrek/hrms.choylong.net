# HRMS System Network Setup Script
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "    HRMS System Network Setup" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Get local IP address
$ipAddress = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi*", "Ethernet*" | Where-Object {$_.IPAddress -notlike "169.254.*" -and $_.IPAddress -ne "127.0.0.1"} | Select-Object -First 1).IPAddress

if ($ipAddress) {
    Write-Host "Your computer's IP address: " -NoNewline -ForegroundColor Yellow
    Write-Host $ipAddress -ForegroundColor Green
    Write-Host ""
    
    Write-Host "To access from other computers:" -ForegroundColor Yellow
    Write-Host "Frontend: " -NoNewline -ForegroundColor White
    Write-Host "https://$ipAddress:5173" -ForegroundColor Green
    Write-Host "Backend API: " -NoNewline -ForegroundColor White
    Write-Host "http://$ipAddress:5000" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "Setup Instructions:" -ForegroundColor Yellow
    Write-Host "1. Update .env file with: VITE_API_BASE_URL=http://$ipAddress:5000/api" -ForegroundColor White
    Write-Host "2. Make sure Windows Firewall allows ports 5000 and 5173 (HTTPS)" -ForegroundColor White
    Write-Host "3. Ensure all computers are on the same network" -ForegroundColor White
    Write-Host "4. Start both backend and frontend servers" -ForegroundColor White
    Write-Host ""
    
    # Ask if user wants to update .env file automatically
    $updateEnv = Read-Host "Do you want to update .env file automatically? (y/n)"
    if ($updateEnv -eq "y" -or $updateEnv -eq "Y") {
        $envContent = @"
# Frontend Environment Configuration
VITE_API_BASE_URL=http://$ipAddress:5000/api
VITE_APP_NAME=HRMS System
VITE_APP_VERSION=1.0.0

# Network Access Configuration
# This allows other computers to access the system
"@
        $envContent | Out-File -FilePath ".env" -Encoding UTF8
        Write-Host ".env file updated successfully!" -ForegroundColor Green
    }
    
} else {
    Write-Host "Could not detect IP address. Please check your network connection." -ForegroundColor Red
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Press any key to continue..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
