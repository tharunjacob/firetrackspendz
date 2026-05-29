# TrackSpendZ v2 — Setup Guide

## Quick Start

```bash
cd trackspendz-v2

# 1. Install dependencies
npm install

# 2. (Optional) Install AI features
npm install @google/generative-ai

# 3. Configure environment
cp .env.example .env
# Edit .env with your keys

# 4. Run development server
npm run dev
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public key |
| `VITE_GEMINI_API_KEY` | No | Google Gemini API key (enables AI features) |
| `VITE_RAZORPAY_KEY_ID` | No | Razorpay publishable key (enables payments) — see `RAZORPAY_SETUP.md` |
| `VITE_ADMIN_EMAILS` | No | Comma-separated admin email addresses |

## Supabase Setup

### Required Tables

```sql
-- User profiles
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  subscription_plan TEXT DEFAULT 'free',
  subscription_status TEXT,
  subscription_period TEXT,            -- 'monthly' | 'yearly'
  subscription_provider TEXT,          -- 'razorpay' | 'stripe'
  razorpay_customer_id TEXT,
  razorpay_subscription_id TEXT,
  stripe_customer_id TEXT,             -- legacy, retained for future revival
  preferred_currency TEXT DEFAULT 'INR',
  manual_assets JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  date TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  sub_category TEXT,
  notes TEXT,
  merchant_name TEXT,
  owner TEXT,
  original_description TEXT,
  currency TEXT DEFAULT 'INR',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Category learning rules (auto-created when user edits transactions)
CREATE TABLE category_rules (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  keyword TEXT NOT NULL,
  target_field TEXT NOT NULL DEFAULT 'category',  -- category, type, project, merchant, subCategory
  value TEXT NOT NULL,
  source TEXT DEFAULT 'user',   -- user, admin, system
  scope TEXT DEFAULT 'user',    -- user, admin, system
  status TEXT DEFAULT 'pending', -- active, pending
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(keyword, target_field)
);

-- App logs (used by logger service + admin panel)
CREATE TABLE app_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  email TEXT,
  session_id TEXT,
  event TEXT NOT NULL,
  metadata JSONB,
  level TEXT DEFAULT 'info',
  path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_app_logs_created ON app_logs(created_at DESC);
CREATE INDEX idx_app_logs_level ON app_logs(level);
CREATE INDEX idx_app_logs_user ON app_logs(user_id);

-- Asset snapshots (Net Asset Tracker)
CREATE TABLE asset_snapshots (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  date TEXT NOT NULL,
  owner TEXT NOT NULL,
  category TEXT NOT NULL,
  accessibility_tier TEXT NOT NULL,
  principal NUMERIC DEFAULT 0,
  current_value NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback (customer support)
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  email TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('bug', 'feature', 'question', 'other')),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feedback_status ON feedback(status);
CREATE INDEX idx_feedback_created ON feedback(created_at DESC);

-- Row Level Security
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own transactions" ON transactions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own profile" ON user_profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users can read system + own rules" ON category_rules
  FOR SELECT USING (scope = 'system' OR auth.uid() = user_id);

CREATE POLICY "Users can manage own rules" ON category_rules
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own assets" ON asset_snapshots
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can submit feedback" ON feedback
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can read own feedback" ON feedback
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Admins can update feedback" ON feedback
  FOR UPDATE USING (is_admin());

-- Admin: allow admins to read all data (add admin emails to your env)
-- You can create a function to check admin status:
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT email FROM auth.users WHERE id = auth.uid())
    IN (SELECT unnest(string_to_array(current_setting('app.admin_emails', true), ',')));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC functions for admin panel aggregation
CREATE OR REPLACE FUNCTION get_user_transaction_counts()
RETURNS TABLE(user_id UUID, count BIGINT) AS $$
  SELECT user_id, COUNT(*) FROM transactions GROUP BY user_id;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_file_counts()
RETURNS TABLE(user_id UUID, count BIGINT) AS $$
  SELECT user_id, COUNT(DISTINCT file_id) FROM transactions WHERE file_id IS NOT NULL GROUP BY user_id;
$$ LANGUAGE sql SECURITY DEFINER;
```

### Auth Setup
1. Go to Supabase Dashboard > Authentication > Providers
2. Enable Google OAuth (provide your Google OAuth Client ID + Secret)
3. Set redirect URL to: `https://trackspendz.com/auth/callback`

