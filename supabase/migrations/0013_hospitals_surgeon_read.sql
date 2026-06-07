-- Allow surgeons to read hospitals from their own org.
-- The existing Hospitals_Read policy excludes the Cirujano role, so
-- surgeons see 0 rows when loading the request modal.
-- Supabase ORs multiple SELECT policies, so adding a separate policy is safe.

CREATE POLICY "hospitals_surgeon_select" ON public.hospitals
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM public.surgeons WHERE user_id = auth.uid()
    )
  );
