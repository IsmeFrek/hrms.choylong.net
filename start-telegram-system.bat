@echo off
title Telegram Webhook Setup
color 0A

echo ============================================
echo   TELEGRAM WEBHOOK AUTO-SETUP
echo ============================================
echo.

REM Kill existing node processes
echo Stopping existing servers...
taskkill /F /IM node.exe 2>nul
taskkill /F /IM cloudflared.exe 2>nul
timeout /t 2 /nobreak >nul

REM Start backend server
echo [1/3] Starting backend server...
start "Backend Server" cmd /k "cd /d D:\DB\web_V4\backend && node server.js"
timeout /t 3 /nobreak >nul

REM Set PATH to find cloudflared
set PATH=%PATH%;C:\Program Files (x86)\cloudflared

REM Start Cloudflare tunnel
echo [2/3] Starting Cloudflare tunnel...
start "Cloudflare Tunnel" cmd /k "cd /d D:\DB\web_V4 && cloudflared tunnel --url http://localhost:5000"
echo.
echo Waiting for tunnel to start (20 seconds)...
timeout /t 20 /nobreak

REM Set webhook
echo [3/3] Setting webhook...
echo.
echo Please check the "Cloudflare Tunnel" window for the URL
echo It should look like: https://xxxxx.trycloudflare.com
echo.
set /p TUNNEL_URL="Enter the tunnel URL: "

if "%TUNNEL_URL%"=="" (
    echo ERROR: No URL provided
    pause
    exit /b 1
)

echo.
echo Setting webhook to: %TUNNEL_URL%
cd /d D:\DB\web_V4\backend
node setup-telegram-webhook.js %TUNNEL_URL%

echo.
echo ============================================
echo   SETUP COMPLETE!
echo ============================================
echo.
echo Backend and tunnel are running in separate windows
echo You can now test in Telegram!
echo.
pause
echo 1. Look at the "Cloudflare Tunnel" window
echo 2. Find the URL (example: https://xxxxx.trycloudflare.com)
echo 3. Copy that URL
echo.
echo 4. Open PowerShell and run:
echo    cd D:\DB\web_V4\backend
echo    node setup-telegram-webhook.js https://YOUR-TUNNEL-URL/api/telegram/webhook
echo.
echo 5. Test in Telegram:
echo    - Reply to a notification
echo    - Check if status updates
echo.
echo ============================================
echo   Windows will stay open...
echo   Close them when you're done testing
echo ============================================
echo.
pause
