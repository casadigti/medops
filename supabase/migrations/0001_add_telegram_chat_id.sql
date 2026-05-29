-- ============================================================================
-- 0001_add_telegram_chat_id.sql
-- Agrega telegram_chat_id a profiles para vincular usuarios con Telegram.
-- Crea funcion RPC search_inventory_for_telegram (SECURITY DEFINER) para que
-- el Edge Function pueda buscar inventario por chat_id sin usar service_role.
-- ============================================================================

-- 1. Columna en profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id bigint;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_telegram_chat_id_key
  ON public.profiles(telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

-- 2. Funcion RPC: lookup + busqueda de inventario para el bot de Telegram.
--    SECURITY DEFINER: puede leer profiles y tablas de inventario cruzando RLS.
--    Recibe el chat_id del usuario de Telegram y el texto de busqueda.
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

  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_imps FROM (
    SELECT i.name, i.sku, il.location, il.current_quantity, il.expiration_date::text
      FROM implants i
      JOIN implant_lots il ON il.implant_id = i.id
     WHERE i.org_id = v_org_id
       AND il.current_quantity > 0
       AND (i.name ILIKE '%' || p_query || '%' OR i.sku ILIKE '%' || p_query || '%')
     ORDER BY i.name
  ) r;

  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_trays FROM (
    SELECT name, code, location, status
      FROM trays
     WHERE org_id = v_org_id
       AND (name ILIKE '%' || p_query || '%' OR code ILIKE '%' || p_query || '%')
     ORDER BY name
  ) r;

  RETURN jsonb_build_object('implants', v_imps, 'trays', v_trays);
END;
$$;

-- Permite llamar la funcion con anon key (la llama el Edge Function via RPC)
GRANT EXECUTE ON FUNCTION public.search_inventory_for_telegram(bigint, text) TO anon, authenticated;
