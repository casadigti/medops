import { supabase } from '../lib/supabase';
import type { Hospital } from '../types/domain';

// SECURITY F-09: allowlist the fields a client may write to prevent mass
// assignment of unintended columns (e.g. id, created_at).
const ALLOWED_FIELDS: Array<keyof Hospital> = [
  'name', 'city', 'address', 'phone',
  'coordinator_contact', 'logistics_notes', 'operating_rooms',
];

function pickAllowed(hospital: Partial<Hospital>): Partial<Hospital> {
  const clean: Partial<Hospital> = {};
  ALLOWED_FIELDS.forEach(field => {
    if (hospital[field] !== undefined) {
      (clean as Record<string, unknown>)[field] = hospital[field];
    }
  });
  return clean;
}

export const hospitalService = {
  async getAll(): Promise<Hospital[]> {
    const { data, error } = await supabase
      .from('hospitals').select('*').order('name');
    if (error) throw error;
    return data;
  },

  async create(hospital: Omit<Hospital, 'id' | 'created_at'>): Promise<Hospital> {
    const { data, error } = await supabase
      .from('hospitals').insert(pickAllowed(hospital)).select().single();
    if (error) throw error;
    return data;
  },

  async update(id: string, hospital: Partial<Hospital>): Promise<Hospital> {
    const { data, error } = await supabase
      .from('hospitals').update(pickAllowed(hospital)).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('hospitals').delete().eq('id', id);
    if (error) throw error;
  },
};
