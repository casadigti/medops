import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    fetch: (...args) => fetch(...args),
  },
});

/**
 * Wrapper para queries REST directas usando fetch nativo.
 * Evita el problema de congelamiento del cliente JS de Supabase.
 * @param {string} table - Nombre de la tabla
 * @param {string} query - Query string de PostgREST (ej: "select=*&id=eq.xxx")
 * @param {string} token - JWT token del usuario autenticado
 */
export async function restQuery(table, query = '', token = null) {
  const url = `${supabaseUrl}/rest/v1/${table}${query ? `?${query}` : ''}`;
  const headers = {
    'apikey': supabaseAnonKey,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    // Try to get session token from supabase auth
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`REST Error ${res.status}: ${errText}`);
  }
  return res.json();
}
