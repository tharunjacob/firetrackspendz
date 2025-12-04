@echo off
echo Setting up Node.js from NVM...
set PATH=C:\Git\NVM\node-v25.2.1-win-x64\node-v25.2.1-win-x64;%PATH%

echo.
echo Starting TrackSpendz development server...
echo.
echo The app will be available at: http://localhost:5173
echo Press Ctrl+C to stop the server
echo.

call npm.cmd run dev


