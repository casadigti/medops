-- ROOT FIX: surgeons cannot read their own row.
-- Surgeons_Read requires get_my_role() to be a staff role, which is null for
-- surgeon users. This breaks:
--   1. The greeting (surgeonProfile = null → "Dr. Especialista" fallback)
--   2. Every policy with `org_id IN (SELECT org_id FROM surgeons WHERE user_id = auth.uid())`
--      (hospitals_surgeon_select, ars_surgeon_select, pt_surgeon_select all return empty)
-- Supabase ORs multiple SELECT policies, so adding this is safe and additive.

CREATE POLICY "surgeons_read_own" ON public.surgeons
  FOR SELECT USING (user_id = auth.uid());
