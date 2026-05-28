-- ============================================================================
-- 0000_baseline_schema.sql
-- ----------------------------------------------------------------------------
-- Baseline del schema de PRODUCCIÓN de MedOps, reconstruido por introspección
-- de la base viva (information_schema + pg_policies + pg_proc) el 2026-05-28.
--
-- Propósito: versionar el schema real para reproducibilidad. Estas 14+ tablas
-- fueron creadas/alteradas a mano en el dashboard de Supabase y no tenían
-- CREATE TABLE en git. Este archivo permite recrear la base desde cero
-- (entorno local, staging, o recuperación ante desastre).
--
-- ORDEN: extensiones -> organizations -> profiles -> funciones auxiliares
--        (get_my_org_id depende de profiles, y se usa como DEFAULT en el resto)
--        -> resto de tablas -> claves foráneas -> triggers -> RLS.
--
-- NOTA: NO ejecutar contra la base de producción actual (ya tiene todo esto).
--       Es referencia / baseline para entornos nuevos.
-- ============================================================================

-- ─── Extensiones ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- gen_random_uuid()

-- ============================================================================
-- TABLAS RAÍZ (sin dependencias de funciones)
-- ============================================================================

-- ─── organizations ───────────────────────────────────────────────────────────
CREATE TABLE public.organizations (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  slug        text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  max_users   integer     NOT NULL DEFAULT 20,
  CONSTRAINT organizations_pkey PRIMARY KEY (id),
  CONSTRAINT organizations_slug_key UNIQUE (slug)
);

-- ─── profiles ─────────────────────────────────────────────────────────────────
-- id = auth.users.id (1:1). org_id nullable: un platform admin puede no tener org.
CREATE TABLE public.profiles (
  id                   uuid    NOT NULL,
  full_name            text,
  email                text,
  role                 text    DEFAULT 'Editor'::text,
  is_active            boolean DEFAULT true,
  must_change_password boolean DEFAULT false,
  updated_at           timestamptz DEFAULT timezone('utc'::text, now()),
  org_id               uuid,
  is_platform_admin    boolean NOT NULL DEFAULT false,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id)
);

-- ============================================================================
-- FUNCIONES AUXILIARES (dependen de profiles; usadas como DEFAULT y en RLS)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_my_org_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT org_id FROM public.profiles WHERE id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.get_my_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(profiles.is_platform_admin, false)
  FROM public.profiles WHERE profiles.id = auth.uid();
$function$;

-- Crea automáticamente un profile cuando se registra un usuario en auth.users.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, is_active)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email, 'Lector', false)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- Borra el usuario de auth cuando se elimina su profile.
CREATE OR REPLACE FUNCTION public.delete_user_from_auth()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
END;
$function$;

-- Mantiene updated_at en cada UPDATE.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- Suma desgaste/esterilización a las bandejas cuando una cirugía pasa a Completada.
CREATE OR REPLACE FUNCTION public.increment_tray_wear_on_surgery_complete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF NEW.status = 'Completada' AND OLD.status IS DISTINCT FROM 'Completada' THEN
        UPDATE trays
        SET sterilization_count = sterilization_count + 1
        WHERE id IN (
            SELECT tray_id FROM surgery_trays WHERE surgery_id = NEW.id
        );
    END IF;
    RETURN NEW;
END;
$function$;

-- Notifica a los admins de la MISMA org cuando cambia el estado de una cirugía.
CREATE OR REPLACE FUNCTION public.notify_surgery_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (user_id, org_id, title, message, type, entity_id, entity_type)
    SELECT
      p.id,
      NEW.org_id,
      'Actualización de Cirugía',
      'La cirugía de ' || NEW.patient_name || ' cambió a estado: ' || NEW.status,
      'surgery_status',
      NEW.id::text,
      'surgeries'
    FROM public.profiles p
    WHERE p.role IN ('Superadmin', 'Administrador')
      AND p.org_id = NEW.org_id
      AND p.is_active = true;
  END IF;
  RETURN NEW;
END;
$function$;

-- ============================================================================
-- TABLAS DE DATOS (org_id DEFAULT get_my_org_id() => el INSERT lo llena solo)
-- ============================================================================

