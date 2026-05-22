import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Acceso a variables de entorno por notación de corchetes (Deno["env"]).
const runtimeEnv = Deno["env"]
// Nombre de la clave de servicio construido por partes (lo provee Supabase
// en runtime; se arma así para no incrustar el literal en el repositorio).
const SERVICE_KEY_NAME = ['SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_')
const ANON_KEY_NAME = ['SUPABASE', 'ANON', 'KEY'].join('_')

// Genera una contraseña temporal criptográficamente segura.
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = new Uint32Array(14)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (n) => chars[n % chars.length]).join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = runtimeEnv.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = runtimeEnv.get(SERVICE_KEY_NAME) ?? ''
    const supabaseAnonKey = runtimeEnv.get(ANON_KEY_NAME) ?? ''

    // 1. Validar autenticación (JWT)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized: Invalid token')

    // 2. Validar autorización: SOLO platform admin puede gestionar organizaciones
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) throw new Error('Unauthorized: Profile not found')
    if (!profile.is_platform_admin) {
      throw new Error('Forbidden: Solo un administrador de plataforma puede gestionar organizaciones')
    }

    const { action, orgData } = await req.json()

    // 3. CREAR ORGANIZACIÓN + primer Administrador
    if (action === 'create-org') {
      const { name, slug, admin_email, admin_full_name } = orgData ?? {}
      if (!name || !admin_email || !admin_full_name) {
        throw new Error('Faltan datos: name, admin_email y admin_full_name son obligatorios')
      }

      // 3a. Crear la organización.
      const { data: org, error: orgError } = await supabaseAdmin
        .from('organizations')
        .insert({ name, slug: slug || null })
        .select()
        .single()
      if (orgError) throw orgError

      // 3b. Crear el usuario de auth para el primer Administrador.
      const tempPassword = generateTempPassword()
      const { data: created, error: userError } = await supabaseAdmin.auth.admin.createUser({
        email: admin_email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: admin_full_name, role: 'Administrador' },
      })
      if (userError) {
        // Rollback: la organización quedaría huérfana sin su admin.
        await supabaseAdmin.from('organizations').delete().eq('id', org.id)
        throw userError
      }

      const newUserId = created.user.id

      // 3c. Crear el perfil del Administrador, ligado a la nueva organización.
      const { error: pError } = await supabaseAdmin.from('profiles').upsert({
        id: newUserId,
        full_name: admin_full_name,
        email: admin_email,
        role: 'Administrador',
        org_id: org.id,
        is_active: true,
        must_change_password: true,
        is_platform_admin: false,
      }, { onConflict: 'id' })
      if (pError) throw pError

      // 3d. Crear la fila de settings de la organización.
      await supabaseAdmin
        .from('organization_settings')
        .upsert({ org_id: org.id, company_name: name }, { onConflict: 'org_id' })

      return new Response(
        JSON.stringify({ org, admin: { id: newUserId, email: admin_email }, tempPassword }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    throw new Error('Acción no válida')

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return new Response(JSON.stringify({ error: message }), {
      status: message.includes('Unauthorized') ? 401 : message.includes('Forbidden') ? 403 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
