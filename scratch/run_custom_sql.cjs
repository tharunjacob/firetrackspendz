const fs = require('fs');
const path = require('path');
const os = require('os');

const PROJECT_REF = 'hygypbgsaykfnviigeln';

// Read Supabase CLI access token from config
const configDir = process.env.SUPABASE_CONFIG_DIR || path.join(os.homedir(), '.supabase');
let accessToken = '';
try {
  const credFile = path.join(configDir, 'credentials.json');
  if (fs.existsSync(credFile)) {
    const creds = JSON.parse(fs.readFileSync(credFile, 'utf8'));
    accessToken = creds.access_token || creds.token || '';
  }
} catch(e) {}

if (!accessToken) {
  try {
    const accountsFile = path.join(os.homedir(), '.supabase', 'access-token');
    if (fs.existsSync(accountsFile)) {
      accessToken = fs.readFileSync(accountsFile, 'utf8').trim();
    }
  } catch(e) {}
}

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
  process.exit(1);
}

const sqlQuery = process.argv[2] || 'SELECT 1 as test;';

async function runSQL() {
  console.log('Executing SQL:');
  console.log(sqlQuery);
  console.log('-----------------------------------');
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query: sqlQuery }),
    }
  );
  const text = await res.text();
  if (!res.ok) {
    console.error('API Error:', res.status, text);
    process.exit(1);
  }
  console.log('Result:');
  console.log(text);
}

runSQL().catch(err => {
  console.error('Fetch error:', err.message);
  process.exit(1);
});