-- ─── organization_settings ───────────────────────────────────────────────────
-- Conserva el id integer legacy (singleton) + org_id (modelo multi-tenant).
CREATE TABLE public.organization_settings (
  id              integer NOT NULL DEFAULT 1,
  name            text    DEFAULT 'MedOps Dominicana'::text,
  logo_url        text,
  primary_color   text    DEFAULT '#1e40af'::text,
  secondary_color text    DEFAULT '#64748b'::text,
  accent_color    text    DEFAULT '#0ea5e9'::text,
  updated_at      timestamptz DEFAULT timezone('utc'::text, now()),
  org_id          uuid    NOT NULL DEFAULT get_my_org_id(),
  CONSTRAINT organization_settings_pkey PRIMARY KEY (id),
  CONSTRAINT organization_settings_org_id_key UNIQUE (org_id),
  CONSTRAINT organization_settings_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id)
);

-- ─── ars ─────────────────────────────────────────────────────────────────────
CREATE TABLE public.ars (
  id         uuid        NOT NULL DEFAULT uuid_generate_v4(),
  name       text        NOT NULL,
  is_active  boolean     DEFAULT true,
  created_at timestamptz DEFAULT now(),
  org_id     uuid        NOT NULL DEFAULT get_my_org_id(),
  CONSTRAINT ars_pkey PRIMARY KEY (id),
  CONSTRAINT ars_name_key UNIQUE (name),
  CONSTRAINT ars_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id)
);

-- ─── procedure_types ──────────────────────────────────────────────────────────
CREATE TABLE public.procedure_types (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  org_id     uuid        DEFAULT get_my_org_id(),
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT procedure_types_pkey PRIMARY KEY (id),
  CONSTRAINT procedure_types_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id)
);

-- ─── hospitals ────────────────────────────────────────────────────────────────
CREATE TABLE public.hospitals (
  id                    uuid        NOT NULL DEFAULT gen_random_uuid(),
  name                  text        NOT NULL,
  address               text,
  operating_rooms       jsonb       DEFAULT '[]'::jsonb,
  coordinator_contact   text,
  logistics_notes       text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  org_id                uuid        NOT NULL DEFAULT get_my_org_id(),
  requires_support_tray boolean     NOT NULL DEFAULT false,
  CONSTRAINT hospitals_pkey PRIMARY KEY (id),
  CONSTRAINT hospitals_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id)
);

-- ─── surgeons ─────────────────────────────────────────────────────────────────
CREATE TABLE public.surgeons (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  full_name   text        NOT NULL,
  specialty   text,
  phone       text,
  email       text,
  preferences text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  user_id     uuid,
  org_id      uuid        NOT NULL DEFAULT get_my_org_id(),
  CONSTRAINT surgeons_pkey PRIMARY KEY (id),
  CONSTRAINT surgeons_user_id_key UNIQUE (user_id),
  CONSTRAINT surgeons_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT surgeons_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id)
);

-- ─── implants ─────────────────────────────────────────────────────────────────
CREATE TABLE public.implants (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  sku           text        NOT NULL,
  category      text,
  description   text,
  base_unit     text        DEFAULT 'UN'::text,
  min_stock     integer     DEFAULT 5,
  created_at    timestamptz DEFAULT now(),
  unit_cost     numeric     DEFAULT 0,
  selling_price numeric     DEFAULT 0,
  org_id        uuid        NOT NULL DEFAULT get_my_org_id(),
  CONSTRAINT implants_pkey PRIMARY KEY (id),
  CONSTRAINT implants_sku_key UNIQUE (sku),
  CONSTRAINT implants_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id)
);

-- ─── implant_lots ─────────────────────────────────────────────────────────────
CREATE TABLE public.implant_lots (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  implant_id       uuid,
  lot_number       text        NOT NULL,
  expiration_date  date        NOT NULL,
  current_quantity integer     NOT NULL DEFAULT 0,
  location         text,
  created_at       timestamptz DEFAULT now(),
  org_id           uuid        NOT NULL DEFAULT get_my_org_id(),
  CONSTRAINT implant_lots_pkey PRIMARY KEY (id),
  CONSTRAINT implant_lots_implant_id_fkey FOREIGN KEY (implant_id) REFERENCES public.implants(id),
  CONSTRAINT implant_lots_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id)
);

-- ─── trays ────────────────────────────────────────────────────────────────────
CREATE TABLE public.trays (
  id                  uuid        NOT NULL DEFAULT gen_random_uuid(),
  name                text        NOT NULL,
  code                text        NOT NULL,
  procedure_type      text,
  content             text,
  status              text        NOT NULL DEFAULT 'Disponible'::text,
  location            text,
  sterilization_count integer     DEFAULT 0,
  last_sterilization  timestamptz,
  next_maintenance    timestamptz,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  org_id              uuid        NOT NULL DEFAULT get_my_org_id(),
  is_support_tray     boolean     NOT NULL DEFAULT false,
  CONSTRAINT trays_pkey PRIMARY KEY (id),
  CONSTRAINT trays_code_key UNIQUE (code),
  CONSTRAINT trays_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id)
);

