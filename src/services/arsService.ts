import { supabase } from '../lib/supabase';
import { auditService } from './auditService';
import type { ARS } from '../types/domain';

export const arsService = {
  async getAll(): Promise<ARS[]> {
    const { data, error } = await supabase
      .from('ars')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return data;
  },

  async create(name: string): Promise<ARS> {
    const { data, error } = await supabase
      .from('ars')
      .insert({ name })
      .select()
      .single();
    if (error) throw error;
    await auditService.log('ARS_CREATE', 'ars', data.id, { name });
    return data;
  },

  async update(id: string, updates: Partial<ARS>): Promise<ARS[]> {
    const { data, error } = await supabase
      .from('ars')
      .update(updates)
      .eq('id', id)
      .select();
    if (error) throw error;
    await auditService.log('ARS_UPDATE', 'ars', id, updates as Record<string, unknown>);
    return data;
  },

  async delete(id: string): Promise<true> {
    const { error } = await supabase
      .from('ars')
      .delete()
      .eq('id', id);
    if (error) throw error;
    await auditService.log('ARS_DELETE', 'ars', id, { note: 'Aseguradora eliminada' });
    return true;
  },
};
