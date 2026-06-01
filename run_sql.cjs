// Runs the fix_admin.sql via Supabase Management REST API
// Uses the access token from supabase CLI session
const fs = require('fs');
const path = require('path');
const os = require('os');

const PROJECT_REF = 'hygypbgsaykfnviigeln';
const SQL = fs.readFileSync(path.join(__dirname, 'fix_admin.sql'), 'utf8');

// Read Supabase CLI access token from config
const configDir = process.env.SUPABASE_CONFIG_DIR || path.join(os.homedir(), '.supabase');
let accessToken = '';
try {
  const credFile = path.join(configDir, 'credentials.json');
  if (fs.existsSync(credFile)) {
    const creds = JSON.parse(fs.readFileSync(credFile, 'utf8'));
    // Flatten: could be { access_token } or { token } depending on CLI version
    accessToken = creds.access_token || creds.token || '';
  }
} catch(e) {}

// Also check the accounts file
if (!accessToken) {
  try {
    const accountsFile = path.join(os.homedir(), '.supabase', 'access-token');
    if (fs.existsSync(accountsFile)) {
      accessToken = fs.readFileSync(accountsFile, 'utf8').trim();
    }
  } catch(e) {}
}

// Also try the default credential path that newer CLI versions use
if (!accessToken) {
  const candidates = [
    path.join(os.homedir(), 'AppData', 'Roaming', 'supabase', 'credentials.json'),
    path.join(os.homedir(), '.config', 'supabase', 'credentials.json'),
    path.join(os.homedir(), '.supabase', 'credentials.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        const c = JSON.parse(fs.readFileSync(p, 'utf8'));
        accessToken = c.access_token || c.token || '';
        if (accessToken) { console.log('Token found at:', p); break; }
      } catch(e) {}
    }
  }
}

if (!accessToken) {
  console.error('No Supabase access token found. Please run: npx supabase login');
  console.error('Then run this script again.');
  process.exit(1);
}

async function runSQL() {
  console.log('Applying SQL to project:', PROJECT_REF);
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query: SQL }),
    }
  );
  const text = await res.text();
  if (!res.ok) {
    console.error('API Error:', res.status, text.slice(0, 500));
    process.exit(1);
  }
  console.log('Success:', text.slice(0, 300));
}

runSQL().catch(err => {
  console.error('Fetch error:', err.message);
  process.exit(1);
});
