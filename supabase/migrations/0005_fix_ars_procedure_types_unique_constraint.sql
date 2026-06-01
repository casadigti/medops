-- ============================================================================
-- 0005_fix_ars_procedure_types_unique_constraint.sql
-- Cambia UNIQUE global por UNIQUE(org_id, name) para soportar multi-tenancy.
-- Sin este fix, dos orgs no pueden tener el mismo nombre de ARS/procedimiento.
-- ============================================================================

-- ARS: unique por (org_id, name) en lugar de solo (name)
ALTER TABLE public.ars DROP CONSTRAINT IF EXISTS ars_name_key;
ALTER TABLE public.ars ADD CONSTRAINT ars_org_name_key UNIQUE (org_id, name);

-- Tipos de procedimiento: igual
ALTER TABLE public.procedure_types DROP CONSTRAINT IF EXISTS procedure_types_name_key;
ALTER TABLE public.procedure_types ADD CONSTRAINT procedure_types_org_name_key UNIQUE (org_id, name);

-- Backfill: copiar catálogos de la org principal a todas las orgs existentes
DO $$
DECLARE
  src_org uuid;
  tgt record;
BEGIN
  SELECT org_id INTO src_org
  FROM public.profiles
  WHERE is_platform_admin = true
  LIMIT 1;

  FOR tgt IN
    SELECT id FROM public.organizations WHERE id <> src_org
  LOOP
    INSERT INTO public.ars (name, is_active, org_id)
    SELECT a.name, a.is_active, tgt.id
    FROM public.ars a
    WHERE a.org_id = src_org
      AND NOT EXISTS (SELECT 1 FROM public.ars x WHERE x.org_id = tgt.id AND x.name = a.name);

    INSERT INTO public.procedure_types (name, is_active, org_id)
    SELECT p.name, p.is_active, tgt.id
    FROM public.procedure_types p
    WHERE p.org_id = src_org
      AND NOT EXISTS (SELECT 1 FROM public.procedure_types y WHERE y.org_id = tgt.id AND y.name = p.name);
  END LOOP;
END $$;
