import { supabase } from '../lib/supabase';

/**
 * Wraps any async function with a timeout.
 * If the promise doesn't resolve within `ms` milliseconds, it throws an AbortError.
 * This protects against the Supabase JS client internal queue freezing.
 */
export function withTimeout(promise, ms = 8000, label = 'Query') {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

export const surgeonService = {
  async getAll() {
    const { data, error } = await withTimeout(
      supabase.from('surgeons').select('*').order('full_name'),
      8000, 'surgeonService.getAll'
    );
    if (error) throw error;
    return data;
  },
  async create(surgeon) {
    const { data, error } = await supabase
      .from('surgeons').insert(surgeon).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, surgeon) {
    const { data, error } = await supabase
      .from('surgeons').update(surgeon).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async delete(id) {
    const { error } = await supabase.from('surgeons').delete().eq('id', id);
    if (error) throw error;
  },
  async getUserByEmail(email) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  /**
   * Creates a real auth user for the surgeon and sets their role to Cirujano.
   * Uses supabase.auth.signUp() so the user exists in auth.users and can log in.
   * @returns {{ userId: string, tempPassword: string }}
   */
  async createPortalUser(userData) {
    // Generate a secure temporary password
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const tempPassword = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

    // Create the auth user via signUp
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: userData.email,
      password: tempPassword,
      options: {
        data: { full_name: userData.full_name }
      }
    });

    if (signUpError) throw signUpError;

    const userId = signUpData.user?.id;
    if (!userId) throw new Error('No se pudo crear el usuario de autenticación.');

    // Wait a moment for the trigger to create the profile
    await new Promise(r => setTimeout(r, 1500));

    // Update profile to set role = Cirujano and full_name
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        full_name: userData.full_name,
        email: userData.email,
        role: 'Cirujano',
        is_active: true,
        must_change_password: true
      }, { onConflict: 'id' });

    if (profileError) console.warn('Profile update warning:', profileError);

    return { userId, tempPassword };
  }
};
