-- Employee roles are managed only by the Super Admin.
-- Staff can still read profiles through the existing SELECT policy.
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;

CREATE POLICY "Super admins can manage profiles"
  ON public.profiles
  FOR ALL
  USING (get_user_role() = 'super_admin')
  WITH CHECK (get_user_role() = 'super_admin');
