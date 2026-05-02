import { supabase } from '../lib/supabase';

export const configService = {
  // --- IDENTIDAD CORPORATIVA ---
  async getSettings() {
    const { data, error } = await supabase
      .from('organization_settings')
      .select('*')
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async updateSettings(settings) {
    const { data, error } = await supabase
      .from('organization_settings')
      .upsert({ id: 1, ...settings })
      .select();
    
    if (error) throw error;
    return data;
  },

  // --- GESTIÓN DE USUARIOS ---
  async getUsers() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name');
    
    if (error) throw error;
    return data;
  },

  async createUser(userData) {
    const newId = crypto.randomUUID();
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: newId,
        ...userData
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateUser(userId, updates) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select();
    
    if (error) throw error;
    return data;
  },

  async deleteUser(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);
    
    if (error) throw error;
    return data;
  },

  // --- SEGURIDAD ---
  async changePassword(newPassword) {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });
    
    if (error) throw error;
    return data;
  }
};
