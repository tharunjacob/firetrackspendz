-- Migration 003: Fix feedback RLS and create format_presets table
-- Run this in your Supabase SQL Editor to apply these database fixes.

-- 1. Create format_presets table (if it does not exist)
CREATE TABLE IF NOT EXISTS public.format_presets (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  header_sig     TEXT NOT NULL UNIQUE,         -- getFileSignature() output
  sample_headers TEXT[] NOT NULL,              -- actual headers (for human readability)
  mapping        JSONB NOT NULL,               -- FileMapping object
  status         TEXT NOT NULL DEFAULT 'pending'  -- 'pending' | 'verified' | 'rejected'
                   CHECK (status IN ('pending', 'verified', 'rejected')),
  successful_imports INT NOT NULL DEFAULT 0,   -- incremented on each confirmed success
  failed_imports     int not null default 0,   -- incremented on each confirmed failure
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  promoted_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- Index for fast signature lookup
CREATE INDEX IF NOT EXISTS idx_format_presets_sig ON public.format_presets(header_sig);

-- 2. Configure Row Level Security (RLS) for format_presets
ALTER TABLE public.format_presets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "public read verified presets" ON public.format_presets;
DROP POLICY IF EXISTS "admin read all presets" ON public.format_presets;
DROP POLICY IF EXISTS "authenticated users submit presets" ON public.format_presets;
DROP POLICY IF EXISTS "admin update presets" ON public.format_presets;

-- Anyone (even anonymous/guest users) can read verified presets
CREATE POLICY "public read verified presets"
  ON public.format_presets FOR SELECT
  USING (status = 'verified');

-- Admin can read all presets (pending, verified, rejected) for review
CREATE POLICY "admin read all presets"
  ON public.format_presets FOR SELECT
  USING (is_admin());

-- Authenticated users can submit new pending presets (contributing their format)
CREATE POLICY "authenticated users submit presets"
  ON public.format_presets FOR INSERT
  TO authenticated
  WITH CHECK (status = 'pending');

-- Admin can update preset status (verify / reject)
CREATE POLICY "admin update presets"
  ON public.format_presets FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 3. Create helper functions for format_presets (RPCs)
CREATE OR REPLACE FUNCTION public.increment_format_success(p_sig TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.format_presets
  SET
    successful_imports = successful_imports + 1,
    updated_at = now(),
    status = CASE
      WHEN status = 'pending' AND (successful_imports + 1) >= 3 THEN 'verified'
      ELSE status
    END
  WHERE header_sig = p_sig;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_format_failure(p_sig TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.format_presets
  SET
    failed_imports = failed_imports + 1,
    updated_at = now()
  WHERE header_sig = p_sig;
END;
$$;

-- 4. Fix RLS policies on the feedback table
-- Enable RLS just in case it wasn't
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Drop potential conflicting insert policies
DROP POLICY IF EXISTS "Anyone can insert feedback" ON public.feedback;
DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.feedback;

-- Recreate policy to allow ANYONE (including anonymous/guest users) to submit feedback
CREATE POLICY "Anyone can submit feedback"
  ON public.feedback FOR INSERT
  WITH CHECK (true);

-- 5. Update is_admin() function to support dynamic admin roles (via user metadata)
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
    user_email = ANY(ARRAY['tharun@krexo.in', 'tharunjacob@gmail.com'])
    OR user_metadata->>'is_admin' = 'true'
    OR user_metadata->>'role' = 'admin'
  );
END;
$$;

