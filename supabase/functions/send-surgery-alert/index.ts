import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// SECURITY F-17: escape DB-sourced values before interpolating them into
// the email HTML to prevent HTML injection via stored data.
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verificar autenticación JWT antes de procesar cualquier dato
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const { surgery } = await req.json()

    // 1. Conectar a Supabase como Administrador (Service Role)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 2. Buscar los admins 'Superadmin'/'Administrador' DE LA MISMA ORGANIZACIÓN
    //    que la cirugía. Sin el filtro org_id se filtraría data entre tenants.
    if (!surgery?.org_id) throw new Error('surgery.org_id es obligatorio')

    const { data: admins, error: dbError } = await supabase
      .from('profiles')
      .select('email')
      .in('role', ['Superadmin', 'Administrador'])
      .eq('is_active', true)
      .eq('org_id', surgery.org_id)

    if (dbError) throw dbError

    // 3. Extraer solo los correos
    let emails = admins?.map(a => a.email).filter(Boolean) || []
    
    // No hay admins activos en esta org → no enviar correo (evita filtrar PHI a un email externo)
    if (emails.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no_active_admins' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const subject = `🚨 ALERTA: Nueva Cirugía - ${surgery.patient_name}`
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: white;">
        <div style="background: #1e40af; padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">MedOps - Alerta de Cirugía</h1>
        </div>
        <div style="padding: 30px; color: #1e293b; line-height: 1.6;">
          <h2 style="margin-top: 0; color: #1e40af;">Detalles de la Cirugía</h2>
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 8px 0;"><strong>👤 Paciente:</strong> ${escapeHtml(surgery.patient_name)}</p>
            <p style="margin: 8px 0;"><strong>🏥 Hospital:</strong> ${escapeHtml(surgery.hospital?.name || 'No especificado')}</p>
            <p style="margin: 8px 0;"><strong>👨‍⚕️ Cirujano:</strong> ${escapeHtml(surgery.surgeon?.full_name || 'No especificado')}</p>
            <p style="margin: 8px 0;"><strong>📅 Fecha:</strong> ${escapeHtml(new Date(surgery.surgery_date).toLocaleString('es-ES'))}</p>
            <p style="margin: 8px 0;"><strong>⚙️ Procedimiento:</strong> ${escapeHtml(surgery.procedure_type)}</p>
          </div>
          <p style="font-size: 14px; color: #64748b; text-align: center;">Este es un mensaje automático generado por el sistema MedOps.</p>
        </div>
      </div>
    `

    // 4. Enviar el correo a toda la lista de emails
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'MedOps <onboarding@resend.dev>',
        to: emails,
        subject: subject,
        html: html,
      }),
    })

    const data = await res.json()

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: res.status,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
