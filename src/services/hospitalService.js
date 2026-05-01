import { supabase } from '../lib/supabase';

export const hospitalService = {
  async getAll() {
    const { data, error } = await supabase
      .from('hospitals').select('*').order('name');
    if (error) throw error;
    return data;
  },
  async create(hospital) {
    const { data, error } = await supabase
      .from('hospitals').insert(hospital).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, hospital) {
    const { data, error } = await supabase
      .from('hospitals').update(hospital).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async delete(id) {
    const { error } = await supabase.from('hospitals').delete().eq('id', id);
    if (error) throw error;
  },
};
