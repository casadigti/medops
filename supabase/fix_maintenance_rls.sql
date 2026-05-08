-- ============================================================
-- FIX: Missing RLS Policies for Maintenance Logs and Surgery Trays
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- Problema: RLS está activo en estas tablas pero no tienen políticas,
-- bloqueando todas las acciones de inserción y lectura.
-- ============================================================

-- 1. Políticas para MAINTENANCE_LOGS
DROP POLICY IF EXISTS "Maintenance_Select" ON public.maintenance_logs;
CREATE POLICY "Maintenance_Select" 
  ON public.maintenance_logs FOR SELECT 
  TO authenticated 
  USING (get_my_role() IN ('Superadmin', 'Administrador', 'Editor', 'Técnico', 'Lector'));

DROP POLICY IF EXISTS "Maintenance_Insert" ON public.maintenance_logs;
CREATE POLICY "Maintenance_Insert" 
  ON public.maintenance_logs FOR INSERT 
  TO authenticated 
  WITH CHECK (get_my_role() IN ('Superadmin', 'Administrador', 'Editor', 'Técnico'));

-- 2. Políticas para SURGERY_TRAYS (Asignaciones de bandejas a cirugías)
DROP POLICY IF EXISTS "SurgeryTrays_Select" ON public.surgery_trays;
CREATE POLICY "SurgeryTrays_Select" 
  ON public.surgery_trays FOR SELECT 
  TO authenticated 
  USING (get_my_role() IN ('Superadmin', 'Administrador', 'Editor', 'Técnico', 'Lector'));

DROP POLICY IF EXISTS "SurgeryTrays_All" ON public.surgery_trays;
CREATE POLICY "SurgeryTrays_All" 
  ON public.surgery_trays FOR ALL 
  TO authenticated 
  USING (get_my_role() IN ('Superadmin', 'Administrador', 'Editor', 'Técnico'))
  WITH CHECK (get_my_role() IN ('Superadmin', 'Administrador', 'Editor', 'Técnico'));

-- VERIFICACIÓN
SELECT policyname, tablename, cmd 
FROM pg_policies 
WHERE tablename IN ('maintenance_logs', 'surgery_trays');
