-- ============================================================
-- FIX: Notificaciones solo para admins de la misma organización
-- Ejecutar en: Supabase Dashboard > SQL Editor
--
-- Problema: fix_notifications_rls.sql (ejecutado como hotfix) sobreescribió
-- la función del trigger sin el filtro org_id — admins de org B reciben
-- notificaciones de cirugías de org A.
-- ============================================================

-- 1. Reescribir la función del trigger con filtro de org
CREATE OR REPLACE FUNCTION public.notify_surgery_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      AND p.org_id = NEW.org_id    -- ← solo admins de la MISMA org
      AND p.is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Asegurar que el trigger existe (recrear si no)
DROP TRIGGER IF EXISTS trg_notify_surgery_status ON public.surgeries;
CREATE TRIGGER trg_notify_surgery_status
  AFTER UPDATE OF status ON public.surgeries
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_surgery_status_change();

-- 3. RLS en notifications — ajustar para incluir org_id (defense-in-depth)
--    SELECT: el usuario solo ve sus propias notificaciones
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Notifications_Select" ON public.notifications;
CREATE POLICY "Notifications_Select" ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

--    UPDATE: el usuario solo puede marcar las suyas como leídas
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Notifications_Update" ON public.notifications;
CREATE POLICY "Notifications_Update" ON public.notifications
  FOR UPDATE TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

--    INSERT: solo SECURITY DEFINER (trigger) puede insertar — bloquear desde cliente
DROP POLICY IF EXISTS "Notifications_Insert" ON public.notifications;
CREATE POLICY "Notifications_Insert" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (false);  -- trigger usa SECURITY DEFINER, bypass RLS

-- 4. Limpiar notificaciones huérfanas (de otras orgs) — OPCIONAL
-- ADVERTENCIA: esto elimina notificaciones históricas cross-org.
-- Descomenta solo si quieres limpiar el ruido existente.
--
-- DELETE FROM public.notifications n
-- USING public.profiles p
-- WHERE n.user_id = p.id
--   AND n.org_id IS DISTINCT FROM p.org_id;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
SELECT
  t.tgname        AS trigger_name,
  p.proname       AS function_name,
  p.prosecdef     AS is_security_definer,
  pg_get_functiondef(p.oid) LIKE '%AND p.org_id = NEW.org_id%' AS has_org_filter
FROM pg_trigger t
JOIN pg_class  c ON t.tgrelid = c.oid
JOIN pg_proc   p ON t.tgfoid  = p.oid
WHERE c.relname = 'surgeries'
  AND NOT t.tgisinternal
ORDER BY t.tgname;
