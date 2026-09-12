@echo off
title e-CASEVAULT - Maharashtra Police DEMS
echo =====================================================================
echo   e-CASEVAULT - Maharashtra Police Digital Evidence Management
echo =====================================================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is NOT installed on this computer!
    echo.
    echo Please download and install Node.js LTS version from:
    echo   https://nodejs.org/
    echo.
    echo After installing Node.js, double-click this file again.
    echo =====================================================================
    pause
    exit /b 1
)

cd /d "%~dp0"

if not exist "node_modules" (
    echo [INFO] First time setup: Installing dependencies...
    echo This may take 1-2 minutes. Please wait...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] npm install encountered an error.
        pause
        exit /b 1
    )
)

echo.
echo [INFO] Starting e-CASEVAULT Application...
echo   - Frontend: http://localhost:3000
echo   - Backend:  http://localhost:5001
echo.
echo Opening browser in 3 seconds...
start http://localhost:3000

call npm start
pause
