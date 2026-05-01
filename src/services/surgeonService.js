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
};
