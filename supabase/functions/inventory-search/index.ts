import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
// deno-lint-ignore no-explicit-any
const e = (k: string): string => (Deno as any)["env"]["get"](k) ?? ""
const SUPABASE_URL      = e("SUPABASE_URL")
const SUPABASE_ANON_KEY = e("SUPABASE_ANON_KEY")
const TG_TOKEN          = e("TELEGRAM_BOT_TOKEN")
const GROQ_API_KEY      = e("GROQ_API_KEY")

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Query cleaner: strips Spanish filler before keyword search ───────────

function cleanQuery(raw: string): string {
  const stopwords = new Set([
    'donde','esta','está','dónde','buscar','busca','hay','tienes','tiene',
    'quiero','necesito','ver','dame','dime','me','un','una','el','la','los',
    'las','de','del','lo','por','favor','porfavor','que','cual','cuál',
    'cuales','cuáles','algún','algun','alguna','busco','encuentro','encuentras',
    'dónde','tenemos','tengo','ponme','trae','traeme','traéme','esta','están',
    'guardado','guardados','ubicado','ubicados','stock','inventario',
    // quantity questions
    'cuánta','cuánto','cuántos','cuántas','cuanta','cuanto','cuantos','cuantas',
    'queda','quedan','disponible','disponibles','tenemos','cuantos','hay',
  ])
  const q = raw.toLowerCase().replace(/[¿?¡!,;]/g, ' ').trim()
  const words = q.split(/\s+/).filter(w => w.length > 1 && !stopwords.has(w))
  // Simple plural → singular: remove trailing 's' for words >= 5 chars ending in 's'
  // e.g. "tornillos" → "tornillo", "placas" → "placa", "pins" → "pin" (4 chars, skip)
  const normalized = words.map(w => (w.length >= 5 && w.endsWith('s') ? w.slice(0, -1) : w))
  const clean = normalized.join(' ').trim()
  return clean.length >= 2 ? clean : raw.trim()
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

// ─── Voice transcription via Groq Whisper ─────────────────────────────────

async function transcribeVoice(fileId: string): Promise<string | null> {
  if (!GROQ_API_KEY || !TG_TOKEN) return null
  try {
    // 1. Get file path from Telegram
    const fileRes = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/getFile?file_id=${fileId}`)
    const fileData = await fileRes.json()
    const filePath: string = fileData?.result?.file_path
    if (!filePath) { console.error('[TG] getFile failed:', JSON.stringify(fileData)); return null }

    // 2. Download audio bytes
    const audioRes = await fetch(`https://api.telegram.org/file/bot${TG_TOKEN}/${filePath}`)
    const audioBlob = await audioRes.blob()

    // 3. Send to Groq Whisper (compatible with OpenAI audio API)
    const form = new FormData()
    form.append('file', audioBlob, 'voice.ogg')
    form.append('model', 'whisper-large-v3')
    form.append('language', 'es')
    form.append('response_format', 'text')

    const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` },
      body: form,
    })

    if (!whisperRes.ok) {
      console.error('[TG] Groq error:', await whisperRes.text())
      return null
    }

    const transcription = (await whisperRes.text()).trim()
    console.log(`[TG] transcribed: "${transcription}"`)
    return transcription || null
  } catch (err) {
    console.error('[TG] transcribeVoice error:', err)
    return null
  }
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
      const rawText: string = (msg.text || '').trim()
      const voiceFileId: string | null = msg.voice?.file_id || msg.audio?.file_id || null

      if (rawText === '/start') {
        await tgSend(chatId,
          `Hola! Soy el asistente de inventario de MedOps.\n\nTu Chat ID es: ${chatId}\n\nVe a Configuracion > Mi Seguridad > Chat ID de Telegram y pega este numero.\n\nPuedes escribir o enviar nota de voz:\n- tornillo 4.5mm\n- set ortopedico\n- TOR-45`
        )
        return new Response('ok')
      }

      // Resolve search text: typed OR transcribed voice
      let searchText = rawText
      if (!searchText && voiceFileId) {
        await tgSend(chatId, 'Transcribiendo audio...')
        const transcription = await transcribeVoice(voiceFileId)
        if (!transcription) {
          await tgSend(chatId, 'No pude transcribir el audio. Intenta escribir tu busqueda.')
          return new Response('ok')
        }
        searchText = transcription
      }

      if (!searchText || searchText.length < 2) return new Response('ok')

      const searchTerm = cleanQuery(searchText)
      console.log(`[TG] chat=${chatId} query="${searchText}" clean="${searchTerm}" voice=${!!voiceFileId}`)

      // Usa RPC con SECURITY DEFINER — no requiere service role key
      const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      const { data, error } = await anon.rpc('search_inventory_for_telegram', {
        p_chat_id: chatId,
        p_query: searchTerm,
      })

      console.log(`[TG] rpc_err=${JSON.stringify(error)} data_type_err=${(data as any)?.error}`)

      if (error || !data) {
        console.error('[TG] RPC failed:', error)
        await tgSend(chatId, 'Error al buscar. Intenta de nuevo.')
        return new Response('ok')
      }

      if ((data as Record<string, unknown>).error === 'not_linked') {
        await tgSend(chatId, 'Cuenta no vinculada. Escribe /start y sigue las instrucciones en la app.')
        return new Response('ok')
      }

      const d = data as { implants: ImpRow[]; trays: TrayRow[] }
      await tgSend(chatId, fmt(searchText, d.implants || [], d.trays || []))
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

    const q = cleanQuery(query.trim())

    const [{ data: imps }, { data: trays }] = await Promise.all([
      userClient
        .from('implants')
        .select('name, sku, implant_lots(id, location, current_quantity, expiration_date)')
        .or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
        .order('name'),
      userClient
        .from('trays')
        .select('id, name, code, location, status')
        .or(`name.ilike.%${q}%,code.ilike.%${q}%`)
        .order('name'),
    ])

    // Flatten implant_lots into individual rows for the formatter
    type ImpWithLots = { name: string; sku: string; implant_lots: (ImpRow & { id: string })[] }
    const flatImps: (ImpRow & { id?: string })[] = ((imps || []) as ImpWithLots[]).flatMap(i =>
      (i.implant_lots || []).map(l => ({ name: i.name, sku: i.sku, ...l }))
    )

    // Resolve physical storage locations from storage_slots
    const lotIds  = flatImps.map(i => i.id).filter(Boolean) as string[]
    const trayIds = ((trays || []) as (TrayRow & { id: string })[]).map(t => t.id).filter(Boolean)
    const allIds  = [...lotIds, ...trayIds]

    const locationMap: Record<string, string> = {}
    if (allIds.length > 0) {
      const { data: slots } = await userClient
        .from('storage_slots')
        .select('item_id, row_index, col_index, storage_shelves!shelf_id(name)')
        .not('item_id', 'is', null)
        .in('item_id', allIds)
      for (const slot of (slots || [])) {
        const shelfName = (slot.storage_shelves as { name: string } | null)?.name
        if (slot.item_id && shelfName) {
          const cell = String.fromCharCode(65 + slot.row_index) + (slot.col_index + 1)
          locationMap[slot.item_id] = `${shelfName} · Celda ${cell}`
        }
      }
    }

    // Override location with physical slot if assigned, else keep text fallback
    const resolvedImps: ImpRow[] = flatImps.map(i => ({
      ...i,
      location: (i.id && locationMap[i.id]) ? locationMap[i.id] : i.location,
    }))
    const resolvedTrays: TrayRow[] = ((trays || []) as (TrayRow & { id: string })[]).map(t => ({
      ...t,
      location: locationMap[t.id] ?? t.location,
    }))

    const text = fmt(query, resolvedImps, resolvedTrays)

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
