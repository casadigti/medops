import { supabase } from '../lib/supabase';
import { auditService } from './auditService';

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

    // Registrar en auditoría
    await auditService.log('USER_CREATE', 'profiles', userId, { name: userData.full_name, role: userData.role });

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
    // Definir campos permitidos para evitar Mass Assignment (VULN-003)
    const allowedFields = ['full_name', 'email', 'role', 'is_active', 'password', 'must_change_password'];
    const cleanUpdates = {};
    
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) cleanUpdates[field] = updates[field];
    });

    // Usar la Edge Function para permitir cambios de password y email
    const { data, error } = await supabase.functions.invoke('manage-users', {
      body: { action: 'update', userId, userData: cleanUpdates }
    });

    if (error) throw error;

    // Actualizar el perfil local
    const profileUpdate = {
      full_name: updates.full_name,
      email: updates.email,
      role: updates.role,
      is_active: updates.is_active,
    };

    // Si se resetea la contraseña, forzar cambio en el próximo login
    if (updates.password) {
      profileUpdate.must_change_password = true;
    }

    const { data: profile, error: pError } = await supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', userId)
      .select();

    if (pError) throw pError;

    // Registrar en auditoría (sin incluir la contraseña en el log)
    const auditDetails = {
      name: updates.full_name,
      role: updates.role,
      is_active: updates.is_active,
      password_reset: !!updates.password,
    };
    await auditService.log('USER_UPDATE', 'profiles', userId, auditDetails);

    return profile;
  },

  async deleteUser(userId) {
    // Borrado real de Auth a través de la Edge Function
    const { error } = await supabase.functions.invoke('manage-users', {
      body: { action: 'delete', userId }
    });

    if (error) throw error;

    // Registrar en auditoría
    await auditService.log('USER_DELETE', 'profiles', userId, { note: 'Usuario eliminado permanentemente' });

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