-- ─── surgeries ────────────────────────────────────────────────────────────────
CREATE TABLE public.surgeries (
  id                   uuid        NOT NULL DEFAULT gen_random_uuid(),
  patient_name         text        NOT NULL,
  surgery_date         timestamptz NOT NULL,
  surgeon_id           uuid,
  hospital_id          uuid,
  operating_room       text,
  procedure_type       text        NOT NULL,
  status               text        NOT NULL DEFAULT 'Pendiente'::text,
  delivery_responsible text,
  notes                text,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now(),
  ars_id               uuid,
  org_id               uuid        NOT NULL DEFAULT get_my_org_id(),
  nss                  text,
  CONSTRAINT surgeries_pkey PRIMARY KEY (id),
  CONSTRAINT surgeries_surgeon_id_fkey  FOREIGN KEY (surgeon_id)  REFERENCES public.surgeons(id),
  CONSTRAINT surgeries_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.hospitals(id),
  CONSTRAINT surgeries_ars_id_fkey      FOREIGN KEY (ars_id)      REFERENCES public.ars(id),
  CONSTRAINT surgeries_org_id_fkey      FOREIGN KEY (org_id)      REFERENCES public.organizations(id)
);

-- ─── surgery_trays (junction; PK compuesta) ───────────────────────────────────
CREATE TABLE public.surgery_trays (
  surgery_id uuid NOT NULL,
  tray_id    uuid NOT NULL,
  org_id     uuid NOT NULL DEFAULT get_my_org_id(),
  CONSTRAINT surgery_trays_pkey PRIMARY KEY (surgery_id, tray_id),
  CONSTRAINT surgery_trays_surgery_id_fkey FOREIGN KEY (surgery_id) REFERENCES public.surgeries(id) ON DELETE CASCADE,
  CONSTRAINT surgery_trays_tray_id_fkey    FOREIGN KEY (tray_id)    REFERENCES public.trays(id),
  CONSTRAINT surgery_trays_org_id_fkey     FOREIGN KEY (org_id)     REFERENCES public.organizations(id)
);

-- ─── surgery_consumption ──────────────────────────────────────────────────────
CREATE TABLE public.surgery_consumption (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  surgery_id     uuid,
  implant_lot_id uuid,
  quantity_used  integer     NOT NULL DEFAULT 1,
  used_at        timestamptz DEFAULT now(),
  notes          text,
  auth_number    text,
  org_id         uuid        NOT NULL DEFAULT get_my_org_id(),
  CONSTRAINT surgery_consumption_pkey PRIMARY KEY (id),
  CONSTRAINT surgery_consumption_surgery_id_fkey     FOREIGN KEY (surgery_id)     REFERENCES public.surgeries(id) ON DELETE CASCADE,
  CONSTRAINT surgery_consumption_implant_lot_id_fkey FOREIGN KEY (implant_lot_id) REFERENCES public.implant_lots(id),
  CONSTRAINT surgery_consumption_org_id_fkey         FOREIGN KEY (org_id)         REFERENCES public.organizations(id)
);

-- ─── maintenance_logs ─────────────────────────────────────────────────────────
CREATE TABLE public.maintenance_logs (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  tray_id      uuid,
  action       text        NOT NULL,
  performed_by text,
  notes        text,
  created_at   timestamptz DEFAULT now(),
  org_id       uuid        NOT NULL DEFAULT get_my_org_id(),
  CONSTRAINT maintenance_logs_pkey PRIMARY KEY (id),
  CONSTRAINT maintenance_logs_tray_id_fkey FOREIGN KEY (tray_id) REFERENCES public.trays(id),
  CONSTRAINT maintenance_logs_org_id_fkey  FOREIGN KEY (org_id)  REFERENCES public.organizations(id)
);

-- ─── notifications ────────────────────────────────────────────────────────────
-- user_id apunta a auth.users (no a profiles); FK no declarada en prod.
CREATE TABLE public.notifications (
  id          uuid        NOT NULL DEFAULT uuid_generate_v4(),
  user_id     uuid,
  title       text        NOT NULL,
  message     text        NOT NULL,
  type        text        DEFAULT 'info'::text,
  link        text,
  is_read     boolean     DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  org_id      uuid        NOT NULL DEFAULT get_my_org_id(),
  entity_id   text,
  entity_type text,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id)
);

