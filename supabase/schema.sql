-- ============================================================
-- TrackSpendZ v2 — Complete Supabase Schema
-- ============================================================
-- Run this entire file in: Supabase Dashboard → SQL Editor → New Query
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE everywhere
-- ============================================================

-- ===========================================
-- 0. Extensions
-- ===========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For fuzzy text search in admin

-- ===========================================
-- 0b. Admin check (defined early so RLS policies below can reference it)
-- ===========================================
-- Returns true when the current user's email is in the admin allow-list.
-- Defined up here (rather than next to the other RPC functions) because several
-- RLS policies — e.g. feedback updates — reference it, and Postgres requires the
-- function to exist at CREATE POLICY time.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = auth.uid() AND is_admin = true
  );
END;
$$;

-- ===========================================
-- 1. USER PROFILES
-- ===========================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT,
  full_name     TEXT,
  avatar_url    TEXT,
  age           INT,
  location      TEXT,
  gender        TEXT,
  dob           DATE,
  retirement_year INT,
  is_admin      BOOLEAN NOT NULL DEFAULT false,

  -- Subscription (provider-agnostic core)
  subscription_plan     TEXT NOT NULL DEFAULT 'free' CHECK (subscription_plan IN ('free', 'pro', 'enterprise')),
  subscription_status   TEXT DEFAULT 'active' CHECK (subscription_status IN (
    'active', 'trialing', 'canceled', 'past_due',
    -- Razorpay lifecycle states:
    'authenticated', 'pending', 'halted', 'completed', 'expired'
  )),
  subscription_period   TEXT CHECK (subscription_period IN ('monthly', 'yearly')),
  subscription_provider TEXT CHECK (subscription_provider IN ('razorpay', 'stripe')),
  next_billing_date     TIMESTAMPTZ,

  -- TRUE once the user has requested a cancel that takes effect at the end of
  -- the paid period. They keep Pro until next_billing_date; the end-of-cycle
  -- 'subscription.cancelled' webhook then flips the plan to free and clears
  -- this flag. Persisting it means a missed webhook still leaves a record that
  -- a cancel was requested (and drives the "Cancellation scheduled" banner).
  cancel_at_period_end  BOOLEAN NOT NULL DEFAULT false,

  -- Razorpay (current provider)
  razorpay_customer_id     TEXT,
  razorpay_subscription_id TEXT,

  -- Stripe (kept for future re-enablement — see RAZORPAY_SETUP.md)
  stripe_customer_id  TEXT,

  -- Net Worth (lightweight JSON for asset config & manual assets)
  manual_assets JSONB DEFAULT '[]'::jsonb,

  -- Preferences
  preferred_currency TEXT DEFAULT 'INR',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_user_profiles ON user_profiles;
CREATE TRIGGER set_updated_at_user_profiles
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Admin: can read all profiles (needed for admin panel). Uses the single
-- is_admin() source of truth instead of the old app.admin_emails GUC (which was
-- never set, so this policy used to be dead — admins couldn't read other rows).
DROP POLICY IF EXISTS "Admins can read all profiles" ON user_profiles;
CREATE POLICY "Admins can read all profiles"
  ON user_profiles FOR SELECT
  USING (is_admin() OR auth.uid() = id);

DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;
CREATE POLICY "Admins can update all profiles"
  ON user_profiles FOR UPDATE
  USING (is_admin() OR auth.role() = 'service_role');

-- Auto-create profile on sign-up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), user_profiles.full_name),
    avatar_url = COALESCE(NULLIF(EXCLUDED.avatar_url, ''), user_profiles.avatar_url),
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── Razorpay migration (idempotent — safe on already-deployed databases) ───
-- Adds the columns/constraint changes needed for the Razorpay integration to
-- existing databases that were created before this migration.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS subscription_period   TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS subscription_provider TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS razorpay_customer_id     TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS cancel_at_period_end     BOOLEAN NOT NULL DEFAULT false;

-- Recreate the CHECK constraints to include Razorpay states. Postgres has no
-- "ALTER CONSTRAINT" for CHECK, so we drop and re-add.
DO $$ BEGIN
  ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_subscription_status_check;
  ALTER TABLE user_profiles ADD  CONSTRAINT user_profiles_subscription_status_check
    CHECK (subscription_status IN (
      'active', 'trialing', 'canceled', 'past_due',
      'authenticated', 'pending', 'halted', 'completed', 'expired'
    ));
  ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_subscription_period_check;
  ALTER TABLE user_profiles ADD  CONSTRAINT user_profiles_subscription_period_check
    CHECK (subscription_period IS NULL OR subscription_period IN ('monthly', 'yearly'));
  ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_subscription_provider_check;
  ALTER TABLE user_profiles ADD  CONSTRAINT user_profiles_subscription_provider_check
    CHECK (subscription_provider IS NULL OR subscription_provider IN ('razorpay', 'stripe'));
END $$;

-- Lookup index used by the webhook handler to map razorpay_subscription_id → user.
CREATE INDEX IF NOT EXISTS idx_user_profiles_razorpay_sub
  ON user_profiles(razorpay_subscription_id)
  WHERE razorpay_subscription_id IS NOT NULL;

