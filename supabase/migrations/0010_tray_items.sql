-- Componentes estructurados de bandejas
-- Reemplaza el campo content (texto libre) con items tipados del inventario

CREATE TABLE IF NOT EXISTS tray_items (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tray_id    UUID        NOT NULL REFERENCES trays(id) ON DELETE CASCADE,
  org_id     UUID        NOT NULL DEFAULT get_my_org_id() REFERENCES organizations(id) ON DELETE CASCADE,
  implant_id UUID        NOT NULL REFERENCES implants(id) ON DELETE RESTRICT,
  quantity   INT         NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tray_id, implant_id)
);

CREATE INDEX IF NOT EXISTS idx_tray_items_tray ON tray_items(tray_id);

ALTER TABLE tray_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY tray_items_select ON tray_items
  FOR SELECT USING (org_id = get_my_org_id() OR is_platform_admin());

CREATE POLICY tray_items_write ON tray_items
  FOR ALL USING (
    get_my_role() IN ('Administrador', 'Superadmin', 'Editor') OR is_platform_admin()
  );