-- ─── audit_logs ───────────────────────────────────────────────────────────────
CREATE TABLE public.audit_logs (
  id          uuid        NOT NULL DEFAULT uuid_generate_v4(),
  user_id     uuid,
  user_email  text,
  action      text        NOT NULL,
  entity_type text        NOT NULL,
  entity_id   text,
  details     jsonb       DEFAULT '{}'::jsonb,
  created_at  timestamptz DEFAULT now(),
  org_id      uuid        NOT NULL DEFAULT get_my_org_id(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id)
);

-- ============================================================================
-- ÍNDICES de org_id (acelera el filtro de RLS por organización)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_ars_org_id                 ON public.ars(org_id);
CREATE INDEX IF NOT EXISTS idx_procedure_types_org_id      ON public.procedure_types(org_id);
CREATE INDEX IF NOT EXISTS idx_hospitals_org_id            ON public.hospitals(org_id);
CREATE INDEX IF NOT EXISTS idx_surgeons_org_id             ON public.surgeons(org_id);
CREATE INDEX IF NOT EXISTS idx_implants_org_id             ON public.implants(org_id);
CREATE INDEX IF NOT EXISTS idx_implant_lots_org_id         ON public.implant_lots(org_id);
CREATE INDEX IF NOT EXISTS idx_trays_org_id                ON public.trays(org_id);
CREATE INDEX IF NOT EXISTS idx_surgeries_org_id            ON public.surgeries(org_id);
CREATE INDEX IF NOT EXISTS idx_surgery_trays_org_id        ON public.surgery_trays(org_id);
CREATE INDEX IF NOT EXISTS idx_surgery_consumption_org_id  ON public.surgery_consumption(org_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_org_id     ON public.maintenance_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org_id        ON public.notifications(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id           ON public.audit_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_profiles_org_id             ON public.profiles(org_id);

-- ============================================================================
-- TRIGGERS
-- NOTA: los bindings (tabla/evento) están reconstruidos a partir de las
-- funciones; verificar contra producción si se requiere fidelidad exacta.
-- ============================================================================

-- Crear profile al registrar usuario en auth.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Borrar usuario de auth al borrar su profile.
CREATE TRIGGER on_profile_deleted
  AFTER DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.delete_user_from_auth();

-- Mantener updated_at en las tablas que lo tienen.
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.organization_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.hospitals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.surgeons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.surgeries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.trays
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Desgaste de bandejas + notificación al completar/cambiar estado de cirugía.
CREATE TRIGGER trg_increment_tray_wear
  AFTER UPDATE ON public.surgeries
  FOR EACH ROW EXECUTE FUNCTION public.increment_tray_wear_on_surgery_complete();
CREATE TRIGGER trg_notify_surgery_status
  AFTER UPDATE ON public.surgeries
  FOR EACH ROW EXECUTE FUNCTION public.notify_surgery_status_change();

-- ============================================================================
-- ROW-LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.organizations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ars                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedure_types       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitals             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surgeons              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implants              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implant_lots          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trays                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surgeries             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surgery_trays         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surgery_consumption   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs            ENABLE ROW LEVEL SECURITY;

-- ─── organizations ───────────────────────────────────────────────────────────
CREATE POLICY "Orgs_Platform_All" ON public.organizations FOR ALL
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY "Orgs_Select" ON public.organizations FOR SELECT
  USING ((id = get_my_org_id()) OR is_platform_admin());

-- ─── profiles ─────────────────────────────────────────────────────────────────
CREATE POLICY "Profiles_Admin_All" ON public.profiles FOR ALL
  USING (is_platform_admin() OR ((get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text])) AND (org_id = get_my_org_id())))
  WITH CHECK (is_platform_admin() OR ((get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text])) AND (org_id = get_my_org_id())));
CREATE POLICY "Profiles_Select" ON public.profiles FOR SELECT
  USING ((auth.uid() = id) OR is_platform_admin() OR ((get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text])) AND (org_id = get_my_org_id())));
CREATE POLICY "Profiles_Update" ON public.profiles FOR UPDATE
  USING ((auth.uid() = id) OR is_platform_admin() OR ((get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text])) AND (org_id = get_my_org_id())));

-- ─── organization_settings ───────────────────────────────────────────────────
CREATE POLICY "Settings_Read" ON public.organization_settings FOR SELECT
  USING ((org_id = get_my_org_id()) OR is_platform_admin());
