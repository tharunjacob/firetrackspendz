# Running TrackSpendz Locally with NVM

## Prerequisites
- NVM installed at `C:\Git\NVM`
- Node.js v25.2.1 (or compatible version)

## Quick Start

### Option 1: Using PowerShell (Current Session)
```powershell
# Set PATH to include Node from NVM
$env:PATH = "C:\Git\NVM\node-v25.2.1-win-x64\node-v25.2.1-win-x64;$env:PATH"

# Install dependencies (first time only)
npm.cmd install

# Start development server
npm.cmd run dev
```

### Option 2: Create a Batch Script
Create a file `start-dev.bat`:
```batch
@echo off
set PATH=C:\Git\NVM\node-v25.2.1-win-x64\node-v25.2.1-win-x64;%PATH%
call npm.cmd run dev
```

Then just run: `start-dev.bat`

## Environment Variables

Create a `.env` file in the project root with:
```
VITE_API_KEY=your_google_gemini_api_key_here
```

**Note:** The API key is optional - the app will work without it, but AI features will be disabled.

## Access the App

Once the dev server starts, open your browser to:
- **Local:** http://localhost:5173
- **Network:** The terminal will show the network URL

## Troubleshooting

### PowerShell Execution Policy Error
If you get an execution policy error, use `npm.cmd` instead of `npm`.

### Port Already in Use
If port 5173 is busy, Vite will automatically use the next available port.

### Node Not Found
Make sure the Node path in NVM is correct. Check with:
```powershell
dir C:\Git\NVM\node-v25.2.1-win-x64\node-v25.2.1-win-x64\node.exe
```


