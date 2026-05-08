-- ============================================================
-- FIX: Notifications RLS + Trigger Security
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- Problema: El trigger que inserta notificaciones al cambiar
-- el estado de una cirugía viola la política RLS de la tabla
-- notifications porque corre con permisos del usuario, no del sistema.
-- ============================================================

-- 1. Asegurarse de que RLS está activo en notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 2. Política: los usuarios autenticados pueden VER sus propias notificaciones
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. Política: los usuarios autenticados pueden marcar SUS notificaciones como leídas
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Política: el SERVICE ROLE puede insertar notificaciones (para triggers del sistema)
--    Esto es lo que faltaba — el trigger corre como 'authenticated', no como 'service_role'.
--    La solución correcta es hacer el trigger SECURITY DEFINER.

-- 5. Buscar y recrear el trigger de notificaciones como SECURITY DEFINER
--    Primero, identificamos la función que usa el trigger:
DO $$
DECLARE
  trigger_func_name TEXT;
BEGIN
  SELECT p.proname INTO trigger_func_name
  FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  JOIN pg_proc p ON t.tgfoid = p.oid
  WHERE c.relname = 'surgeries'
    AND t.tgname ILIKE '%notif%'
  LIMIT 1;
  
  IF trigger_func_name IS NOT NULL THEN
    RAISE NOTICE 'Found trigger function: %', trigger_func_name;
  ELSE
    RAISE NOTICE 'No notification trigger found on surgeries table';
  END IF;
END $$;

-- 6. Solución directa: crear/reemplazar la función del trigger con SECURITY DEFINER
--    Esto permite que el trigger inserte en notifications sin importar quien llame el UPDATE.
--    Ajusta el nombre de la función según lo que retorne el DO block de arriba.

CREATE OR REPLACE FUNCTION public.notify_surgery_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER   -- ← Clave: corre como el dueño de la función (postgres), bypass RLS
SET search_path = public
AS $$
BEGIN
  -- Solo actuar cuando el status cambia
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (user_id, title, message, type, entity_id, entity_type)
    SELECT 
      p.id,
      'Actualización de Cirugía',
      'La cirugía de ' || NEW.patient_name || ' cambió a estado: ' || NEW.status,
      'surgery_status',
      NEW.id::text,
      'surgeries'
    FROM public.profiles p
    WHERE p.role IN ('Superadmin', 'Administrador')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- 7. Recrear el trigger si no existe (o ya existe con el nombre correcto)
DROP TRIGGER IF EXISTS trg_notify_surgery_status ON public.surgeries;
CREATE TRIGGER trg_notify_surgery_status
  AFTER UPDATE OF status ON public.surgeries
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_surgery_status_change();

-- 8. Si el trigger usa otra función (nombre diferente), también la hacemos SECURITY DEFINER.
--    Ejecutar esto con el nombre real encontrado en el paso 5:
-- ALTER FUNCTION public.<nombre_real_de_funcion>() SECURITY DEFINER;

-- ============================================================
-- VERIFICACIÓN: Lista todos los triggers en la tabla surgeries
-- ============================================================
SELECT 
  t.tgname AS trigger_name,
  p.proname AS function_name,
  p.prosecdef AS is_security_definer
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'surgeries'
  AND NOT t.tgisinternal
ORDER BY t.tgname;
