-- Grant admin access to active user email
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  user_email TEXT;
  user_metadata JSONB;
BEGIN
  SELECT email, raw_user_meta_data INTO user_email, user_metadata FROM auth.users WHERE id = auth.uid();
  RETURN (
    user_email = ANY(ARRAY['tharun@krexo.in', 'tharunjacob@gmail.com', 'silkaminni777@gmail.com'])
    OR user_metadata->>'is_admin' = 'true'
    OR user_metadata->>'role' = 'admin'
  );
END;
$$;

-- Ensure app_logs has all required columns
CREATE TABLE IF NOT EXISTS public.app_logs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id  TEXT,
  event       TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}'::jsonb,
  level       TEXT DEFAULT 'info' CHECK (level IN ('info', 'error', 'warn')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='app_logs' AND column_name='email') THEN
    ALTER TABLE public.app_logs ADD COLUMN email TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='app_logs' AND column_name='path') THEN
    ALTER TABLE public.app_logs ADD COLUMN path TEXT;
  END IF;
END $$;

ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert logs" ON public.app_logs;
CREATE POLICY "Anyone can insert logs" ON public.app_logs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read all logs" ON public.app_logs;
CREATE POLICY "Admins can read all logs" ON public.app_logs FOR SELECT
  USING (auth.uid() = user_id OR auth.role() = 'service_role' OR is_admin());

-- ============================================================
-- RLS Fixes for Rules, Feedback and Profiles (Admin control)
-- ============================================================

-- 1. Category Rules policies for admins
DROP POLICY IF EXISTS "Admins can read all rules" ON public.category_rules;
CREATE POLICY "Admins can read all rules" ON public.category_rules FOR SELECT
  USING (is_admin() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins can update all rules" ON public.category_rules;
CREATE POLICY "Admins can update all rules" ON public.category_rules FOR UPDATE
  USING (is_admin() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins can delete all rules" ON public.category_rules;
CREATE POLICY "Admins can delete all rules" ON public.category_rules FOR DELETE
  USING (is_admin() OR auth.role() = 'service_role');

-- 2. Feedback policies for admins
DROP POLICY IF EXISTS "Admins can read all feedback" ON public.feedback;
CREATE POLICY "Admins can read all feedback" ON public.feedback FOR SELECT
  USING (is_admin() OR auth.role() = 'service_role');

-- 3. User Profiles policies for admins
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.user_profiles;
CREATE POLICY "Admins can update all profiles" ON public.user_profiles FOR UPDATE
  USING (is_admin() OR auth.role() = 'service_role');

-- Recreate trigger function protect_subscription_columns to bypass check if user is admin
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
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Admin access, app_logs, rules, feedback, and profiles policies updated successfully!' as result;
