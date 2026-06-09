-- 0018_notify_surgeon_request_decision.sql
-- Notifica al cirujano (campana in-app) cuando su solicitud es Aprobada/Rechazada.
-- Patrón: trigger SECURITY DEFINER (igual que notify_surgery_status_change),
-- porque la tabla notifications NO tiene policy INSERT para clientes (RLS).

CREATE OR REPLACE FUNCTION public.notify_surgeon_request_decision()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid;
  v_title   text;
  v_msg     text;
  v_type    text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status IN ('Aprobada', 'Rechazada') THEN

    -- user_id del cirujano dueño de la solicitud
    SELECT user_id INTO v_user_id
    FROM public.surgeons
    WHERE id = NEW.surgeon_id;

    -- cirujano sin cuenta auth vinculada → no se puede notificar
    IF v_user_id IS NULL THEN
      RETURN NEW;
    END IF;

    IF NEW.status = 'Aprobada' THEN
      v_title := 'Solicitud aprobada';
      v_msg   := 'Tu solicitud para ' || NEW.patient_name
                 || ' fue aprobada. Cirugía agendada.';
      v_type  := 'success';
    ELSE
      v_title := 'Solicitud rechazada';
      v_msg   := 'Tu solicitud para ' || NEW.patient_name || ' fue rechazada.'
                 || COALESCE(' Motivo: ' || NEW.admin_notes, '');
      v_type  := 'warning';
    END IF;

    INSERT INTO public.notifications
      (user_id, org_id, title, message, type, entity_id, entity_type)
    VALUES
      (v_user_id, NEW.org_id, v_title, v_msg, v_type, NEW.id::text, 'surgery_requests');
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_surgeon_request_decision ON public.surgery_requests;
CREATE TRIGGER trg_notify_surgeon_request_decision
  AFTER UPDATE ON public.surgery_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_surgeon_request_decision();
