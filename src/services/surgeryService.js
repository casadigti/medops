import { supabase } from '../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Realiza una query REST nativa a Supabase (evita la cola interna del cliente JS).
 */
async function restGet(table, queryParams = '', select = '*') {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || '';
  
  const qs = [select ? `select=${select}` : '', queryParams].filter(Boolean).join('&');
  const url = `${SUPABASE_URL}/rest/v1/${table}${qs ? `?${qs}` : ''}`;
  
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    }
  });

  if (!res.ok) throw new Error(`REST ${res.status}: ${await res.text()}`);
  return res.json();
}

export const surgeryService = {
  async getAll(surgeonId = null) {
    // Using supabase client for the join query — fallback to REST if it hangs
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    try {
      let query = supabase
        .from('surgeries')
        .select(`*, surgeon:surgeons(id,full_name,specialty), hospital:hospitals(id,name), surgery_trays(tray:trays(*))`)
        .order('surgery_date', { ascending: true })
        .abortSignal(controller.signal);

      if (surgeonId) {
        query = query.eq('surgeon_id', surgeonId);
      }

      const { data, error } = await query;
      clearTimeout(timeout);
      if (error) throw error;
      return data;
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        console.warn('surgeryService.getAll: Supabase client timed out, falling back to REST...');
        // Fallback: simple REST query without joins
        const queryParams = surgeonId ? `surgeon_id=eq.${surgeonId}&order=surgery_date.asc` : 'order=surgery_date.asc';
        return restGet('surgeries', queryParams, '*');
      }
      throw err;
    }
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

  async updateDate(id, newDate) {
    const { data, error } = await supabase
      .from('surgeries').update({ surgery_date: newDate }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase.from('surgeries').delete().eq('id', id);
    if (error) throw error;
  },

  async sendAlert(surgery, recipientEmail) {
    const { data, error } = await supabase.functions.invoke('send-surgery-alert', {
      body: { surgery, recipientEmail }
    });
    if (error) throw error;
    return data;
  }
};
