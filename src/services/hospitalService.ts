import { supabase } from '../lib/supabase';
import type { Hospital } from '../types/domain';

export const hospitalService = {
  async getAll(): Promise<Hospital[]> {
    const { data, error } = await supabase
      .from('hospitals').select('*').order('name');
    if (error) throw error;
    return data;
  },

  async create(hospital: Omit<Hospital, 'id' | 'created_at'>): Promise<Hospital> {
    const { data, error } = await supabase
      .from('hospitals').insert(hospital).select().single();
    if (error) throw error;
    return data;
  },

  async update(id: string, hospital: Partial<Hospital>): Promise<Hospital> {
    const { data, error } = await supabase
      .from('hospitals').update(hospital).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('hospitals').delete().eq('id', id);
    if (error) throw error;
  },
};