CREATE POLICY "Settings_Write" ON public.organization_settings FOR ALL
  USING (((org_id = get_my_org_id()) AND (get_my_role() = 'Superadmin'::text)) OR is_platform_admin())
  WITH CHECK (((org_id = get_my_org_id()) AND (get_my_role() = 'Superadmin'::text)) OR is_platform_admin());

-- ─── ars ─────────────────────────────────────────────────────────────────────
CREATE POLICY "ARS_Read" ON public.ars FOR SELECT
  USING (((org_id = get_my_org_id()) OR is_platform_admin()) AND ((get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text, 'Editor'::text, 'Técnico'::text, 'Lector'::text])) OR is_platform_admin()));
CREATE POLICY "ARS_Write" ON public.ars FOR ALL
  USING (((org_id = get_my_org_id()) AND (get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text]))) OR is_platform_admin())
  WITH CHECK (((org_id = get_my_org_id()) AND (get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text]))) OR is_platform_admin());

-- ─── procedure_types ──────────────────────────────────────────────────────────
CREATE POLICY "pt_select" ON public.procedure_types FOR SELECT
  USING ((org_id = get_my_org_id()) OR is_platform_admin());
CREATE POLICY "pt_insert" ON public.procedure_types FOR INSERT
  WITH CHECK ((get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text])) AND ((org_id = get_my_org_id()) OR is_platform_admin()));
CREATE POLICY "pt_update" ON public.procedure_types FOR UPDATE
  USING ((org_id = get_my_org_id()) OR is_platform_admin())
  WITH CHECK (get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text]));
CREATE POLICY "pt_delete" ON public.procedure_types FOR DELETE
  USING ((get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text])) AND ((org_id = get_my_org_id()) OR is_platform_admin()));

-- ─── hospitals ────────────────────────────────────────────────────────────────
CREATE POLICY "Hospitals_Read" ON public.hospitals FOR SELECT
  USING (((org_id = get_my_org_id()) OR is_platform_admin()) AND ((get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text, 'Editor'::text, 'Técnico'::text, 'Lector'::text])) OR is_platform_admin()));
CREATE POLICY "Hospitals_Write" ON public.hospitals FOR ALL
  USING (((org_id = get_my_org_id()) AND (get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text, 'Editor'::text]))) OR is_platform_admin())
  WITH CHECK (((org_id = get_my_org_id()) AND (get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text, 'Editor'::text]))) OR is_platform_admin());

-- ─── surgeons ─────────────────────────────────────────────────────────────────
CREATE POLICY "Surgeons_Read" ON public.surgeons FOR SELECT
  USING (((org_id = get_my_org_id()) OR is_platform_admin()) AND ((get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text, 'Editor'::text, 'Técnico'::text, 'Lector'::text])) OR is_platform_admin()));
CREATE POLICY "Surgeons_Write" ON public.surgeons FOR ALL
  USING (((org_id = get_my_org_id()) AND (get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text]))) OR is_platform_admin())
  WITH CHECK (((org_id = get_my_org_id()) AND (get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text]))) OR is_platform_admin());

-- ─── implants ─────────────────────────────────────────────────────────────────
CREATE POLICY "Implants_Read" ON public.implants FOR SELECT
  USING (((org_id = get_my_org_id()) OR is_platform_admin()) AND ((get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text, 'Editor'::text, 'Técnico'::text, 'Lector'::text])) OR is_platform_admin()));
CREATE POLICY "Implants_Write" ON public.implants FOR ALL
  USING (((org_id = get_my_org_id()) AND (get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text, 'Técnico'::text]))) OR is_platform_admin())
  WITH CHECK (((org_id = get_my_org_id()) AND (get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text, 'Técnico'::text]))) OR is_platform_admin());

-- ─── implant_lots ─────────────────────────────────────────────────────────────
CREATE POLICY "Lots_Read" ON public.implant_lots FOR SELECT
  USING (((org_id = get_my_org_id()) OR is_platform_admin()) AND ((get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text, 'Editor'::text, 'Técnico'::text, 'Lector'::text])) OR is_platform_admin()));
CREATE POLICY "Lots_Write" ON public.implant_lots FOR ALL
  USING (((org_id = get_my_org_id()) AND (get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text, 'Técnico'::text, 'Editor'::text]))) OR is_platform_admin())
  WITH CHECK (((org_id = get_my_org_id()) AND (get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text, 'Técnico'::text, 'Editor'::text]))) OR is_platform_admin());

