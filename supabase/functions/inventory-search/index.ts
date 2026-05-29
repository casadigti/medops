import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
// deno-lint-ignore no-explicit-any
const e = (k: string): string => (Deno as any)["env"]["get"](k) ?? ""
const SUPABASE_URL      = e("SUPABASE_URL")
const SUPABASE_ANON_KEY = e("SUPABASE_ANON_KEY")
const TG_TOKEN          = e("TELEGRAM_BOT_TOKEN")

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Format results as plain text ─────────────────────────────────────────

interface ImpRow { name: string; sku: string; location?: string | null; current_quantity?: number; expiration_date?: string | null }
interface TrayRow { name: string; code: string; location?: string | null; status?: string }

function fmt(query: string, implants: ImpRow[], trays: TrayRow[]): string {
  const out: string[] = [`Resultados para "${query}":\n`]
  let found = false

  for (const i of implants) {
    if (!i.current_quantity || i.current_quantity <= 0) continue
    found = true
    const loc = i.location || 'Sin ubicacion registrada'
    const exp = i.expiration_date ? ` | Vence: ${i.expiration_date}` : ''
    out.push(`[Implante] ${i.name} (${i.sku})`)
    out.push(`  Ubicacion: ${loc} | Stock: ${i.current_quantity}${exp}\n`)
  }

  for (const t of trays) {
    found = true
    const loc = t.location || 'Sin ubicacion registrada'
    out.push(`[Bandeja] ${t.name} (${t.code})`)
    out.push(`  Ubicacion: ${loc} | Estado: ${t.status || '-'}\n`)
  }

  return found
    ? out.join('\n')
    : `No encontre items con "${query}". Intenta nombre, SKU o codigo.`
}

// ─── Telegram message sender ───────────────────────────────────────────────

async function tgSend(chatId: number | string, text: string) {
  if (!TG_TOKEN) return
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
}

// ─── Main handler ──────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const url = new URL(req.url)
  const isTg = url.pathname.endsWith('/telegram')

  try {
    // ── Telegram webhook ─────────────────────────────────────────────────
    if (isTg) {
      const update = await req.json()
      const msg = update?.message
      if (!msg) return new Response('ok')

      const chatId: number = msg.chat?.id
      const text: string = (msg.text || '').trim()

      if (text === '/start') {
        await tgSend(chatId,
          `Hola! Soy el asistente de inventario de MedOps.\n\nTu Chat ID es: ${chatId}\n\nVe a Configuracion > Mi Seguridad > Chat ID de Telegram y pega este numero.\n\nLuego preguntame:\n- tornillo 4.5mm\n- set ortopedico\n- TOR-45`
        )
        return new Response('ok')
      }

      if (!text || text.length < 2) return new Response('ok')

      // Usa RPC con SECURITY DEFINER — no requiere service role key
      const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      const { data, error } = await anon.rpc('search_inventory_for_telegram', {
        p_chat_id: chatId,
        p_query: text,
      })

      if (error || !data) {
        console.error('RPC error:', error)
        await tgSend(chatId, 'Error al buscar. Intenta de nuevo.')
        return new Response('ok')
      }

      if ((data as Record<string, unknown>).error === 'not_linked') {
        await tgSend(chatId, 'Cuenta no vinculada. Escribe /start y sigue las instrucciones en la app.')
        return new Response('ok')
      }

      const d = data as { implants: ImpRow[]; trays: TrayRow[] }
      await tgSend(chatId, fmt(text, d.implants || [], d.trays || []))
      return new Response('ok')
    }

    // ── In-app path (JWT => RLS handles org) ──────────────────────────────
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

    const auth = req.headers.get('Authorization')
    if (!auth) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const { query } = await req.json()
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return new Response(JSON.stringify({ error: 'Escribe al menos 2 caracteres.' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    })

    const q = query.trim()

    const [{ data: imps }, { data: trays }] = await Promise.all([
      userClient
        .from('implants')
        .select('name, sku, implant_lots(location, current_quantity, expiration_date)')
        .or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
        .order('name'),
      userClient
        .from('trays')
        .select('name, code, location, status')
        .or(`name.ilike.%${q}%,code.ilike.%${q}%`)
        .order('name'),
    ])

    // Flatten implant_lots into individual rows for the formatter
    type ImpWithLots = { name: string; sku: string; implant_lots: ImpRow[] }
    const flatImps: ImpRow[] = ((imps || []) as ImpWithLots[]).flatMap(i =>
      (i.implant_lots || []).map(l => ({ name: i.name, sku: i.sku, ...l }))
    )

    const text = fmt(query, flatImps, (trays || []) as TrayRow[])

    return new Response(
      JSON.stringify({ text, implants: imps || [], trays: trays || [] }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('inventory-search error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
