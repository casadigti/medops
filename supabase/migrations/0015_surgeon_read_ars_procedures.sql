-- Surgeons need SELECT on ars and procedure_types to fill the request modal.
-- get_my_org_id() returns null for surgeon users (no user_profiles row),
-- so org-based policies exclude them. Add surgeon-specific SELECT policies.

CREATE POLICY "ars_surgeon_select" ON public.ars
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM public.surgeons WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "pt_surgeon_select" ON public.procedure_types
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM public.surgeons WHERE user_id = auth.uid()
    )
  );
