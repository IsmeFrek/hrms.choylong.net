@echo off
title HRMS System - Network Mode
color 0A

echo.
echo ========================================
echo       HRMS System Network Startup
echo ========================================
echo.

echo [1/4] Setting up network configuration...
powershell -ExecutionPolicy Bypass -File setup-network.ps1

echo.
echo [2/4] Starting Backend Server...
start "HRMS Backend" cmd /k "cd backend && npm run dev"

echo.
echo [3/4] Waiting for backend to start...
timeout /t 3 /nobreak > nul

echo.
echo [4/4] Starting Frontend Server...
start "HRMS Frontend" cmd /k "npm run dev-network"

echo.
echo ========================================
echo   HRMS System is starting up...
echo   
echo   Wait a moment for both servers to load
echo   Then access via browser:
echo   - Local: http://localhost:5173
echo   - Network: http://[YOUR-IP]:5173
echo ========================================
echo.
pause
