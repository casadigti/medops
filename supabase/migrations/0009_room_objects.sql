-- Room objects: mesas, escritorios, paredes divisorias, columnas, puertas en el floor plan

CREATE TABLE IF NOT EXISTS room_objects (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL DEFAULT get_my_org_id() REFERENCES organizations(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL CHECK (type IN ('table', 'desk', 'wall', 'column', 'door')),
  label       TEXT,
  position_x  INT         NOT NULL DEFAULT 0,
  position_y  INT         NOT NULL DEFAULT 0,
  width       INT         NOT NULL DEFAULT 2 CHECK (width  BETWEEN 1 AND 50),
  height      INT         NOT NULL DEFAULT 2 CHECK (height BETWEEN 1 AND 50),
  color       TEXT        NOT NULL DEFAULT '#94a3b8',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_room_objects_org ON room_objects(org_id);

ALTER TABLE room_objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY room_objects_select ON room_objects
  FOR SELECT USING (org_id = get_my_org_id() OR is_platform_admin());

CREATE POLICY room_objects_write ON room_objects
  FOR ALL USING (
    get_my_role() IN ('Administrador', 'Superadmin') OR is_platform_admin()
  );
