-- ==========================================
-- AUTOMATIZACIÓN DE DESGASTE DE BANDEJAS
-- Ejecuta esto en el SQL Editor de Supabase
-- ==========================================

-- 1. Creamos la función que aumentará el contador
CREATE OR REPLACE FUNCTION increment_tray_wear_on_surgery_complete()
RETURNS TRIGGER AS $$
BEGIN
    -- Si el estatus cambió a 'Completada' y antes no lo era
    IF NEW.status = 'Completada' AND OLD.status IS DISTINCT FROM 'Completada' THEN
        -- Actualizamos todas las bandejas que participaron en esta cirugía
        UPDATE trays
        SET sterilization_count = sterilization_count + 1
        WHERE id IN (
            SELECT tray_id 
            FROM surgery_trays 
            WHERE surgery_id = NEW.id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Creamos el Trigger (disparador) en la tabla surgeries
DROP TRIGGER IF EXISTS trigger_increment_tray_wear ON surgeries;

CREATE TRIGGER trigger_increment_tray_wear
AFTER UPDATE OF status ON surgeries
FOR EACH ROW
EXECUTE PROCEDURE increment_tray_wear_on_surgery_complete();
