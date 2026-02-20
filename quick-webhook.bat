@echo off
echo Starting tunnel and setting webhook...
echo.

REM Set PATH to find cloudflared
set PATH=%PATH%;C:\Program Files (x86)\cloudflared

REM Start cloudflared and capture output
echo Starting cloudflared tunnel...
for /f "tokens=*" %%i in ('cloudflared tunnel --url http://localhost:5000 ^| findstr "trycloudflare.com"') do (
    set TUNNEL_URL=%%i
)

echo Tunnel URL: %TUNNEL_URL%
echo.
echo Now run: cd backend
echo Then run: node setup-telegram-webhook.js [YOUR_URL_FROM_CLOUDFLARE_WINDOW]
pause
