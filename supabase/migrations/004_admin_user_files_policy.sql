-- Migration 004: Allow admins to read all user files metadata for Control Room stats
DROP POLICY IF EXISTS "Admins can read all files" ON public.user_files;
CREATE POLICY "Admins can read all files" ON public.user_files FOR SELECT
  USING (is_admin() OR auth.role() = 'service_role');