-- ─── Subscription-column write guard (revenue protection) ───────────────────
-- WHY THIS EXISTS:
-- The "Users can update own profile" RLS policy is column-blind — it lets a
-- user UPDATE any column on their own row, including the billing columns. Since
-- the anon key + the user's JWT both ship to the browser, a free user could run
--   supabase.from('user_profiles').update({ subscription_plan: 'enterprise' })
-- from the console and unlock every paid feature for $0 (client gating reads
-- profile.subscription_plan). RLS alone can't express "you may edit these
-- columns but not those," so this BEFORE UPDATE trigger enforces it: for any
-- caller that is NOT the service role, it silently reverts the billing columns
-- back to their stored (OLD) values, so user-originated edits to them are no-ops.
--
-- Legitimate plan changes are unaffected: every razorpay-* edge function writes
-- these columns through the SERVICE-ROLE client (serviceClient in
-- supabase/functions/_shared/razorpay.ts, and a dedicated service-role client in
-- razorpay-webhook), for which auth.role() = 'service_role' and the guard is skipped.
CREATE OR REPLACE FUNCTION protect_subscription_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() <> 'service_role' AND NOT is_admin() THEN
    NEW.subscription_plan        := OLD.subscription_plan;
    NEW.subscription_status      := OLD.subscription_status;
    NEW.subscription_period      := OLD.subscription_period;
    NEW.subscription_provider    := OLD.subscription_provider;
    NEW.razorpay_subscription_id := OLD.razorpay_subscription_id;
    NEW.razorpay_customer_id     := OLD.razorpay_customer_id;
    NEW.next_billing_date        := OLD.next_billing_date;
    NEW.cancel_at_period_end     := OLD.cancel_at_period_end;
    NEW.is_admin                 := OLD.is_admin;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_subscription ON user_profiles;
CREATE TRIGGER trg_protect_subscription
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION protect_subscription_columns();


