import { supabase } from '../lib/supabase';
import type { Surgeon, UserProfile } from '../types/domain';

export function withTimeout<T>(promise: PromiseLike<T>, ms = 8000, label = 'Query'): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

export const surgeonService = {
  async getAll(): Promise<Surgeon[]> {
    const { data, error } = await withTimeout(
      supabase.from('surgeons').select('*').order('full_name'),
      8000,
      'surgeonService.getAll'
    );
    if (error) throw error;
    return data;
  },

  async create(surgeon: Omit<Surgeon, 'id' | 'created_at'>): Promise<Surgeon> {
    const { data, error } = await supabase
      .from('surgeons').insert(surgeon).select().single();
    if (error) throw error;
    return data;
  },

  async update(id: string, surgeon: Partial<Surgeon>): Promise<Surgeon> {
    const { data, error } = await supabase
      .from('surgeons').update(surgeon).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('surgeons').delete().eq('id', id);
    if (error) throw error;
  },

  async getUserByEmail(email: string): Promise<Pick<UserProfile, 'id'> | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async createPortalUser(userData: {
    email: string;
    full_name: string;
  }): Promise<{ userId: string; tempPassword: string }> {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const tempPassword = Array.from(
      { length: 10 },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join('');

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: userData.email,
      password: tempPassword,
      options: { data: { full_name: userData.full_name } },
    });

    if (signUpError) throw signUpError;

    const userId = signUpData.user?.id;
    if (!userId) throw new Error('No se pudo crear el usuario de autenticación.');

    await new Promise<void>(r => setTimeout(r, 1500));

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        full_name: userData.full_name,
        email: userData.email,
        role: 'Cirujano',
        is_active: true,
        must_change_password: true,
      }, { onConflict: 'id' });

    if (profileError) console.warn('Profile update warning:', profileError);

    return { userId, tempPassword };
  },
};
