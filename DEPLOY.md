# Deployment Instructions

## Pushing to GitHub

### Step 1: Initialize Git (if not already done)
Open PowerShell or Git Bash in the project directory and run:

```bash
git init
```

### Step 2: Add the Remote Repository
```bash
git remote add origin https://github.com/tharunjacob/firetrackspendz.git
```

If the remote already exists, update it:
```bash
git remote set-url origin https://github.com/tharunjacob/firetrackspendz.git
```

### Step 3: Add All Files
```bash
git add .
```

### Step 4: Commit
```bash
git commit -m "Initial commit: TrackSpendz FIRE Calculator"
```

### Step 5: Push to GitHub
```bash
git branch -M main
git push -u origin main
```

If you get authentication errors, you may need to:
- Use a Personal Access Token instead of password
- Or use SSH: `git remote set-url origin git@github.com:tharunjacob/firetrackspendz.git`

## Deploying to Vercel

### Method 1: Via Vercel Dashboard (Recommended)

1. Go to https://vercel.com and sign in with GitHub
2. Click "Add New Project"
3. Select the `firetrackspendz` repository
4. Configure:
   - Framework Preset: Vite
   - Root Directory: ./
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Add Environment Variable:
   - Name: `VITE_API_KEY`
   - Value: Your Gemini API key
6. Click "Deploy"

### Method 2: Via Vercel CLI

```bash
npm install -g vercel
vercel login
vercel
```

Follow the prompts and add `VITE_API_KEY` when asked.

## Important Notes

- **Never commit `.env.local`** - It's already in `.gitignore`
- **Set `VITE_API_KEY` in Vercel Dashboard** - Go to Project Settings > Environment Variables
- The app will automatically rebuild on every push to main branch (if connected)

