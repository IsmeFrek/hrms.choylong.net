@echo off
echo ============================================
echo   Mobile Camera (No Red Warning) - Quick Start
echo ============================================
echo.
echo This will:
echo  1) Start Vite in HTTP mode (local)
echo  2) Start ngrok HTTPS tunnel for port 5173
echo.
echo Open the ngrok https:// URL on your phone.
echo.
echo Requirements:
echo  - ngrok installed and available in PATH (try: winget install ngrok)
echo.
echo ============================================
echo.

start "Vite (HTTP)" powershell -NoProfile -ExecutionPolicy Bypass -Command "$env:VITE_HTTP='1'; npm run dev"

timeout /t 2 >nul

start "ngrok (HTTPS tunnel)" ngrok http 5173

echo.
echo If ngrok doesn't open, install it:
echo   winget install ngrok
echo.
pause
