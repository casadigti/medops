-- ============================================================================
-- 0004_telegram_rpc_storage_location.sql
-- Actualiza search_inventory_for_telegram para devolver ubicación física
-- (estantería + celda) cuando el ítem está asignado en storage_slots.
-- Fallback al campo location de texto si no tiene celda asignada.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.search_inventory_for_telegram(
  p_chat_id bigint,
  p_query   text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org_id  uuid;
  v_active  boolean;
  v_imps    jsonb;
  v_trays   jsonb;
BEGIN
  SELECT org_id, is_active
    INTO v_org_id, v_active
    FROM profiles
   WHERE telegram_chat_id = p_chat_id
   LIMIT 1;

  IF v_org_id IS NULL OR NOT COALESCE(v_active, false) THEN
    RETURN jsonb_build_object('error', 'not_linked');
  END IF;

  -- Implantes: ubicación física (estantería + celda) con fallback a location text
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_imps FROM (
    SELECT
      i.name,
      i.sku,
      COALESCE(
        sh.name || ' · Celda ' || chr(65 + ss.row_index) || (ss.col_index + 1)::text,
        il.location
      ) AS location,
      il.current_quantity,
      il.expiration_date::text
    FROM implants i
    JOIN implant_lots il ON il.implant_id = i.id
    LEFT JOIN storage_slots ss
      ON ss.item_id = il.id AND ss.item_type = 'implant_lot'
    LEFT JOIN storage_shelves sh ON sh.id = ss.shelf_id
    WHERE i.org_id = v_org_id
      AND il.current_quantity > 0
      AND (i.name ILIKE '%' || p_query || '%' OR i.sku ILIKE '%' || p_query || '%')
    ORDER BY i.name
  ) r;

  -- Bandejas: misma lógica
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_trays FROM (
    SELECT
      t.name,
      t.code,
      COALESCE(
        sh.name || ' · Celda ' || chr(65 + ss.row_index) || (ss.col_index + 1)::text,
        t.location
      ) AS location,
      t.status
    FROM trays t
    LEFT JOIN storage_slots ss
      ON ss.item_id = t.id AND ss.item_type = 'tray'
    LEFT JOIN storage_shelves sh ON sh.id = ss.shelf_id
    WHERE t.org_id = v_org_id
      AND (t.name ILIKE '%' || p_query || '%' OR t.code ILIKE '%' || p_query || '%')
    ORDER BY t.name
  ) r;

  RETURN jsonb_build_object('implants', v_imps, 'trays', v_trays);
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_inventory_for_telegram(bigint, text) TO anon, authenticated;

-- Verificación
SELECT proname, prosecdef
FROM pg_proc
WHERE proname = 'search_inventory_for_telegram';
