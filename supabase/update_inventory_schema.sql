-- ============================================================
-- FIX: Missing Columns and RLS for Inventory (Implants)
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Asegurar columnas en la tabla 'implants'
ALTER TABLE public.implants 
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Tornillo',
  ADD COLUMN IF NOT EXISTS min_stock INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. Asegurar columnas en la tabla 'implant_lots'
ALTER TABLE public.implant_lots
  ADD COLUMN IF NOT EXISTS current_quantity INTEGER DEFAULT 0;

-- 3. Habilitar RLS
ALTER TABLE public.implants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implant_lots ENABLE ROW LEVEL SECURITY;

-- 4. Políticas para IMPLANTS
DROP POLICY IF EXISTS "Implants_Select" ON public.implants;
CREATE POLICY "Implants_Select" ON public.implants 
  FOR SELECT TO authenticated 
  USING (true);

DROP POLICY IF EXISTS "Implants_Write" ON public.implants;
CREATE POLICY "Implants_Write" ON public.implants 
  FOR ALL TO authenticated 
  USING (get_my_role() IN ('Superadmin', 'Administrador', 'Editor'))
  WITH CHECK (get_my_role() IN ('Superadmin', 'Administrador', 'Editor'));

-- 5. Políticas para IMPLANT_LOTS
DROP POLICY IF EXISTS "Lots_Select" ON public.implant_lots;
CREATE POLICY "Lots_Select" ON public.implant_lots 
  FOR SELECT TO authenticated 
  USING (true);

DROP POLICY IF EXISTS "Lots_Write" ON public.implant_lots;
CREATE POLICY "Lots_Write" ON public.implant_lots 
  FOR ALL TO authenticated 
  USING (get_my_role() IN ('Superadmin', 'Administrador', 'Editor', 'Técnico'))
  WITH CHECK (get_my_role() IN ('Superadmin', 'Administrador', 'Editor', 'Técnico'));

-- 6. Verificación
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('implants', 'implant_lots')
ORDER BY table_name;
