-- Track every status change on a surgery: who changed it, from what, to what.
--
-- ROLLBACK (ejecutar en SQL Editor si necesitas deshacer):
--   DROP TABLE IF EXISTS surgery_status_history;
-- No hay datos de negocio críticos en esta tabla; es historial auditable.

CREATE TABLE IF NOT EXISTS surgery_status_history (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  surgery_id  uuid        NOT NULL REFERENCES surgeries(id) ON DELETE CASCADE,
  org_id      uuid        NOT NULL DEFAULT get_my_org_id(),
  old_status  text,
  new_status  text        NOT NULL,
  changed_by  uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  notes       text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ssh_surgery ON surgery_status_history(surgery_id);
CREATE INDEX IF NOT EXISTS idx_ssh_org     ON surgery_status_history(org_id);

ALTER TABLE surgery_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ssh_select" ON surgery_status_history FOR SELECT
  USING ((org_id = get_my_org_id() AND get_my_role() = ANY (
    ARRAY['Superadmin','Administrador','Editor','Técnico','Lector']
  )) OR is_platform_admin());

CREATE POLICY "ssh_insert" ON surgery_status_history FOR INSERT
  WITH CHECK ((org_id = get_my_org_id() AND get_my_role() = ANY (
    ARRAY['Superadmin','Administrador','Editor','Técnico']
  )) OR is_platform_admin());
