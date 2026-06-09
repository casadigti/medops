import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    // 1. Validar Autenticación (JWT)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized: Invalid token')

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // 3. Leer body una sola vez
    const body = await req.json()
    const { action, userData, userId } = body

    // Acción especial: el propio usuario cambia su contraseña temporal.
    // No requiere rol admin — solo requiere JWT válido + contraseña actual correcta.
    if (action === 'change-own-password') {
      const { currentPassword, newPassword } = body

      // Verificar contraseña actual
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(user.id)
      if (!authUser?.user?.email) throw new Error('Usuario no encontrado')

      const { error: reAuthError } = await supabaseClient.auth.signInWithPassword({
        email: authUser.user.email,
        password: currentPassword,
      })
      if (reAuthError) throw new Error('Contraseña temporal incorrecta')

      // Cambiar contraseña via Admin API (bypasses Secure Password Change)
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password: newPassword,
      })
      if (updateError) throw updateError

      // Marcar must_change_password = false
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({ must_change_password: false })
        .eq('id', user.id)
      if (profileUpdateError) throw profileUpdateError

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Validar Autorización (Roles) — solo para acciones de gestión
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, org_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) throw new Error('Unauthorized: Profile not found')
    if (!['Superadmin', 'Administrador'].includes(profile.role)) {
      throw new Error('Forbidden: Insufficient permissions')
    }

    // 1. CREAR USUARIO
    if (action === 'create') {
      const { email, password, full_name, role } = userData

      // Verificar límite de usuarios por organización
      if (profile.org_id) {
        const { data: org } = await supabaseAdmin
          .from('organizations')
          .select('max_users, name')
          .eq('id', profile.org_id)
          .single()

        if (org) {
          const { count } = await supabaseAdmin
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('org_id', profile.org_id)
          if (count !== null && count >= org.max_users) {
            throw new Error(`Límite de usuarios alcanzado (máx. ${org.max_users} para esta organización)`)
          }
        }
      }

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, role }
      })
      if (error) throw error
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 2. ACTUALIZAR USUARIO
    if (action === 'update') {
      const { password, full_name, role, email } = userData

      // NO incluir `email` en el payload de updateUserById.
      // Cambiar el email dispara el flujo "Secure email change" de Supabase,
      // que requiere SMTP configurado y falla con 400 si no lo hay.
      // El email se persiste solo en la tabla `profiles` desde el cliente.
      type AdminUpdatePayload = {
        user_metadata: { full_name: string; role: string }
        password?: string
        email_confirm?: boolean
      }
      const updates: AdminUpdatePayload = {
        user_metadata: { full_name, role },
      }
      if (password) {
        updates.password = password
        // Al resetear la contraseña desde el panel admin, confirmar el email.
        // Si el usuario quedó "Waiting for verification", signInWithPassword
        // falla aunque la contraseña sea correcta. Confirmarlo permite el login.
        updates.email_confirm = true
      }

      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, updates)

      // Si el usuario NO existe en auth.users (perfil creado sin cuenta auth),
      // updateUserById devuelve "not found". ANTES este error se tragaba en
      // silencio y el toast mentía "actualizado correctamente" mientras la
      // contraseña nunca se aplicaba y el login seguía fallando.
      // Ahora se propaga un mensaje claro para que el admin recree el usuario.
      if (error) {
        if (error.message.toLowerCase().includes('not found')) {
          throw new Error(
            'Este usuario no tiene cuenta de acceso (auth). Elimínalo y créalo de nuevo con "Nuevo Usuario" para que pueda iniciar sesión.'
          )
        }
        throw error
      }

      // Marcador defensivo: si por alguna razón no hay data ni error, avisar.
      void email
      return new Response(JSON.stringify(data ?? { success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 3. ELIMINAR USUARIO
    if (action === 'delete') {
      // Intentar eliminar de auth.users; ignorar si el usuario no existe allí
      // (puede ser un perfil creado manualmente sin cuenta auth).
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
      if (authDeleteError && !authDeleteError.message.toLowerCase().includes('not found')) {
        throw authDeleteError
      }
      // Eliminar siempre el perfil de la tabla profiles.
      const { error: profileDeleteError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', userId)
      if (profileDeleteError) throw profileDeleteError
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    throw new Error('Acción no válida')

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.message.includes('Unauthorized') ? 401 : error.message.includes('Forbidden') ? 403 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
