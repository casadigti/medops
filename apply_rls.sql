-- =================================================================================
-- SCRIPT DE SEGURIDAD (RLS) - MEDOPS
-- Instrucciones: Ejecuta este código en el SQL Editor de Supabase
-- Objetivo: Bloquear el acceso público y requerir autenticación para ver/editar datos
-- =================================================================================

-- 1. Asegurarnos de que el RLS esté activo en todas las tablas principales
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgeons ENABLE ROW LEVEL SECURITY;
ALTER TABLE trays ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgeries ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgery_trays ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar las políticas temporales de "Acceso Público" que teníamos antes
DROP POLICY IF EXISTS "Public Access" ON hospitals;
DROP POLICY IF EXISTS "Public Access" ON surgeons;
DROP POLICY IF EXISTS "Public Access" ON trays;
DROP POLICY IF EXISTS "Public Access" ON surgeries;
DROP POLICY IF EXISTS "Public Access" ON surgery_trays;
DROP POLICY IF EXISTS "Public Access" ON maintenance_logs;
DROP POLICY IF EXISTS "Public Access" ON profiles;
DROP POLICY IF EXISTS "Public Access" ON organization_settings;

-- 3. Crear Políticas de "Acceso Autenticado" (Solo usuarios logueados)
-- HOSPITALS
CREATE POLICY "Auth Users Can Read Hospitals" ON hospitals FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth Users Can Insert Hospitals" ON hospitals FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth Users Can Update Hospitals" ON hospitals FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth Users Can Delete Hospitals" ON hospitals FOR DELETE USING (auth.role() = 'authenticated');

-- SURGEONS
CREATE POLICY "Auth Users Can Read Surgeons" ON surgeons FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth Users Can Insert Surgeons" ON surgeons FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth Users Can Update Surgeons" ON surgeons FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth Users Can Delete Surgeons" ON surgeons FOR DELETE USING (auth.role() = 'authenticated');

-- TRAYS
CREATE POLICY "Auth Users Can Read Trays" ON trays FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth Users Can Insert Trays" ON trays FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth Users Can Update Trays" ON trays FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth Users Can Delete Trays" ON trays FOR DELETE USING (auth.role() = 'authenticated');

-- SURGERIES
CREATE POLICY "Auth Users Can Read Surgeries" ON surgeries FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth Users Can Insert Surgeries" ON surgeries FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth Users Can Update Surgeries" ON surgeries FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth Users Can Delete Surgeries" ON surgeries FOR DELETE USING (auth.role() = 'authenticated');

-- SURGERY_TRAYS
CREATE POLICY "Auth Users Can Read SurgeryTrays" ON surgery_trays FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth Users Can Insert SurgeryTrays" ON surgery_trays FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth Users Can Update SurgeryTrays" ON surgery_trays FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth Users Can Delete SurgeryTrays" ON surgery_trays FOR DELETE USING (auth.role() = 'authenticated');

-- MAINTENANCE_LOGS
CREATE POLICY "Auth Users Can Read Logs" ON maintenance_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth Users Can Insert Logs" ON maintenance_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ORGANIZATION_SETTINGS (Solo Superadmin debería poder actualizar, pero para empezar lo limitamos a autenticados)
CREATE POLICY "Auth Users Can Read Settings" ON organization_settings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth Users Can Update Settings" ON organization_settings FOR UPDATE USING (auth.role() = 'authenticated');

-- PROFILES (Identidad)
CREATE POLICY "Auth Users Can Read Profiles" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth Users Can Insert Profiles" ON profiles FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth Users Can Update Profiles" ON profiles FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth Users Can Delete Profiles" ON profiles FOR DELETE USING (auth.role() = 'authenticated');

-- FIN DEL SCRIPT
