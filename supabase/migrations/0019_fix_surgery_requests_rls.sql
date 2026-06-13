-- 0019_fix_surgery_requests_rls.sql
-- SECURITY FIX: cross-tenant data leak in surgery_requests.
-- The original 0012 policies granted staff roles access to ALL orgs (missing org_id filter).
-- A Superadmin/Editor/Técnico of Org A could read, update, and delete surgery_requests of Org B,
-- exposing patient_name, NSS, surgery dates, and hospital (PHI).
--
-- ROLLBACK:
--   DROP POLICY IF EXISTS "surgeons_select_own_requests"  ON surgery_requests;
--   DROP POLICY IF EXISTS "surgeons_insert_requests"       ON surgery_requests;
--   DROP POLICY IF EXISTS "admins_update_requests"         ON surgery_requests;
--   DROP POLICY IF EXISTS "admins_delete_requests"         ON surgery_requests;
-- Then re-apply 0012 original policies.

-- Drop old policies
DROP POLICY IF EXISTS "surgeons_select_own_requests" ON surgery_requests;
DROP POLICY IF EXISTS "surgeons_insert_requests"      ON surgery_requests;
DROP POLICY IF EXISTS "admins_update_requests"        ON surgery_requests;
DROP POLICY IF EXISTS "admins_delete_requests"        ON surgery_requests;

-- SELECT: surgeons see own requests; staff sees only same org; platform admin sees all.
CREATE POLICY "surgeons_select_own_requests" ON surgery_requests
  FOR SELECT USING (
    surgeon_id IN (
      SELECT id FROM surgeons WHERE user_id = auth.uid()
    )
    OR (
      get_my_role() IN ('Administrador', 'Superadmin', 'Editor', 'Técnico', 'Lector')
      AND org_id = get_my_org_id()
    )
    OR is_platform_admin()
  );

-- INSERT: surgeons insert own; editors/admins of same org can insert too.
CREATE POLICY "surgeons_insert_requests" ON surgery_requests
  FOR INSERT WITH CHECK (
    surgeon_id IN (
      SELECT id FROM surgeons WHERE user_id = auth.uid()
    )
    OR (
      get_my_role() IN ('Administrador', 'Superadmin', 'Editor')
      AND org_id = get_my_org_id()
    )
    OR is_platform_admin()
  );

-- UPDATE: only admins of same org can approve/reject; platform admin can update any.
CREATE POLICY "admins_update_requests" ON surgery_requests
  FOR UPDATE USING (
    (
      get_my_role() IN ('Administrador', 'Superadmin', 'Editor')
      AND org_id = get_my_org_id()
    )
    OR is_platform_admin()
  );

-- DELETE: only admins of same org; platform admin can delete any.
CREATE POLICY "admins_delete_requests" ON surgery_requests
  FOR DELETE USING (
    (
      get_my_role() IN ('Administrador', 'Superadmin')
      AND org_id = get_my_org_id()
    )
    OR is_platform_admin()
  );