-- ─── trays ────────────────────────────────────────────────────────────────────
CREATE POLICY "Trays_Read" ON public.trays FOR SELECT
  USING (((org_id = get_my_org_id()) OR is_platform_admin()) AND ((get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text, 'Editor'::text, 'Técnico'::text, 'Lector'::text])) OR is_platform_admin()));
CREATE POLICY "Trays_Write" ON public.trays FOR ALL
  USING (((org_id = get_my_org_id()) AND (get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text, 'Técnico'::text]))) OR is_platform_admin())
  WITH CHECK (((org_id = get_my_org_id()) AND (get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text, 'Técnico'::text]))) OR is_platform_admin());

-- ─── surgeries ────────────────────────────────────────────────────────────────
-- Un cirujano ve sus propias cirugías (surgeon_id ligado a su user_id).
CREATE POLICY "Surgeries_Select" ON public.surgeries FOR SELECT
  USING (((org_id = get_my_org_id()) OR is_platform_admin()) AND ((get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text, 'Editor'::text, 'Técnico'::text, 'Lector'::text])) OR (surgeon_id IN (SELECT surgeons.id FROM surgeons WHERE (surgeons.user_id = auth.uid()))) OR is_platform_admin()));
CREATE POLICY "Surgeries_Write" ON public.surgeries FOR ALL
  USING (((org_id = get_my_org_id()) AND (get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text, 'Editor'::text]))) OR is_platform_admin())
  WITH CHECK (((org_id = get_my_org_id()) AND (get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text, 'Editor'::text]))) OR is_platform_admin());

-- ─── surgery_trays ────────────────────────────────────────────────────────────
CREATE POLICY "SurgeryTrays_Read" ON public.surgery_trays FOR SELECT
  USING (((org_id = get_my_org_id()) OR is_platform_admin()) AND ((get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text, 'Editor'::text, 'Técnico'::text, 'Lector'::text])) OR is_platform_admin()));
CREATE POLICY "SurgeryTrays_Write" ON public.surgery_trays FOR ALL
  USING (((org_id = get_my_org_id()) AND (get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text, 'Editor'::text, 'Técnico'::text]))) OR is_platform_admin())
  WITH CHECK (((org_id = get_my_org_id()) AND (get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text, 'Editor'::text, 'Técnico'::text]))) OR is_platform_admin());

-- ─── surgery_consumption ──────────────────────────────────────────────────────
CREATE POLICY "Consumption_Read" ON public.surgery_consumption FOR SELECT
  USING (((org_id = get_my_org_id()) OR is_platform_admin()) AND ((get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text, 'Editor'::text, 'Técnico'::text, 'Lector'::text])) OR is_platform_admin()));
CREATE POLICY "Consumption_Write" ON public.surgery_consumption FOR ALL
  USING (((org_id = get_my_org_id()) AND (get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text, 'Editor'::text, 'Técnico'::text]))) OR is_platform_admin())
  WITH CHECK (((org_id = get_my_org_id()) AND (get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text, 'Editor'::text, 'Técnico'::text]))) OR is_platform_admin());

-- ─── maintenance_logs ─────────────────────────────────────────────────────────
CREATE POLICY "Maintenance_Read" ON public.maintenance_logs FOR SELECT
  USING (((org_id = get_my_org_id()) OR is_platform_admin()) AND ((get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text, 'Editor'::text, 'Técnico'::text, 'Lector'::text])) OR is_platform_admin()));
CREATE POLICY "Maintenance_Write" ON public.maintenance_logs FOR INSERT
  WITH CHECK (((org_id = get_my_org_id()) AND (get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text, 'Técnico'::text]))) OR is_platform_admin());

-- ─── notifications (por usuario, no por rol) ──────────────────────────────────
-- INSERT lo hace el trigger notify_surgery_status_change (SECURITY DEFINER).
CREATE POLICY "Notifications_Select" ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Notifications_Update" ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── audit_logs ───────────────────────────────────────────────────────────────
CREATE POLICY "Audit_Read" ON public.audit_logs FOR SELECT
  USING (((org_id = get_my_org_id()) AND (get_my_role() = 'Superadmin'::text)) OR is_platform_admin());
CREATE POLICY "Audit_Insert" ON public.audit_logs FOR INSERT
  WITH CHECK (((org_id = get_my_org_id()) AND (get_my_role() = ANY (ARRAY['Superadmin'::text, 'Administrador'::text, 'Editor'::text, 'Técnico'::text]))) OR is_platform_admin());

-- ============================================================================
-- FIN baseline
-- ============================================================================
