import { supabase } from '../lib/supabase';

export const arsService = {
  async getAll() {
    const { data, error } = await supabase
      .from('ars')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (error) throw error;
    return data;
  },

  async create(name) {
    const { data, error } = await supabase
      .from('ars')
      .insert({ name })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('ars')
      .update(updates)
      .eq('id', id)
      .select();
    
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('ars')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  }
};