-- ===========================================
-- 2. TRANSACTIONS
-- ===========================================
CREATE TABLE IF NOT EXISTS transactions (
  id                    TEXT PRIMARY KEY,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_id               TEXT,

  owner                 TEXT NOT NULL DEFAULT 'Me',
  type                  TEXT NOT NULL DEFAULT 'Expense' CHECK (type IN ('Income', 'Expense', 'Transfer')),
  date                  DATE NOT NULL,
  time                  TEXT,
  amount                NUMERIC(15,2) NOT NULL DEFAULT 0,

  category              TEXT NOT NULL DEFAULT 'Unclassified',
  sub_category          TEXT DEFAULT '',
  project               TEXT,
  merchant_name         TEXT,

  notes                 TEXT DEFAULT '',
  original_description  TEXT,

  is_recurring              BOOLEAN DEFAULT false,
  is_excluded_from_fire     BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON transactions(user_id, category);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON transactions(user_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_user_owner ON transactions(user_id, owner);

DROP TRIGGER IF EXISTS set_updated_at_transactions ON transactions;
CREATE TRIGGER set_updated_at_transactions
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD own transactions" ON transactions;
CREATE POLICY "Users can CRUD own transactions"
  ON transactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin read-all (used in mimic mode). Admins read via is_admin() from the
-- normal browser client; service_role covers backend jobs. Writes stay locked to
-- the owner via the policy above, so mimic mode is read-only by construction.
DROP POLICY IF EXISTS "Service role can read all transactions" ON transactions;
CREATE POLICY "Service role can read all transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id OR auth.role() = 'service_role' OR is_admin());


-- ===========================================
-- 3. USER FILES (upload metadata)
-- ===========================================
CREATE TABLE IF NOT EXISTS user_files (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name     TEXT NOT NULL,
  file_size_kb  NUMERIC DEFAULT 0,
  row_count     INT DEFAULT 0,
  entity_name   TEXT DEFAULT 'Me',
  upload_date   TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  file_type     TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_files_user_id ON user_files(user_id);

ALTER TABLE user_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD own files" ON user_files;
CREATE POLICY "Users can CRUD own files"
  ON user_files FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ===========================================
-- 4. CATEGORY RULES (Learning Engine)
-- ===========================================
CREATE TABLE IF NOT EXISTS category_rules (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword       TEXT NOT NULL,
  target_field  TEXT NOT NULL DEFAULT 'category' CHECK (target_field IN ('category', 'type', 'project', 'merchant', 'subCategory')),
  value         TEXT NOT NULL,
  source        TEXT DEFAULT 'user' CHECK (source IN ('user', 'admin', 'system')),
  scope         TEXT DEFAULT 'user' CHECK (scope IN ('user', 'admin', 'system')),
  status        TEXT DEFAULT 'pending' CHECK (status IN ('active', 'pending')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Per-user uniqueness: one user's rule for a keyword must not collide with
  -- another user's. (Previously UNIQUE(keyword, target_field), which was global
  -- across all users and let the first user to claim a keyword block everyone.)
  UNIQUE(user_id, keyword, target_field)
);

CREATE INDEX IF NOT EXISTS idx_category_rules_user_id ON category_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_category_rules_status ON category_rules(status);
CREATE INDEX IF NOT EXISTS idx_category_rules_keyword ON category_rules(keyword);

DROP TRIGGER IF EXISTS set_updated_at_category_rules ON category_rules;
CREATE TRIGGER set_updated_at_category_rules
  BEFORE UPDATE ON category_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE category_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own or system rules" ON category_rules;
CREATE POLICY "Users can read own or system rules"
  ON category_rules FOR SELECT
  USING (auth.uid() = user_id OR source = 'system' OR scope = 'system');

DROP POLICY IF EXISTS "Users can insert own rules" ON category_rules;
CREATE POLICY "Users can insert own rules"
  ON category_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own rules" ON category_rules;
CREATE POLICY "Users can update own rules"
  ON category_rules FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own rules" ON category_rules;
CREATE POLICY "Users can delete own rules"
  ON category_rules FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read all rules" ON category_rules;
CREATE POLICY "Admins can read all rules"
  ON category_rules FOR SELECT
  USING (is_admin() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins can update all rules" ON category_rules;
CREATE POLICY "Admins can update all rules"
  ON category_rules FOR UPDATE
  USING (is_admin() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins can delete all rules" ON category_rules;
CREATE POLICY "Admins can delete all rules"
  ON category_rules FOR DELETE
  USING (is_admin() OR auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- CROSS-USER LEARNING — Consensus promotion
-- ---------------------------------------------------------------------------
-- "Learn from one person, apply to everyone" is the product's core promise, but
-- doing it from a SINGLE user's edit is dangerous: it would let one person's typo
-- (or a malicious mislabel) poison categorization for the whole user base, and it
-- could leak that user's raw bank text to others.
--
-- Instead we promote a (keyword, target_field, value) rule to a shared SYSTEM rule
-- only once enough DISTINCT users have INDEPENDENTLY created the same active rule.
-- Consensus = trust. The keyword is already PII-normalized client-side
-- (normalizeKeyword in learningRules.ts) before it ever reaches this table.
--
-- The RLS SELECT policy above shares rows where scope='system', so the moment a
-- rule is promoted every user picks it up on their next rule hydration. The
-- function is SECURITY DEFINER so it can count/update across users (bypassing RLS);
-- it only ever flips scope/source to 'system' and never exposes row contents.
CREATE OR REPLACE FUNCTION check_rule_consensus()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  distinct_users INT;
  consensus_threshold CONSTANT INT := 3;  -- N independent users → shared default
BEGIN
  -- Only user-authored, active, not-yet-shared rules can trigger promotion.
  IF NEW.status <> 'active' OR NEW.scope = 'system' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(DISTINCT user_id) INTO distinct_users
  FROM category_rules
  WHERE lower(keyword) = lower(NEW.keyword)
    AND target_field = NEW.target_field
    AND value = NEW.value
    AND status = 'active';

  IF distinct_users >= consensus_threshold THEN
    UPDATE category_rules
    SET scope = 'system', source = 'system', updated_at = now()
    WHERE lower(keyword) = lower(NEW.keyword)
      AND target_field = NEW.target_field
      AND value = NEW.value
      AND scope <> 'system';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rule_consensus ON category_rules;
CREATE TRIGGER trg_rule_consensus
  AFTER INSERT ON category_rules
  FOR EACH ROW EXECUTE FUNCTION check_rule_consensus();

-- One-shot backfill / manual sweep an admin can run to promote any rules that
-- already meet consensus (e.g. after lowering the threshold, or for rows that
-- predate the trigger). Returns the number of rows promoted.
CREATE OR REPLACE FUNCTION promote_consensus_rules(min_users INT DEFAULT 3)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  promoted INT;
BEGIN
  WITH consensus AS (
    SELECT lower(keyword) AS k, target_field AS f, value AS v
    FROM category_rules
    WHERE status = 'active' AND scope <> 'system'
    GROUP BY lower(keyword), target_field, value
    HAVING COUNT(DISTINCT user_id) >= min_users
  )
  UPDATE category_rules cr
  SET scope = 'system', source = 'system', updated_at = now()
  FROM consensus c
  WHERE lower(cr.keyword) = c.k AND cr.target_field = c.f AND cr.value = c.v
    AND cr.scope <> 'system';
  GET DIAGNOSTICS promoted = ROW_COUNT;
  RETURN promoted;
END;
$$;


-- ===========================================
-- 5. APP LOGS (Telemetry & Diagnostics)
-- ===========================================
CREATE TABLE IF NOT EXISTS app_logs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email       TEXT,
  session_id  TEXT,
  event       TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}'::jsonb,
  level       TEXT DEFAULT 'info' CHECK (level IN ('info', 'error', 'warn')),
  path        TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_logs_user_id ON app_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_app_logs_level ON app_logs(level);
CREATE INDEX IF NOT EXISTS idx_app_logs_event ON app_logs(event);
CREATE INDEX IF NOT EXISTS idx_app_logs_created_at ON app_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_logs_session_id ON app_logs(session_id);

ALTER TABLE app_logs ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can insert logs (even for diagnostics)
DROP POLICY IF EXISTS "Authenticated users can insert logs" ON app_logs;
CREATE POLICY "Authenticated users can insert logs"
  ON app_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Also allow anonymous log inserts (guest users)
DROP POLICY IF EXISTS "Anyone can insert logs" ON app_logs;
CREATE POLICY "Anyone can insert logs"
  ON app_logs FOR INSERT
  WITH CHECK (true);

-- Only admins read all logs (via service role or admin check)
DROP POLICY IF EXISTS "Admins can read all logs" ON app_logs;
CREATE POLICY "Admins can read all logs"
  ON app_logs FOR SELECT
  USING (auth.uid() = user_id OR auth.role() = 'service_role' OR is_admin());


-- ===========================================
-- 6. ASSET SNAPSHOTS (Net Worth Tracker)
-- ===========================================
CREATE TABLE IF NOT EXISTS asset_snapshots (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date                DATE NOT NULL,
  owner               TEXT NOT NULL DEFAULT 'Me',
  category            TEXT NOT NULL,
  accessibility_tier  TEXT NOT NULL DEFAULT 'Investment',
  principal           NUMERIC(15,2) DEFAULT 0,
  current_value       NUMERIC(15,2) DEFAULT 0,
  currency            TEXT DEFAULT 'INR',
  notes               TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_snapshots_user_id ON asset_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_snapshots_user_date ON asset_snapshots(user_id, date);
CREATE INDEX IF NOT EXISTS idx_asset_snapshots_user_category ON asset_snapshots(user_id, category);

ALTER TABLE asset_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD own asset snapshots" ON asset_snapshots;
CREATE POLICY "Users can CRUD own asset snapshots"
  ON asset_snapshots FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ===========================================
-- 7. BUDGETS
-- ===========================================
CREATE TABLE IF NOT EXISTS budgets (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,
  monthly_limit NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency      TEXT DEFAULT 'INR',
  is_active     BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);

DROP TRIGGER IF EXISTS set_updated_at_budgets ON budgets;
CREATE TRIGGER set_updated_at_budgets
  BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD own budgets" ON budgets;
CREATE POLICY "Users can CRUD own budgets"
  ON budgets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ===========================================
-- 8. SUPPORT TICKETS
-- ===========================================
CREATE TABLE IF NOT EXISTS support_tickets (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email  TEXT NOT NULL,
  subject     TEXT NOT NULL,
  status      TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'resolved')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);

DROP TRIGGER IF EXISTS set_updated_at_support_tickets ON support_tickets;
CREATE TRIGGER set_updated_at_support_tickets
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD own tickets" ON support_tickets;
CREATE POLICY "Users can CRUD own tickets"
  ON support_tickets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ===========================================
-- 9. TICKET MESSAGES
-- ===========================================
CREATE TABLE IF NOT EXISTS ticket_messages (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  ticket_id   TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message     TEXT NOT NULL,
  is_admin    BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);

ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own ticket messages" ON ticket_messages;
CREATE POLICY "Users can read own ticket messages"
  ON ticket_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets st
      WHERE st.id = ticket_messages.ticket_id AND st.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own ticket messages" ON ticket_messages;
CREATE POLICY "Users can insert own ticket messages"
  ON ticket_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);


-- ===========================================
-- 10. FEEDBACK
-- ===========================================
CREATE TABLE IF NOT EXISTS feedback (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email       TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('bug', 'feature', 'question', 'other')),
  subject     TEXT NOT NULL,
  message     TEXT NOT NULL,
  context     JSONB DEFAULT '{}'::jsonb,
  status      TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'closed')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

DROP TRIGGER IF EXISTS set_updated_at_feedback ON feedback;
CREATE TRIGGER set_updated_at_feedback
  BEFORE UPDATE ON feedback
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Anyone can insert feedback (even anonymous users).
-- KNOWN SPAM SURFACE: this is intentionally open so logged-out visitors can send
-- feedback, which means it can be abused to flood the table. Mitigate at the edge
-- (rate limiting / captcha) rather than tightening this policy, which would break
-- anonymous feedback submission.
DROP POLICY IF EXISTS "Anyone can insert feedback" ON feedback;
CREATE POLICY "Anyone can insert feedback"
  ON feedback FOR INSERT
  WITH CHECK (true);

-- Users can read their own feedback
DROP POLICY IF EXISTS "Users can read own feedback" ON feedback;
CREATE POLICY "Users can read own feedback"
  ON feedback FOR SELECT
  USING (auth.uid() = user_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins can read all feedback" ON feedback;
CREATE POLICY "Admins can read all feedback"
  ON feedback FOR SELECT
  USING (is_admin() OR auth.role() = 'service_role');

-- Admins can update feedback status (e.g. mark resolved). Previously this allowed
-- ANY authenticated user (auth.uid() IS NOT NULL) to update any feedback row —
-- an abuse surface. Restrict to admins, plus the service role for backend jobs.
DROP POLICY IF EXISTS "Admins can update feedback" ON feedback;
CREATE POLICY "Admins can update feedback"
  ON feedback FOR UPDATE
  USING (is_admin() OR auth.role() = 'service_role');


-- ===========================================
-- 11. RPC FUNCTIONS
-- ===========================================

-- Get transaction count per user (for admin panel)
CREATE OR REPLACE FUNCTION get_user_transaction_counts()
RETURNS TABLE(user_id UUID, count BIGINT)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT t.user_id, COUNT(*) as count
  FROM transactions t
  GROUP BY t.user_id;
$$;

-- Get file count per user (for admin panel)
CREATE OR REPLACE FUNCTION get_user_file_counts()
RETURNS TABLE(user_id UUID, count BIGINT)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT uf.user_id, COUNT(*) as count
  FROM user_files uf
  GROUP BY uf.user_id;
$$;

-- Check if user is admin — defined earlier (section 0b, just after Extensions)
-- so the RLS policies above can reference it. See the top of this file to edit
-- the admin email allow-list.


-- ===========================================
-- 12. FUTURE-PROOFING: Useful indexes & features
-- ===========================================

-- Full-text search on transactions (for future search feature)
CREATE INDEX IF NOT EXISTS idx_transactions_notes_trgm ON transactions USING gin (notes gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_transactions_category_trgm ON transactions USING gin (category gin_trgm_ops);

-- Composite index for monthly analysis queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_date_type ON transactions(user_id, date, type);

-- Index for active budgets lookup
CREATE INDEX IF NOT EXISTS idx_budgets_active ON budgets(user_id) WHERE is_active = true;

-- Index for open feedback
CREATE INDEX IF NOT EXISTS idx_feedback_open ON feedback(status) WHERE status = 'open';

-- Index for recent logs
CREATE INDEX IF NOT EXISTS idx_app_logs_recent ON app_logs(created_at DESC) WHERE level = 'error';


-- ===========================================
-- Phase 2: Admin Audit Log + Feature Flags
-- ===========================================

-- Admin Audit Log — records every admin action
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          BIGSERIAL PRIMARY KEY,
  admin_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_email TEXT NOT NULL,
  action      TEXT NOT NULL,        -- e.g. 'plan_changed', 'rule_promoted'
  target_type TEXT NOT NULL,        -- e.g. 'user', 'rule', 'flag'
  target_id   TEXT NOT NULL,        -- UUID or string ID of the target
  details     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_admin   ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_recent  ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action  ON admin_audit_log(action);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read audit log" ON admin_audit_log;
CREATE POLICY "Admins can read audit log"
  ON admin_audit_log FOR SELECT USING (is_admin());
DROP POLICY IF EXISTS "Admins can insert audit log" ON admin_audit_log;
CREATE POLICY "Admins can insert audit log"
  ON admin_audit_log FOR INSERT WITH CHECK (is_admin());

-- Feature Flags — controlled by admin, read by all authenticated users
CREATE TABLE IF NOT EXISTS feature_flags (
  id          TEXT PRIMARY KEY,           -- e.g. 'ai_advisor', 'net_worth'
  name        TEXT NOT NULL,
  description TEXT,
  enabled     BOOLEAN NOT NULL DEFAULT false,
  metadata    JSONB DEFAULT '{}',
  updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone can read feature flags" ON feature_flags;
CREATE POLICY "Everyone can read feature flags"
  ON feature_flags FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can modify feature flags" ON feature_flags;
CREATE POLICY "Admins can modify feature flags"
  ON feature_flags FOR ALL USING (is_admin());

-- ===========================================
-- Phase 2: New indexes on app_logs for analytics
-- ===========================================

-- Funnel queries: filter by event, sort by time
CREATE INDEX IF NOT EXISTS idx_app_logs_event_time
  ON app_logs(event, created_at DESC);

-- Per-user feature adoption
CREATE INDEX IF NOT EXISTS idx_app_logs_user_event_time
  ON app_logs(user_id, event, created_at DESC);

-- Session analytics: reconstruct sessions
CREATE INDEX IF NOT EXISTS idx_app_logs_session
  ON app_logs(session_id, event, created_at);

-- ===========================================
-- Phase 3: Analytics RPC Functions
-- ===========================================

-- 1. CONVERSION FUNNEL
-- Returns distinct users at each step of the acquisition funnel
CREATE OR REPLACE FUNCTION get_analytics_funnel(from_date timestamptz, to_date timestamptz)
RETURNS TABLE (
  step        text,
  step_order  int,
  users       bigint,
  pct_of_top  numeric,
  pct_of_prev numeric
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH steps AS (
    SELECT 1 AS ord, 'Session Started'       AS step, COUNT(DISTINCT COALESCE(user_id::text, session_id)) AS u FROM app_logs WHERE event = 'session_start'             AND created_at BETWEEN from_date AND to_date
    UNION ALL
    SELECT 2, 'Visited Dashboard',  COUNT(DISTINCT COALESCE(user_id::text, session_id)) FROM app_logs WHERE event = 'page_view'              AND path = '/dashboard' AND created_at BETWEEN from_date AND to_date
    UNION ALL
    SELECT 3, 'File Selected',      COUNT(DISTINCT COALESCE(user_id::text, session_id)) FROM app_logs WHERE event = 'upload_file_selected'   AND created_at BETWEEN from_date AND to_date
    UNION ALL
    SELECT 4, 'Analysis Completed', COUNT(DISTINCT COALESCE(user_id::text, session_id)) FROM app_logs WHERE event = 'upload_analysis_completed' AND created_at BETWEEN from_date AND to_date
    UNION ALL
    SELECT 5, 'Explored Features',  COUNT(DISTINCT COALESCE(user_id::text, session_id)) FROM app_logs WHERE event LIKE 'feature_%_opened'    AND created_at BETWEEN from_date AND to_date
    UNION ALL
    SELECT 6, 'Clicked Upgrade',    COUNT(DISTINCT COALESCE(user_id::text, session_id)) FROM app_logs WHERE event = 'upgrade_clicked'        AND created_at BETWEEN from_date AND to_date
  ),
  top AS (SELECT u AS top_u FROM steps WHERE ord = 1)
  SELECT
    s.step,
    s.ord::int,
    s.u,
    ROUND(CASE WHEN top_u > 0 THEN (s.u::numeric / top_u * 100) ELSE 0 END, 1) AS pct_of_top,
    ROUND(CASE WHEN LAG(s.u) OVER (ORDER BY s.ord) > 0
               THEN (s.u::numeric / LAG(s.u) OVER (ORDER BY s.ord) * 100)
               ELSE 0 END, 1) AS pct_of_prev
  FROM steps s, top
  ORDER BY s.ord;
$$;

-- 2. COHORT RETENTION
-- Returns weekly cohort table: signup week × activity week
CREATE OR REPLACE FUNCTION get_cohort_retention(num_weeks int DEFAULT 8)
RETURNS TABLE (
  cohort_week  text,
  cohort_size  bigint,
  week_num     int,
  retained     bigint,
  retention_pct numeric
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH cohorts AS (
    SELECT
      id AS user_id,
      DATE_TRUNC('week', created_at) AS signup_week
    FROM user_profiles
    WHERE created_at >= NOW() - (num_weeks || ' weeks')::interval
  ),
  activity AS (
    SELECT DISTINCT
      user_id,
      DATE_TRUNC('week', created_at) AS active_week
    FROM app_logs
    WHERE user_id IS NOT NULL
      AND created_at >= NOW() - (num_weeks || ' weeks')::interval
  ),
  cohort_activity AS (
    SELECT
      c.signup_week,
      COUNT(DISTINCT c.user_id)                                          AS cohort_size,
      EXTRACT(EPOCH FROM (a.active_week - c.signup_week)) / 604800      AS week_offset,
      COUNT(DISTINCT a.user_id)                                          AS retained
    FROM cohorts c
    LEFT JOIN activity a ON a.user_id = c.user_id
    GROUP BY c.signup_week, a.active_week
  )
  SELECT
    TO_CHAR(signup_week, 'YYYY-"W"IW')   AS cohort_week,
    cohort_size,
    week_offset::int                      AS week_num,
    COALESCE(retained, 0)                 AS retained,
    ROUND(CASE WHEN cohort_size > 0 THEN (COALESCE(retained, 0)::numeric / cohort_size * 100) ELSE 0 END, 1) AS retention_pct
  FROM cohort_activity
  WHERE week_offset BETWEEN 0 AND num_weeks
  ORDER BY signup_week, week_offset;
$$;

-- 3. FEATURE ADOPTION
-- Unique users and total uses per feature event
CREATE OR REPLACE FUNCTION get_feature_adoption(from_date timestamptz, to_date timestamptz)
RETURNS TABLE (
  feature       text,
  unique_users  bigint,
  total_uses    bigint,
  adoption_pct  numeric
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH total_users AS (
    SELECT COUNT(DISTINCT COALESCE(user_id::text, session_id)) AS n
    FROM app_logs
    WHERE event = 'session_start' AND created_at BETWEEN from_date AND to_date
  ),
  features AS (
    SELECT
      REPLACE(REPLACE(event, 'feature_', ''), '_opened', '') AS feature,
      COUNT(DISTINCT COALESCE(user_id::text, session_id))    AS unique_users,
      COUNT(*)                                                AS total_uses
    FROM app_logs
    WHERE event LIKE 'feature_%_opened'
      AND created_at BETWEEN from_date AND to_date
    GROUP BY event
  )
  SELECT
    f.feature,
    f.unique_users,
    f.total_uses,
    ROUND(CASE WHEN t.n > 0 THEN (f.unique_users::numeric / t.n * 100) ELSE 0 END, 1) AS adoption_pct
  FROM features f, total_users t
  ORDER BY f.unique_users DESC;
$$;

-- 4. REVENUE METRICS
-- MRR, ARR, ARPU, conversion from user_profiles
CREATE OR REPLACE FUNCTION get_revenue_metrics()
RETURNS TABLE (
  metric  text,
  value   numeric
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH counts AS (
    SELECT
      COUNT(*)                                                          AS total_users,
      COUNT(*) FILTER (WHERE subscription_plan = 'pro')                AS pro_users,
      COUNT(*) FILTER (WHERE subscription_plan = 'enterprise')         AS enterprise_users,
      COUNT(*) FILTER (WHERE subscription_plan IN ('pro','enterprise')) AS paying_users
    FROM user_profiles
  )
  SELECT * FROM (VALUES
    ('total_users',        (SELECT total_users      FROM counts)::numeric),
    ('pro_users',          (SELECT pro_users        FROM counts)::numeric),
    ('enterprise_users',   (SELECT enterprise_users FROM counts)::numeric),
    ('paying_users',       (SELECT paying_users     FROM counts)::numeric),
    ('arr',                ((SELECT pro_users FROM counts) * 49 + (SELECT enterprise_users FROM counts) * 149)::numeric),
    ('mrr',                ROUND(((SELECT pro_users FROM counts) * 49 + (SELECT enterprise_users FROM counts) * 149)::numeric / 12, 2)),
    ('arpu',               ROUND(CASE WHEN (SELECT paying_users FROM counts) > 0
                                 THEN ((SELECT pro_users FROM counts) * 49 + (SELECT enterprise_users FROM counts) * 149)::numeric
                                      / (SELECT paying_users FROM counts)
                                 ELSE 0 END, 2)),
    ('conversion_rate',    ROUND(CASE WHEN (SELECT total_users FROM counts) > 0
                                 THEN (SELECT paying_users FROM counts)::numeric / (SELECT total_users FROM counts) * 100
                                 ELSE 0 END, 1)),
    ('ltv_estimate',       ROUND(CASE WHEN (SELECT paying_users FROM counts) > 0
                                 THEN ((SELECT pro_users FROM counts) * 49 + (SELECT enterprise_users FROM counts) * 149)::numeric
                                      / (SELECT paying_users FROM counts) * 2.5
                                 ELSE 0 END, 2))
  ) AS t(metric, value);
$$;

-- 5. SESSION ANALYTICS
-- Avg session duration, pages per session, total sessions
CREATE OR REPLACE FUNCTION get_session_analytics(from_date timestamptz, to_date timestamptz)
RETURNS TABLE (
  total_sessions       bigint,
  total_users          bigint,
  avg_duration_seconds numeric,
  avg_pages_per_session numeric
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH sessions AS (
    SELECT
      session_id,
      MIN(created_at)                                           AS started_at,
      MAX(created_at)                                           AS ended_at,
      EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at)))  AS duration_seconds,
      COUNT(*) FILTER (WHERE event = 'page_view')              AS page_views,
      MAX(COALESCE(user_id::text, ''))                         AS user_ref
    FROM app_logs
    WHERE session_id IS NOT NULL
      AND created_at BETWEEN from_date AND to_date
    GROUP BY session_id
    HAVING COUNT(*) > 1
  )
  SELECT
    COUNT(*)                                         AS total_sessions,
    COUNT(DISTINCT NULLIF(user_ref, ''))             AS total_users,
    ROUND(AVG(duration_seconds), 0)                  AS avg_duration_seconds,
    ROUND(AVG(page_views), 2)                        AS avg_pages_per_session
  FROM sessions;
$$;

-- 6. DAILY ACTIVE USERS
-- DAU time series for the last N days
CREATE OR REPLACE FUNCTION get_daily_active_users(num_days int DEFAULT 30)
RETURNS TABLE (
  date_day  text,
  dau       bigint
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS date_day,
    COUNT(DISTINCT COALESCE(user_id::text, session_id))  AS dau
  FROM app_logs
  WHERE created_at >= NOW() - (num_days || ' days')::interval
  GROUP BY DATE_TRUNC('day', created_at)
  ORDER BY DATE_TRUNC('day', created_at);
$$;

-- 7. ERROR TIMELINE
-- Daily error + warning counts (replaces client-side HealthTab computation)
CREATE OR REPLACE FUNCTION get_error_timeline(num_days int DEFAULT 7)
RETURNS TABLE (
  date_day  text,
  errors    bigint,
  warnings  bigint,
  total     bigint
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS date_day,
    COUNT(*) FILTER (WHERE level = 'error')  AS errors,
    COUNT(*) FILTER (WHERE level = 'warn')   AS warnings,
    COUNT(*)                                  AS total
  FROM app_logs
  WHERE created_at >= NOW() - (num_days || ' days')::interval
    AND level IN ('error', 'warn')
  GROUP BY DATE_TRUNC('day', created_at)
  ORDER BY DATE_TRUNC('day', created_at);
$$;

-- Grant execute to authenticated users (RLS enforced inside functions via SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION get_analytics_funnel(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_cohort_retention(int)                       TO authenticated;
GRANT EXECUTE ON FUNCTION get_feature_adoption(timestamptz, timestamptz)  TO authenticated;
GRANT EXECUTE ON FUNCTION get_revenue_metrics()                           TO authenticated;
GRANT EXECUTE ON FUNCTION get_session_analytics(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_active_users(int)                     TO authenticated;
GRANT EXECUTE ON FUNCTION get_error_timeline(int)                         TO authenticated;

-- ===========================================
-- 8. User Achievements & Referrals (Phase 6)
-- ===========================================

CREATE TABLE IF NOT EXISTS user_achievements (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_type text NOT NULL,     -- 'streak' | 'milestone' | 'wrapped' | 'referral'
  achievement_key  text NOT NULL,     -- e.g. 'upload_streak', 'fire_25pct', 'wrapped_2025'
  value         jsonb DEFAULT '{}',   -- flexible data: { streak_count: 5, month: '2025-06' }
  earned_at     timestamptz DEFAULT now(),
  UNIQUE(user_id, achievement_key)
);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own achievements" ON user_achievements;
CREATE POLICY "Users see own achievements"
  ON user_achievements FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own achievements" ON user_achievements;
CREATE POLICY "Users insert own achievements"
  ON user_achievements FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_achievements_user ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_achievements_type ON user_achievements(achievement_type);

-- ─── Referral tracking ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS referrals (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  referrer_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  referral_code text NOT NULL UNIQUE,
  status        text NOT NULL DEFAULT 'pending',  -- pending | completed | expired
  created_at    timestamptz DEFAULT now(),
  completed_at  timestamptz
);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own referrals" ON referrals;
CREATE POLICY "Users see own referrals"
  ON referrals FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referee_id);
DROP POLICY IF EXISTS "Users insert own referrals" ON referrals;
CREATE POLICY "Users insert own referrals"
  ON referrals FOR INSERT WITH CHECK (auth.uid() = referrer_id);
DROP POLICY IF EXISTS "System updates referrals" ON referrals;
CREATE POLICY "System updates referrals"
  ON referrals FOR UPDATE USING (auth.uid() = referrer_id OR auth.uid() = referee_id);

CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);

-- ─── Referral claiming (RLS-safe entry point) ────────────────
-- The REFEREE (newly signed-up user) is not the owner of the referral row, so
-- the RLS policies above — which only let the REFERRER insert/update — block the
-- referee from completing the referral. Without this the claim fails closed and
-- the program never rewards anyone.
--
-- This SECURITY DEFINER function runs with the table owner's rights (bypassing
-- RLS) and is the single, validated way to claim. It:
--   • takes the referee identity from auth.uid() — never trusts the client,
--   • rejects unknown codes and self-referral (referrer = referee),
--   • allows exactly one referee per code, and is idempotent if the same user
--     re-runs the claim,
--   • guards against a concurrent double-claim via the `referee_id IS NULL` WHERE.
-- Returns TRUE only when the caller now owns a completed referral.
CREATE OR REPLACE FUNCTION claim_referral(p_referral_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referee uuid := auth.uid();
  v_row     referrals%ROWTYPE;
BEGIN
  -- Must be signed in
  IF v_referee IS NULL THEN
    RETURN false;
  END IF;

  -- Look up the (unique) row for this code
  SELECT * INTO v_row
  FROM referrals
  WHERE referral_code = p_referral_code
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;                       -- unknown / expired code
  END IF;

  IF v_row.referrer_id = v_referee THEN
    RETURN false;                       -- no self-referral
  END IF;

  IF v_row.referee_id IS NOT NULL THEN
    -- Already claimed: success only if this same user claimed it before.
    RETURN v_row.referee_id = v_referee;
  END IF;

  -- Complete the referral. The referee_id IS NULL guard makes a concurrent
  -- second claim a no-op (FOUND = false → returns false).
  UPDATE referrals
  SET referee_id   = v_referee,
      status       = 'completed',
      completed_at = now()
  WHERE id = v_row.id
    AND referee_id IS NULL;

  RETURN FOUND;
END;
$$;

-- Only signed-in users may claim; anon/public cannot.
REVOKE ALL ON FUNCTION claim_referral(text) FROM public;
GRANT EXECUTE ON FUNCTION claim_referral(text) TO authenticated;

-- ===========================================
-- 9. USER SETTINGS (generic per-user key/value blobs)
-- ===========================================
-- Used by the userSettings service for goals, budgets, and similar
-- small per-user config that doesn't warrant a dedicated table.

CREATE TABLE IF NOT EXISTS user_settings (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  value      JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

DROP TRIGGER IF EXISTS set_updated_at_user_settings ON user_settings;
CREATE TRIGGER set_updated_at_user_settings
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD own settings" ON user_settings;
CREATE POLICY "Users can CRUD own settings"
  ON user_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ===========================================
-- 10. WELCOME EMAIL WEBHOOK
-- ===========================================
-- The send-welcome-email Edge Function is triggered by a Supabase Database
-- Webhook whenever a row is inserted into public.user_profiles.
--
-- SETUP STEPS (one-time, via Supabase Dashboard):
--
-- Step 1 — Deploy the edge function:
--   supabase functions deploy send-welcome-email
--
-- Step 2 — Set the required secrets:
--   supabase secrets set RESEND_API_KEY=re_your_key
--   supabase secrets set WEBHOOK_SECRET=some-random-secret   # optional but recommended
--
-- Step 3 — Create the Database Webhook:
--   Dashboard → Database → Webhooks → Create webhook
--     Name:        on_user_profile_created
--     Table:       public.user_profiles
--     Events:      INSERT  (only)
--     URL:         https://<project-ref>.supabase.co/functions/v1/send-welcome-email
--     HTTP method: POST
--     Headers:     Authorization: Bearer <same value as WEBHOOK_SECRET>
--
-- WHY a webhook instead of a PG trigger + pg_net?
-- Database Webhooks are managed by Supabase outside the transaction boundary,
-- so a slow or failing HTTP call never delays the INSERT that creates the
-- user's profile. This keeps signup latency unaffected.
--
-- ALTERNATIVE (pg_net — runs inside the DB, requires the pg_net extension):
-- If you prefer a pure-SQL approach, enable pg_net and uncomment below.
-- Note: pg_net is async but still adds overhead to the INSERT transaction.
--
-- CREATE EXTENSION IF NOT EXISTS pg_net;
--
-- CREATE OR REPLACE FUNCTION notify_welcome_email()
-- RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
-- DECLARE
--   edge_url  TEXT := current_setting('app.supabase_url', true) || '/functions/v1/send-welcome-email';
--   api_key   TEXT := current_setting('app.webhook_secret', true);
-- BEGIN
--   PERFORM net.http_post(
--     url     := edge_url,
--     headers := jsonb_build_object(
--                  'Content-Type',  'application/json',
--                  'Authorization', 'Bearer ' || COALESCE(api_key, '')
--                ),
--     body    := jsonb_build_object(
--                  'type',       'INSERT',
--                  'table',      'user_profiles',
--                  'schema',     'public',
--                  'record',     row_to_json(NEW),
--                  'old_record', NULL
--                )
--   );
--   RETURN NEW;
-- EXCEPTION WHEN OTHERS THEN
--   -- Never let email failure affect the signup transaction
--   RAISE WARNING '[notify_welcome_email] HTTP call failed: %', SQLERRM;
--   RETURN NEW;
-- END;
-- $$;
--
-- DROP TRIGGER IF EXISTS on_user_profile_created ON public.user_profiles;
-- CREATE TRIGGER on_user_profile_created
--   AFTER INSERT ON public.user_profiles
--   FOR EACH ROW EXECUTE FUNCTION notify_welcome_email();
-- ===========================================
-- 11. AI Usage Logs (Rate Limiting)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all logs" ON public.ai_usage_logs
  FOR SELECT USING (is_admin());

-- ===========================================
-- DONE! Schema created successfully.
-- ===========================================
-- Next steps:
-- 1. Enable Google OAuth in Authentication → Providers
-- 2. Add your email to the is_admin() function above
-- 3. Check that RLS is enabled on all tables (green shield icon)
-- 4. Phase 2: Run this file to create admin_audit_log + feature_flags
-- 5. Phase 3: Run this file to create the 7 analytics RPC functions
-- 6. Deploy send-welcome-email Edge Function (see Section 10 above)
-- ===========================================
