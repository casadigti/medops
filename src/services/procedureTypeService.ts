import { supabase } from '../lib/supabase';
import { auditService } from './auditService';
import { getImpersonatedOrgId } from '../utils/impersonation';
import type { ProcedureType } from '../types/domain';

export const procedureTypeService = {
  async getAll(): Promise<ProcedureType[]> {
    const orgOverride = getImpersonatedOrgId();
    let query = supabase.from('procedure_types').select('*').eq('is_active', true).order('name');
    if (orgOverride) query = query.eq('org_id', orgOverride);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async create(name: string): Promise<ProcedureType> {
    const { data, error } = await supabase
      .from('procedure_types')
      .insert({ name })
      .select()
      .single();
    if (error) throw error;
    await auditService.log('PROCEDURE_TYPE_CREATE', 'procedure_types', data.id, { name });
    return data;
  },

  async update(id: string, updates: Partial<ProcedureType>): Promise<ProcedureType[]> {
    const { data, error } = await supabase
      .from('procedure_types')
      .update(updates)
      .eq('id', id)
      .select();
    if (error) throw error;
    await auditService.log('PROCEDURE_TYPE_UPDATE', 'procedure_types', id, updates as Record<string, unknown>);
    return data;
  },

  async delete(id: string): Promise<true> {
    const { error } = await supabase
      .from('procedure_types')
      .delete()
      .eq('id', id);
    if (error) throw error;
    await auditService.log('PROCEDURE_TYPE_DELETE', 'procedure_types', id, { note: 'Tipo de procedimiento eliminado' });
    return true;
  },
};
