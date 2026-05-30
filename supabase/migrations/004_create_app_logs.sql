-- Create app_logs if it doesn't exist
CREATE TABLE IF NOT EXISTS public.app_logs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id  TEXT,
  event       TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}'::jsonb,
  level       TEXT DEFAULT 'info' CHECK (level IN ('info', 'error', 'warn')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure email column exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='app_logs' AND column_name='email') THEN
    ALTER TABLE public.app_logs ADD COLUMN email TEXT;
  END IF;
END $$;

-- Ensure path column exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='app_logs' AND column_name='path') THEN
    ALTER TABLE public.app_logs ADD COLUMN path TEXT;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert logs
DROP POLICY IF EXISTS "Anyone can insert logs" ON public.app_logs;
CREATE POLICY "Anyone can insert logs"
  ON public.app_logs FOR INSERT
  WITH CHECK (true);

-- Only admins and the service role (or the logged in user for their own logs) can select logs
DROP POLICY IF EXISTS "Admins can read all logs" ON public.app_logs;
CREATE POLICY "Admins can read all logs"
  ON public.app_logs FOR SELECT
  USING (auth.uid() = user_id OR auth.role() = 'service_role' OR is_admin());