## Razorpay Setup (Optional — enables payments)

TrackSpendZ uses Razorpay for all payment processing. See [`RAZORPAY_SETUP.md`](./RAZORPAY_SETUP.md)
for the full step-by-step checklist (create plans, get keys, configure
webhook, deploy edge functions, test in test mode). High-level:

1. Create the 4 INR plans (Pro/Enterprise × Monthly/Yearly) in Razorpay Dashboard.
2. Set Supabase secrets: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
   `RAZORPAY_WEBHOOK_SECRET`, and the four `RAZORPAY_PLAN_*` IDs.
3. Set `VITE_RAZORPAY_KEY_ID` locally.
4. Deploy edge functions: `razorpay-create-subscription`,
   `razorpay-verify-subscription`, `razorpay-cancel-subscription`,
   `razorpay-get-subscription`, `razorpay-webhook`.
5. Webhook URL: `https://your-supabase-url/functions/v1/razorpay-webhook`.

## Deploy to Vercel

```bash
npm run build
vercel deploy
```

Set environment variables in Vercel dashboard.

## Architecture

```
src/
├── App.tsx              # Main router
├── main.tsx             # Entry point
├── index.css            # Tailwind + custom classes
├── types/               # TypeScript interfaces
├── utils/               # Constants, helpers
├── services/            # Business logic
│   ├── supabase.ts      # DB client
│   ├── auth.ts          # Authentication
│   ├── storage.ts       # Storage gateway
│   ├── transformer.ts   # File parsing & categorization
│   ├── analysis.ts      # Financial analysis engine
│   ├── gemini.ts        # AI features (optional)
│   ├── razorpay.ts      # Razorpay subscriptions (active)
│   ├── paymentProvider.ts # Provider-agnostic payment facade
│   ├── stripe.ts        # Legacy stub — kept for future USD revival
│   └── ...
├── contexts/            # React context (global state)
├── components/
│   ├── auth/            # Login modal
│   ├── common/          # Icons, Toast, ErrorBoundary
│   ├── layout/          # Navbar
│   ├── upload/          # File uploader
│   └── dashboard/       # Dashboard shell + 14 view tabs + notifications
└── pages/               # Route pages
    ├── LandingPage       # Marketing homepage
    ├── PricingPage       # Plans & FAQ
    ├── FeaturesPage      # Feature showcase
    ├── DashboardPage     # Main app
    ├── NetAssetPage      # Net worth tracker
    ├── SettingsPage      # Account settings & export
    ├── AdminPage         # Admin panel (secret URL: /ctrl-room-7x9k)
    └── ...
```

## File Count: 143 source files, 10 config files, 5 public assets | Last updated: May 2026

## New in v2.1 (March 2026)

- **Smart Learning Rules** — Edit a transaction's category → app remembers and auto-categorizes future matches
- **SubCategory Support** — New column in Data tab, learnable from user edits
- **Excel Net Worth Import** — Upload .xlsx/.xls files, AI auto-detects columns, multi-sheet support
- **Currency-Aware Tools** — FIRE Calculator and Savings Rate tools show locale-appropriate placeholders
- **Referral Program** — Landing page captures `?ref=CODE`, auto-claimed on signup
- **14 Dashboard Views** — Added Recurring and Year Review tabs
- **UI Accuracy Audit** — Removed false claims (14-day trial, "thousands of users"), fixed Gemini version, honest FAQ copy

## Previous in v2.0 (February 2026)

- **Help Center** (`/help`) — Searchable documentation with 13 topic sections covering every feature
- **Upload-First Experience** — Dashboard is now public; anonymous users can upload files and see 500 most recent transactions, rest behind signup paywall
- **Family Dashboard** (`/family`) — Enterprise feature for household finance management (up to 5 members)
- **API Access Panel** — Enterprise feature in Settings (marked "Coming Soon")
- **Paywall Banner** — Shown to anonymous users who exceed the 500 transaction free preview
- **Password-Protected Files** — Improved UI with lock icon, inline messaging, and auto-focus
- **Smart Notifications** — Bell icon in navbar with bill reminders, budget alerts, anomaly detection, achievements

## Admin Panel

Access: `https://trackspendz.com/ctrl-room-7x9k`

Only accessible to emails listed in `VITE_ADMIN_EMAILS`. Non-admin users see a 404 page.
The URL is intentionally obscure and not linked anywhere in the UI.
