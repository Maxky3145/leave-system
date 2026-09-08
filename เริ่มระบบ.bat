@echo off
title Leave System Server
cd /d "%~dp0"
echo Starting Leave System...
echo.
echo Open browser at: http://localhost:3000
echo Press CTRL+C to stop the server
echo.
node server.js
pause
