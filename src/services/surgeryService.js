import { supabase } from '../lib/supabase';

export const surgeryService = {
  async getAll() {
    const { data, error } = await supabase
      .from('surgeries')
      .select(`*, surgeon:surgeons(id,full_name,specialty), hospital:hospitals(id,name), surgery_trays(tray:trays(*))`)
      .order('surgery_date', { ascending: true });
    if (error) throw error;
    return data;
  },
  async getById(id) {
    const { data, error } = await supabase
      .from('surgeries')
      .select(`*, surgeon:surgeons(id,full_name,specialty), hospital:hospitals(id,name), surgery_trays(tray:trays(*))`)
      .eq('id', id).single();
    if (error) throw error;
    return data;
  },
  async create(surgeryData, trayIds = []) {
    const { data: surgery, error } = await supabase
      .from('surgeries').insert(surgeryData).select().single();
    if (error) throw error;
    if (trayIds.length > 0) {
      const links = trayIds.map(tray_id => ({ surgery_id: surgery.id, tray_id }));
      const { error: linkErr } = await supabase.from('surgery_trays').insert(links);
      if (linkErr) throw linkErr;
    }
    return surgery;
  },
  async update(id, surgeryData, trayIds = []) {
    const { data: surgery, error } = await supabase
      .from('surgeries').update(surgeryData).eq('id', id).select().single();
    if (error) throw error;
    // Replace tray assignments
    await supabase.from('surgery_trays').delete().eq('surgery_id', id);
    if (trayIds.length > 0) {
      const links = trayIds.map(tray_id => ({ surgery_id: id, tray_id }));
      const { error: linkErr } = await supabase.from('surgery_trays').insert(links);
      if (linkErr) throw linkErr;
    }
    return surgery;
  },
  async updateStatus(id, status) {
    const { data, error } = await supabase
      .from('surgeries').update({ status }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async delete(id) {
    const { error } = await supabase.from('surgeries').delete().eq('id', id);
    if (error) throw error;
  },
};
