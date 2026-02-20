@echo off
echo ======================================
echo    HRMS System Network Setup
echo ======================================
echo.

REM Get the local IP address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    set "ip=%%a"
    set "ip=!ip: =!"
    if not "!ip!"=="" (
        echo Your computer's IP address: !ip!
        echo.
        echo To access from other computers:
        echo Frontend: https://!ip!:5173
        echo Backend API: http://!ip!:5000
        echo.
        echo Don't forget to:
        echo 1. Update .env file with your IP address
        echo 2. Make sure Windows Firewall allows these ports
        echo 3. Ensure all computers are on same network
        echo.
        goto :found
    )
)

:found
echo ======================================
echo Starting HRMS System...
echo ======================================
pause
