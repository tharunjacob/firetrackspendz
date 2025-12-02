# Quick Push to GitHub - Using Cursor's Built-in Git

Since Git command line isn't available, use Cursor's built-in Git features:

## Method 1: Using Cursor's Source Control (Easiest)

1. **Open Source Control in Cursor:**
   - Click the Source Control icon in the left sidebar (looks like a branch icon)
   - Or press `Ctrl+Shift+G`

2. **Initialize Repository:**
   - If you see "Initialize Repository" button, click it
   - This creates a `.git` folder

3. **Stage All Files:**
   - Click the "+" icon next to "Changes" to stage all files
   - Or click "Stage All Changes"

4. **Commit:**
   - Type commit message: `Initial commit: TrackSpendz FIRE Calculator`
   - Press `Ctrl+Enter` or click the checkmark

5. **Add Remote:**
   - Click the "..." menu (three dots) in Source Control panel
   - Select "Remote" > "Add Remote"
   - Name: `origin`
   - URL: `https://github.com/tharunjacob/firetrackspendz.git`

6. **Push:**
   - Click the "..." menu again
   - Select "Push" > "Push to..."
   - Choose `origin` and `main` branch
   - If prompted, authenticate with GitHub

## Method 2: Install Git for Windows

1. Download from: https://git-scm.com/download/win
2. Install with default settings
3. Restart Cursor
4. Then use the PowerShell script: `.\push-to-github.ps1`

## Method 3: Use GitHub Desktop

1. Download GitHub Desktop: https://desktop.github.com/
2. Sign in with your GitHub account
3. File > Add Local Repository
4. Select this folder
5. Commit and push from the UI

---

**Note:** Make sure you have:
- ✅ Created the repository on GitHub first (if it doesn't exist)
- ✅ Have write access to the repository
- ✅ Your `.env.local` file is NOT committed (it's in `.gitignore`)

