@echo off
echo ============================================
echo   ngrok Setup - Add Authtoken
echo ============================================
echo.
echo 1. Go to: https://dashboard.ngrok.com/get-started/your-authtoken
echo 2. Copy your authtoken
echo 3. Paste it below when asked
echo.
echo ============================================
echo.

set /p TOKEN="Enter your ngrok authtoken: "

"C:\Users\Net Chantha\AppData\Local\Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe" config add-authtoken %TOKEN%

if %errorlevel% equ 0 (
    echo.
    echo ✅ Authtoken added successfully!
    echo.
    echo Now run: ngrok http 5000
    echo.
) else (
    echo.
    echo ❌ Failed to add authtoken
    echo.
)

pause
