-- =================================================================================
-- MIGRACIÓN 0002 — MULTI-TENANCY: ROW LEVEL SECURITY POR ORGANIZACIÓN
-- MedOps · reescribe todas las políticas RLS para aislar data por org_id
-- =================================================================================
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de 0001_multitenancy_schema.sql.
-- Reemplaza por completo a apply_rls.sql.
--
-- Patrón de aislamiento: cada política añade
--     (org_id = get_my_org_id() OR is_platform_admin())
-- a la lógica de rol ya existente. is_platform_admin() ve todas las orgs.
-- =================================================================================

-- ---------------------------------------------------------------------------------
-- 1. Activar RLS en todas las tablas (incluida la nueva organizations)
-- ---------------------------------------------------------------------------------
ALTER TABLE public.organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surgeons             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trays                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surgeries            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surgery_trays        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implants             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implant_lots         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ars                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surgery_consumption  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications        ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------------
-- 2. Limpieza de políticas previas (todas las del schema public)
-- ---------------------------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public')
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname)
         || ' ON public.' || quote_ident(r.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------------
-- 3. Funciones auxiliares (get_my_org_id e is_platform_admin se crean en 0001)
-- ---------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- ---------------------------------------------------------------------------------
-- 4. ORGANIZATIONS — solo el platform admin gestiona; un usuario ve su propia org
-- ---------------------------------------------------------------------------------
CREATE POLICY "Orgs_Select" ON public.organizations FOR SELECT
  USING (id = get_my_org_id() OR is_platform_admin());
CREATE POLICY "Orgs_Platform_All" ON public.organizations FOR ALL
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

-- ---------------------------------------------------------------------------------
-- 5. PROFILES — cada uno ve el suyo; admins ven los de su org; platform ve todos
-- ---------------------------------------------------------------------------------
CREATE POLICY "Profiles_Select" ON public.profiles FOR SELECT USING (
  auth.uid() = id
  OR is_platform_admin()
  OR (get_my_role() IN ('Superadmin','Administrador') AND org_id = get_my_org_id())
);
CREATE POLICY "Profiles_Update" ON public.profiles FOR UPDATE USING (
  auth.uid() = id
  OR is_platform_admin()
  OR (get_my_role() IN ('Superadmin','Administrador') AND org_id = get_my_org_id())
);
CREATE POLICY "Profiles_Admin_All" ON public.profiles FOR ALL USING (
  is_platform_admin()
  OR (get_my_role() IN ('Superadmin','Administrador') AND org_id = get_my_org_id())
) WITH CHECK (
  is_platform_admin()
  OR (get_my_role() IN ('Superadmin','Administrador') AND org_id = get_my_org_id())
);

-- ---------------------------------------------------------------------------------
-- 6. SURGERIES — cirujanos solo lo suyo; staff ve todo lo de SU org
-- ---------------------------------------------------------------------------------
CREATE POLICY "Surgeries_Select" ON public.surgeries FOR SELECT USING (
  (org_id = get_my_org_id() OR is_platform_admin())
  AND (
    get_my_role() IN ('Superadmin','Administrador','Editor','Técnico','Lector')
    OR surgeon_id IN (SELECT id FROM public.surgeons WHERE user_id = auth.uid())
    OR is_platform_admin()
  )
);
CREATE POLICY "Surgeries_Write" ON public.surgeries FOR ALL
  USING (
    (org_id = get_my_org_id() AND get_my_role() IN ('Superadmin','Administrador','Editor'))
    OR is_platform_admin()
  )
  WITH CHECK (
    (org_id = get_my_org_id() AND get_my_role() IN ('Superadmin','Administrador','Editor'))
    OR is_platform_admin()
  );

-- ---------------------------------------------------------------------------------
-- 7. HOSPITALS / SURGEONS / TRAYS — lectura staff interno, escritura admins
-- ---------------------------------------------------------------------------------
CREATE POLICY "Hospitals_Read" ON public.hospitals FOR SELECT USING (
  (org_id = get_my_org_id() OR is_platform_admin())
  AND (get_my_role() IN ('Superadmin','Administrador','Editor','Técnico','Lector') OR is_platform_admin())
);
CREATE POLICY "Hospitals_Write" ON public.hospitals FOR ALL
  USING ((org_id = get_my_org_id() AND get_my_role() IN ('Superadmin','Administrador','Editor')) OR is_platform_admin())
  WITH CHECK ((org_id = get_my_org_id() AND get_my_role() IN ('Superadmin','Administrador','Editor')) OR is_platform_admin());

CREATE POLICY "Surgeons_Read" ON public.surgeons FOR SELECT USING (
  (org_id = get_my_org_id() OR is_platform_admin())
  AND (get_my_role() IN ('Superadmin','Administrador','Editor','Técnico','Lector') OR is_platform_admin())
);
CREATE POLICY "Surgeons_Write" ON public.surgeons FOR ALL
  USING ((org_id = get_my_org_id() AND get_my_role() IN ('Superadmin','Administrador')) OR is_platform_admin())
  WITH CHECK ((org_id = get_my_org_id() AND get_my_role() IN ('Superadmin','Administrador')) OR is_platform_admin());

CREATE POLICY "Trays_Read" ON public.trays FOR SELECT USING (
  (org_id = get_my_org_id() OR is_platform_admin())
  AND (get_my_role() IN ('Superadmin','Administrador','Editor','Técnico','Lector') OR is_platform_admin())
);
CREATE POLICY "Trays_Write" ON public.trays FOR ALL
  USING ((org_id = get_my_org_id() AND get_my_role() IN ('Superadmin','Administrador','Técnico')) OR is_platform_admin())
  WITH CHECK ((org_id = get_my_org_id() AND get_my_role() IN ('Superadmin','Administrador','Técnico')) OR is_platform_admin());

-- ---------------------------------------------------------------------------------
-- 8. SURGERY_TRAYS — staff interno gestiona asignaciones
-- ---------------------------------------------------------------------------------
CREATE POLICY "SurgeryTrays_Read" ON public.surgery_trays FOR SELECT USING (
  (org_id = get_my_org_id() OR is_platform_admin())
  AND (get_my_role() IN ('Superadmin','Administrador','Editor','Técnico','Lector') OR is_platform_admin())
);
CREATE POLICY "SurgeryTrays_Write" ON public.surgery_trays FOR ALL
  USING ((org_id = get_my_org_id() AND get_my_role() IN ('Superadmin','Administrador','Editor','Técnico')) OR is_platform_admin())
  WITH CHECK ((org_id = get_my_org_id() AND get_my_role() IN ('Superadmin','Administrador','Editor','Técnico')) OR is_platform_admin());

-- ---------------------------------------------------------------------------------
-- 9. MAINTENANCE_LOGS — registro por admins y técnicos
-- ---------------------------------------------------------------------------------
CREATE POLICY "Maintenance_Read" ON public.maintenance_logs FOR SELECT USING (
  (org_id = get_my_org_id() OR is_platform_admin())
  AND (get_my_role() IN ('Superadmin','Administrador','Editor','Técnico','Lector') OR is_platform_admin())
);
CREATE POLICY "Maintenance_Write" ON public.maintenance_logs FOR INSERT
  WITH CHECK ((org_id = get_my_org_id() AND get_my_role() IN ('Superadmin','Administrador','Técnico')) OR is_platform_admin());

-- ---------------------------------------------------------------------------------
-- 10. IMPLANTS / IMPLANT_LOTS / ARS — inventario, lectura staff, escritura admins
-- ---------------------------------------------------------------------------------
CREATE POLICY "Implants_Read" ON public.implants FOR SELECT USING (
  (org_id = get_my_org_id() OR is_platform_admin())
  AND (get_my_role() IN ('Superadmin','Administrador','Editor','Técnico','Lector') OR is_platform_admin())
);
CREATE POLICY "Implants_Write" ON public.implants FOR ALL
  USING ((org_id = get_my_org_id() AND get_my_role() IN ('Superadmin','Administrador','Técnico')) OR is_platform_admin())
  WITH CHECK ((org_id = get_my_org_id() AND get_my_role() IN ('Superadmin','Administrador','Técnico')) OR is_platform_admin());

CREATE POLICY "Lots_Read" ON public.implant_lots FOR SELECT USING (
  (org_id = get_my_org_id() OR is_platform_admin())
  AND (get_my_role() IN ('Superadmin','Administrador','Editor','Técnico','Lector') OR is_platform_admin())
);
CREATE POLICY "Lots_Write" ON public.implant_lots FOR ALL
  USING ((org_id = get_my_org_id() AND get_my_role() IN ('Superadmin','Administrador','Técnico','Editor')) OR is_platform_admin())
  WITH CHECK ((org_id = get_my_org_id() AND get_my_role() IN ('Superadmin','Administrador','Técnico','Editor')) OR is_platform_admin());

CREATE POLICY "ARS_Read" ON public.ars FOR SELECT USING (
  (org_id = get_my_org_id() OR is_platform_admin())
  AND (get_my_role() IN ('Superadmin','Administrador','Editor','Técnico','Lector') OR is_platform_admin())
);
CREATE POLICY "ARS_Write" ON public.ars FOR ALL
  USING ((org_id = get_my_org_id() AND get_my_role() IN ('Superadmin','Administrador')) OR is_platform_admin())
  WITH CHECK ((org_id = get_my_org_id() AND get_my_role() IN ('Superadmin','Administrador')) OR is_platform_admin());

-- ---------------------------------------------------------------------------------
-- 11. SURGERY_CONSUMPTION — consumo de implantes en cirugías
-- ---------------------------------------------------------------------------------
CREATE POLICY "Consumption_Read" ON public.surgery_consumption FOR SELECT USING (
  (org_id = get_my_org_id() OR is_platform_admin())
  AND (get_my_role() IN ('Superadmin','Administrador','Editor','Técnico','Lector') OR is_platform_admin())
);
CREATE POLICY "Consumption_Write" ON public.surgery_consumption FOR ALL
  USING ((org_id = get_my_org_id() AND get_my_role() IN ('Superadmin','Administrador','Editor','Técnico')) OR is_platform_admin())
  WITH CHECK ((org_id = get_my_org_id() AND get_my_role() IN ('Superadmin','Administrador','Editor','Técnico')) OR is_platform_admin());

-- ---------------------------------------------------------------------------------
-- 12. ORGANIZATION_SETTINGS — una fila por org; solo Superadmin de la org edita
-- ---------------------------------------------------------------------------------
CREATE POLICY "Settings_Read" ON public.organization_settings FOR SELECT
  USING (org_id = get_my_org_id() OR is_platform_admin());
CREATE POLICY "Settings_Write" ON public.organization_settings FOR ALL
  USING ((org_id = get_my_org_id() AND get_my_role() = 'Superadmin') OR is_platform_admin())
  WITH CHECK ((org_id = get_my_org_id() AND get_my_role() = 'Superadmin') OR is_platform_admin());

-- ---------------------------------------------------------------------------------
-- 13. AUDIT_LOGS — lectura Superadmin de la org; inserción por staff
-- ---------------------------------------------------------------------------------
CREATE POLICY "Audit_Read" ON public.audit_logs FOR SELECT
  USING ((org_id = get_my_org_id() AND get_my_role() = 'Superadmin') OR is_platform_admin());
CREATE POLICY "Audit_Insert" ON public.audit_logs FOR INSERT
  WITH CHECK ((org_id = get_my_org_id() AND get_my_role() IN ('Superadmin','Administrador','Editor','Técnico')) OR is_platform_admin());

-- ---------------------------------------------------------------------------------
-- 14. NOTIFICATIONS — cada usuario ve solo las suyas (y de su org)
-- ---------------------------------------------------------------------------------
CREATE POLICY "Notifications_Select" ON public.notifications FOR SELECT
  USING (auth.uid() = user_id AND (org_id = get_my_org_id() OR is_platform_admin()));
CREATE POLICY "Notifications_Update" ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id AND (org_id = get_my_org_id() OR is_platform_admin()))
  WITH CHECK (auth.uid() = user_id AND (org_id = get_my_org_id() OR is_platform_admin()));

-- ---------------------------------------------------------------------------------
-- 15. TRIGGER notify_surgery_status_change — notifica solo a admins de la MISMA org
-- ---------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_surgery_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (user_id, org_id, title, message, type, entity_id, entity_type)
    SELECT id, NEW.org_id, 'Actualización de Cirugía',
           'La cirugía de ' || NEW.patient_name || ' cambió a ' || NEW.status,
           'surgery_status', NEW.id::text, 'surgeries'
    FROM public.profiles
    WHERE role IN ('Superadmin','Administrador') AND org_id = NEW.org_id;
  END IF;
  RETURN NEW;
END; $$;

-- Mantener SECURITY DEFINER en el trigger de desgaste de bandejas (si existe).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'increment_tray_wear_on_surgery_complete'
  ) THEN
    ALTER FUNCTION public.increment_tray_wear_on_surgery_complete() SECURITY DEFINER;
  END IF;
END $$;

-- =================================================================================
-- FIN 0002 — RLS multi-tenant aplicado. Verificar con dos orgs de prueba.
-- =================================================================================
