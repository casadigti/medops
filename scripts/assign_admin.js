import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''; // Use service_role if available, but let's try anon if RLS is disabled

const supabase = createClient(supabaseUrl, supabaseKey);

async function setAdmin() {
  const uid = 'bb27f2e7-815d-4780-8e1d-462704d45207';
  console.log(`Buscando y actualizando el perfil para el UID: ${uid}`);

  const { data, error } = await supabase
    .from('profiles')
    .upsert([
      {
        id: uid,
        full_name: 'Super Admin MedOps',
        email: 'admin@medops.com',
        role: 'Superadmin',
        must_change_password: false,
      }
    ], { onConflict: 'id' })
    .select();

  if (error) {
    console.error('❌ Error al asignar permisos:', error);
  } else {
    console.log('✅ Permisos de Superadmin asignados con éxito al usuario!');
    console.log(data);
  }
}

setAdmin();
