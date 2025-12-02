# TrackSpendz - Push to GitHub Script
# Run this script in PowerShell: .\push-to-github.ps1

Write-Host "🚀 Preparing to push TrackSpendz to GitHub..." -ForegroundColor Cyan

# Check if git is available
try {
    $gitVersion = git --version
    Write-Host "✓ Git found: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Git is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Git from https://git-scm.com/download/win" -ForegroundColor Yellow
    exit 1
}

# Check if we're in a git repository
if (-not (Test-Path .git)) {
    Write-Host "📦 Initializing Git repository..." -ForegroundColor Yellow
    git init
}

# Add remote (or update if exists)
Write-Host "🔗 Setting up remote repository..." -ForegroundColor Yellow
$remoteExists = git remote get-url origin 2>$null
if ($remoteExists) {
    git remote set-url origin https://github.com/tharunjacob/firetrackspendz.git
    Write-Host "✓ Updated remote URL" -ForegroundColor Green
} else {
    git remote add origin https://github.com/tharunjacob/firetrackspendz.git
    Write-Host "✓ Added remote URL" -ForegroundColor Green
}

# Check status
Write-Host "📊 Checking repository status..." -ForegroundColor Yellow
git status

# Add all files
Write-Host "➕ Adding all files..." -ForegroundColor Yellow
git add .

# Commit
Write-Host "💾 Committing changes..." -ForegroundColor Yellow
$commitMessage = "Initial commit: TrackSpendz FIRE Calculator with AI-powered insights"
git commit -m $commitMessage

# Set main branch
Write-Host "🌿 Setting main branch..." -ForegroundColor Yellow
git branch -M main

# Push
Write-Host "🚀 Pushing to GitHub..." -ForegroundColor Yellow
Write-Host "⚠️  You may be prompted for GitHub credentials" -ForegroundColor Yellow
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Successfully pushed to GitHub!" -ForegroundColor Green
    Write-Host "🔗 Repository: https://github.com/tharunjacob/firetrackspendz" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Go to https://vercel.com" -ForegroundColor White
    Write-Host "2. Import your GitHub repository" -ForegroundColor White
    Write-Host "3. Add VITE_API_KEY environment variable" -ForegroundColor White
    Write-Host "4. Deploy!" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "❌ Push failed. Common issues:" -ForegroundColor Red
    Write-Host "- Authentication required (use Personal Access Token)" -ForegroundColor Yellow
    Write-Host "- Repository doesn't exist or you don't have access" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "See DEPLOY.md for detailed instructions" -ForegroundColor Cyan
}

