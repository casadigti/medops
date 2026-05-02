import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { surgery, recipientEmail } = await req.json()

    const subject = `🚨 ALERTA: Nueva Cirugía - ${surgery.patient_name}`
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: white;">
        <div style="background: #1e40af; padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">MedOps - Alerta de Cirugía</h1>
        </div>
        <div style="padding: 30px; color: #1e293b; line-height: 1.6;">
          <h2 style="margin-top: 0; color: #1e40af;">Detalles de la Cirugía</h2>
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 8px 0;"><strong>👤 Paciente:</strong> ${surgery.patient_name}</p>
            <p style="margin: 8px 0;"><strong>🏥 Hospital:</strong> ${surgery.hospital?.name || 'No especificado'}</p>
            <p style="margin: 8px 0;"><strong>👨‍⚕️ Cirujano:</strong> ${surgery.surgeon?.full_name || 'No especificado'}</p>
            <p style="margin: 8px 0;"><strong>📅 Fecha:</strong> ${new Date(surgery.surgery_date).toLocaleString('es-ES')}</p>
            <p style="margin: 8px 0;"><strong>⚙️ Procedimiento:</strong> ${surgery.procedure_type}</p>
          </div>
          <p style="font-size: 14px; color: #64748b; text-align: center;">Este es un mensaje automático generado por el sistema MedOps.</p>
        </div>
      </div>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'MedOps <onboarding@resend.dev>',
        to: [recipientEmail || 'casadigti@gmail.com'],
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
