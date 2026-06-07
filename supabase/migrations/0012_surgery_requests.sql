-- ─── Surgery Requests ─────────────────────────────────────────────────────────
-- Surgeons submit requests; admins approve (creating a real surgery) or reject.

CREATE TABLE IF NOT EXISTS surgery_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL DEFAULT get_my_org_id(),
  surgeon_id       uuid NOT NULL REFERENCES surgeons(id) ON DELETE CASCADE,
  patient_name     text NOT NULL,
  surgery_date     timestamptz NOT NULL,
  hospital_id      uuid NOT NULL REFERENCES hospitals(id),
  procedure_type   text NOT NULL,
  notes            text,
  status           text NOT NULL DEFAULT 'Pendiente'
                     CHECK (status IN ('Pendiente', 'Aprobada', 'Rechazada')),
  admin_notes      text,          -- rejection reason / approval comment
  surgery_id       uuid REFERENCES surgeries(id) ON DELETE SET NULL, -- set on approval
  created_at       timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_surgery_requests_org      ON surgery_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_surgery_requests_surgeon  ON surgery_requests(surgeon_id);
CREATE INDEX IF NOT EXISTS idx_surgery_requests_status   ON surgery_requests(status);

-- RLS
ALTER TABLE surgery_requests ENABLE ROW LEVEL SECURITY;

-- Surgeons: see only their own requests
CREATE POLICY "surgeons_select_own_requests" ON surgery_requests
  FOR SELECT USING (
    surgeon_id IN (
      SELECT id FROM surgeons WHERE user_id = auth.uid()
    )
    OR get_my_role() IN ('Administrador', 'Superadmin', 'Editor', 'Técnico', 'Lector')
    OR is_platform_admin()
  );

-- Surgeons can insert their own requests
CREATE POLICY "surgeons_insert_requests" ON surgery_requests
  FOR INSERT WITH CHECK (
    surgeon_id IN (
      SELECT id FROM surgeons WHERE user_id = auth.uid()
    )
    OR get_my_role() IN ('Administrador', 'Superadmin', 'Editor')
    OR is_platform_admin()
  );

-- Only admins/editors can update (approve/reject)
CREATE POLICY "admins_update_requests" ON surgery_requests
  FOR UPDATE USING (
    get_my_role() IN ('Administrador', 'Superadmin', 'Editor')
    OR is_platform_admin()
  );

-- Only admins can delete
CREATE POLICY "admins_delete_requests" ON surgery_requests
  FOR DELETE USING (
    get_my_role() IN ('Administrador', 'Superadmin')
    OR is_platform_admin()
  );
