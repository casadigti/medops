import { supabase } from '../lib/supabase';

export const trayService = {
  async getAll() {
    const { data, error } = await supabase
      .from('trays').select('*').order('name');
    if (error) throw error;
    return data;
  },
  async create(tray) {
    const { data, error } = await supabase
      .from('trays').insert(tray).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, tray) {
    const { data, error } = await supabase
      .from('trays').update(tray).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async delete(id) {
    const { error } = await supabase.from('trays').delete().eq('id', id);
    if (error) throw error;
  },
  async getAvailableForDate(date, excludeSurgeryId = null) {
    const dateStr = date.toISOString().split('T')[0];
    // Get trays assigned to surgeries on that date
    let query = supabase
      .from('surgery_trays')
      .select('tray_id, surgery:surgeries!inner(id, surgery_date)')
      .gte('surgeries.surgery_date', `${dateStr}T00:00:00`)
      .lte('surgeries.surgery_date', `${dateStr}T23:59:59`);
    if (excludeSurgeryId) {
      query = query.neq('surgeries.id', excludeSurgeryId);
    }
    const { data: busyLinks } = await query;
    const busyTrayIds = (busyLinks || []).map(l => l.tray_id);

    const { data, error } = await supabase.from('trays').select('*').order('name');
    if (error) throw error;
    return (data || []).map(t => ({ ...t, busy: busyTrayIds.includes(t.id) }));
  },
};
