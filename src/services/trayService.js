import { supabase } from '../lib/supabase';
import { getLocalDateString } from '../utils/dateUtils';

export const trayService = {
  async getAll() {
    const { data, error } = await supabase
      .from('trays')
      .select('*, surgery_trays(count)')
      .order('name');
    if (error) throw error;
    return (data || []).map(t => ({ 
      ...t, 
      usage_count: t.surgery_trays?.[0]?.count || 0 
    }));
  },
  async create(tray) {
    const { surgery_trays, usage_count, ...cleanTray } = tray;
    const { data, error } = await supabase
      .from('trays').insert(cleanTray).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, tray) {
    const { surgery_trays, usage_count, ...cleanTray } = tray;
    const { data, error } = await supabase
      .from('trays').update(cleanTray).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async delete(id) {
    const { error } = await supabase.from('trays').delete().eq('id', id);
    if (error) throw error;
  },
  async getAvailableForDate(date, excludeSurgeryId = null) {
    const dateStr = getLocalDateString(date);
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
    
    return (data || []).map(t => {
      const isBusy = busyTrayIds.includes(t.id);
      const isNotAvailable = t.status !== 'Disponible';
      
      let reason = null;
      if (isBusy) reason = 'Ocupada este día';
      else if (isNotAvailable) reason = t.status; // 'En limpieza', 'En reparación', etc.
      
      return { 
        ...t, 
        busy: isBusy || isNotAvailable,
        unavailable_reason: reason
      };
    });
  },
  async getMaintenanceLogs(trayId) {
    const { data, error } = await supabase
      .from('maintenance_logs')
      .select('*')
      .eq('tray_id', trayId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  async logMaintenance(trayId, action, notes, performedBy) {
    const { error } = await supabase
      .from('maintenance_logs')
      .insert({ tray_id: trayId, action, notes, performed_by: performedBy });
    if (error) throw error;
  }
};
