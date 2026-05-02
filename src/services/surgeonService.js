import { supabase } from '../lib/supabase';

export const surgeonService = {
  async getAll() {
    const { data, error } = await supabase
      .from('surgeons').select('*').order('full_name');
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
  async createPortalUser(userData) {
    const newId = crypto.randomUUID();
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: newId,
        full_name: userData.full_name,
        email: userData.email,
        role: 'Cirujano',
        is_active: true,
        must_change_password: true
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};
