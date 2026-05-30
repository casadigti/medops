-- ============================================================================
-- 0003_storage_map.sql
-- Mapa de almacén virtual: estanterías con cuadrículas de celdas (cajones).
-- Cada celda puede asignarse a un lote de implante o una bandeja.
-- ============================================================================

-- ── 1. TABLAS ────────────────────────────────────────────────────────────────

CREATE TABLE public.storage_shelves (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL DEFAULT get_my_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  name        text NOT NULL,
  orientation text NOT NULL DEFAULT 'horizontal'
              CHECK (orientation IN ('horizontal','vertical')),
  rows        int  NOT NULL CHECK (rows BETWEEN 1 AND 10),
  cols        int  NOT NULL CHECK (cols BETWEEN 1 AND 20),
  color       text NOT NULL DEFAULT '#6366f1',
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.storage_slots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shelf_id    uuid NOT NULL REFERENCES public.storage_shelves(id) ON DELETE CASCADE,
  row_index   int  NOT NULL CHECK (row_index >= 0),
  col_index   int  NOT NULL CHECK (col_index >= 0),
  item_type   text CHECK (item_type IN ('implant_lot','tray')),
  item_id     uuid,
  notes       text,
  UNIQUE (shelf_id, row_index, col_index)
);

-- ── 2. ÍNDICES ───────────────────────────────────────────────────────────────

CREATE INDEX idx_storage_shelves_org  ON public.storage_shelves(org_id);
CREATE INDEX idx_storage_slots_shelf  ON public.storage_slots(shelf_id);
CREATE INDEX idx_storage_slots_item   ON public.storage_slots(item_id)
  WHERE item_id IS NOT NULL;

-- ── 3. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.storage_shelves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_slots   ENABLE ROW LEVEL SECURITY;

-- storage_shelves: todos los usuarios de la org pueden leer
CREATE POLICY "Shelves_Select" ON public.storage_shelves
  FOR SELECT USING (org_id = get_my_org_id() OR is_platform_admin());

-- storage_shelves: solo Administrador/Superadmin puede escribir
CREATE POLICY "Shelves_Write" ON public.storage_shelves
  FOR ALL
  USING (
    (org_id = get_my_org_id() AND get_my_role() IN ('Superadmin','Administrador'))
    OR is_platform_admin()
  )
  WITH CHECK (
    (org_id = get_my_org_id() AND get_my_role() IN ('Superadmin','Administrador'))
    OR is_platform_admin()
  );

-- storage_slots: aislamiento transitivo vía shelf_id → storage_shelves.org_id
CREATE POLICY "Slots_Select" ON public.storage_slots
  FOR SELECT USING (
    shelf_id IN (
      SELECT id FROM public.storage_shelves
      WHERE org_id = get_my_org_id() OR is_platform_admin()
    )
  );

CREATE POLICY "Slots_Write" ON public.storage_slots
  FOR ALL
  USING (
    shelf_id IN (
      SELECT id FROM public.storage_shelves
      WHERE (org_id = get_my_org_id() AND get_my_role() IN ('Superadmin','Administrador'))
         OR is_platform_admin()
    )
  )
  WITH CHECK (
    shelf_id IN (
      SELECT id FROM public.storage_shelves
      WHERE (org_id = get_my_org_id() AND get_my_role() IN ('Superadmin','Administrador'))
         OR is_platform_admin()
    )
  );

-- ── 4. VERIFICACIÓN ──────────────────────────────────────────────────────────
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('storage_shelves','storage_slots');
