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
    // Llamar a la Edge Function para crear el usuario sin perder la sesión del Admin
    const { data, error } = await supabase.functions.invoke('manage-users', {
      body: { action: 'create', userData }
    });

    if (error) throw error;

    // Crear el perfil en la tabla de MedOps (el trigger de Auth puede tardar)
    const userId = data.user.id;
    const { data: profile, error: pError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        full_name: userData.full_name,
        email: userData.email,
        role: userData.role,
        is_active: true,
        must_change_password: true
      })
      .select().single();

    if (pError) throw pError;

    // Si es cirujano, crear su registro
    if (userData.role === 'Cirujano') {
      await supabase.from('surgeons').insert({
        user_id: userId,
        name: userData.full_name,
        email: userData.email
      });
    }

    return profile;
  },

  async updateUser(userId, updates) {
    // Usar la Edge Function para permitir cambios de password y email
    const { data, error } = await supabase.functions.invoke('manage-users', {
      body: { action: 'update', userId, userData: updates }
    });

    if (error) throw error;

    // Actualizar el perfil local
    const { data: profile, error: pError } = await supabase
      .from('profiles')
      .update({
        full_name: updates.full_name,
        email: updates.email,
        role: updates.role,
        is_active: updates.is_active
      })
      .eq('id', userId)
      .select();

    if (pError) throw pError;
    return profile;
  },

  async deleteUser(userId) {
    // Borrado real de Auth a través de la Edge Function
    const { error } = await supabase.functions.invoke('manage-users', {
      body: { action: 'delete', userId }
    });

    if (error) throw error;

    // Borrado del perfil (el ON DELETE CASCADE se encarga del resto en DB)
    const { error: pError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);
    
    if (pError) throw pError;
    return true;
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
