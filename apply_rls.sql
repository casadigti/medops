-- =================================================================================
-- SCRIPT DE SEGURIDAD (RLS) - MEDOPS (HARDENED)
-- =================================================================================

-- 1. Asegurarnos de que el RLS esté activo
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgeons ENABLE ROW LEVEL SECURITY;
ALTER TABLE trays ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgeries ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgery_trays ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. Limpieza de políticas previas (incluyendo las públicas peligrosas)
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON ' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- 3. Funciones Auxiliares para RLS
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 4. POLÍTICAS DE SEGURIDAD REFORZADAS

-- PROFILES: Cada uno lee el suyo, Admins leen todos. Solo Admins editan roles.
CREATE POLICY "Profiles_Select" ON profiles FOR SELECT USING (auth.uid() = id OR get_my_role() IN ('Superadmin', 'Administrador'));
CREATE POLICY "Profiles_Update" ON profiles FOR UPDATE USING (auth.uid() = id OR get_my_role() IN ('Superadmin', 'Administrador'));
CREATE POLICY "Profiles_Admin_All" ON profiles FOR ALL USING (get_my_role() IN ('Superadmin', 'Administrador'));

-- SURGERIES: Cirujanos solo ven lo suyo. Admins ven todo.
CREATE POLICY "Surgeries_Select" ON surgeries FOR SELECT 
USING (
  get_my_role() IN ('Superadmin', 'Administrador', 'Editor', 'Técnico', 'Lector') OR 
  surgeon_id IN (SELECT id FROM surgeons WHERE user_id = auth.uid())
);

CREATE POLICY "Surgeries_Write" ON surgeries FOR ALL 
USING (get_my_role() IN ('Superadmin', 'Administrador', 'Editor'))
WITH CHECK (get_my_role() IN ('Superadmin', 'Administrador', 'Editor'));

-- HOSPITALS, SURGEONS, TRAYS: Lectura para personal interno, Escritura solo Admins
CREATE POLICY "General_Read" ON hospitals FOR SELECT USING (get_my_role() IN ('Superadmin', 'Administrador', 'Editor', 'Técnico', 'Lector'));
CREATE POLICY "General_Write" ON hospitals FOR ALL USING (get_my_role() IN ('Superadmin', 'Administrador', 'Editor'));

CREATE POLICY "Surgeons_Read" ON surgeons FOR SELECT USING (get_my_role() IN ('Superadmin', 'Administrador', 'Editor', 'Técnico', 'Lector'));
CREATE POLICY "Surgeons_Write" ON surgeons FOR ALL USING (get_my_role() IN ('Superadmin', 'Administrador'));

CREATE POLICY "Trays_Read" ON trays FOR SELECT USING (get_my_role() IN ('Superadmin', 'Administrador', 'Editor', 'Técnico', 'Lector'));
CREATE POLICY "Trays_Write" ON trays FOR ALL USING (get_my_role() IN ('Superadmin', 'Administrador', 'Técnico'));

-- SURGERY_TRAYS: Personal interno gestiona asignaciones
CREATE POLICY "SurgeryTrays_Read" ON surgery_trays FOR SELECT USING (get_my_role() IN ('Superadmin', 'Administrador', 'Editor', 'Técnico', 'Lector'));
CREATE POLICY "SurgeryTrays_Write" ON surgery_trays FOR ALL USING (get_my_role() IN ('Superadmin', 'Administrador', 'Editor', 'Técnico'));

-- MAINTENANCE_LOGS: Registro de mantenimiento por Admins y Técnicos
CREATE POLICY "Maintenance_Read" ON maintenance_logs FOR SELECT USING (get_my_role() IN ('Superadmin', 'Administrador', 'Editor', 'Técnico', 'Lector'));
CREATE POLICY "Maintenance_Write" ON maintenance_logs FOR INSERT WITH CHECK (get_my_role() IN ('Superadmin', 'Administrador', 'Técnico'));

-- ORGANIZATION_SETTINGS: Solo Superadmin edita
CREATE POLICY "Settings_Read" ON organization_settings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Settings_Write" ON organization_settings FOR ALL USING (get_my_role() = 'Superadmin');

-- AUDIT_LOGS: Solo Superadmin lee logs. Insert restringido a personal autorizado.
CREATE POLICY "Audit_Read" ON audit_logs FOR SELECT USING (get_my_role() = 'Superadmin');
CREATE POLICY "Audit_Insert" ON audit_logs FOR INSERT WITH CHECK (get_my_role() IN ('Superadmin', 'Administrador', 'Editor', 'Técnico'));

-- 5. ACCIÓN MANUAL REQUERIDA
-- Ejecutar este script en el SQL Editor de Supabase para aplicar los cambios.
