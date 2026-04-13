@echo off
title Hermes Agent Launcher

echo Stopping existing services...
taskkill /F /IM hermes.exe 2>nul
echo Done.

echo.
echo =========================================
echo    Hermes Agent v0.5.0 - Starting
echo =========================================
echo.

echo Starting gateway on port 3848...
start "Hermes-Gateway" cmd /k "%~dp0hermes.exe gateway start"

echo.
echo Waiting for gateway to start...
timeout /t 3 /nobreak >nul

echo.
echo =========================================
echo    STARTUP COMPLETE!
echo    Dashboard: http://localhost:3848
echo =========================================
echo.
echo The gateway serves both the API and the
echo web dashboard. Open http://localhost:3848
echo in your browser.
echo.
echo Close the gateway window to stop.
echo.

pause
