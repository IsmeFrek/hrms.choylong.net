@echo off
echo ============================================
echo   Telegram Webhook Setup Guide
echo ============================================
echo.
echo Step 1: Install ngrok
echo ---------------------
echo Download from: https://ngrok.com/download
echo Or use: winget install ngrok
echo.
echo Step 2: Run ngrok
echo -----------------
echo   ngrok http 5000
echo.
echo Step 3: Copy the URL shown (looks like):
echo   https://xxxx-yyyy-zzzz.ngrok-free.app
echo.
echo Step 4: Setup webhook:
echo   cd backend
echo   node setup-telegram-webhook.js https://YOUR-NGROK-URL/api/telegram/webhook
echo.
echo ============================================
echo QUICK INSTALL:
echo ============================================
echo.
choice /C YN /M "Do you want to install ngrok now"
if errorlevel 2 goto :skip
if errorlevel 1 goto :install

:install
echo Installing ngrok...
winget install ngrok
echo.
echo ✅ Installation complete!
echo Now run: ngrok http 5000
goto :end

:skip
echo Skipped installation.
echo.
echo Manual download: https://ngrok.com/download
echo.

:end
pause
