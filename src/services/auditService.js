import { supabase } from '../lib/supabase';

export const auditService = {
  async log(action, entityType, entityId, details = {}) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      // Sanitizar detalles (remover campos sensibles)
      const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth', 'access_token'];
      const sanitizedDetails = { ...details };
      
      Object.keys(sanitizedDetails).forEach(key => {
        if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
          sanitizedDetails[key] = '[REDACTED]';
        }
      });

      const { error } = await supabase
        .from('audit_logs')
        .insert({
          user_id: user.id,
          user_email: user.email,
          action,
          entity_type: entityType,
          entity_id: entityId?.toString(),
          details: sanitizedDetails
        });
      
      if (error) console.error('Error recording audit log:', error);
    } catch (err) {
      console.error('Audit Service Error:', err);
    }
  },

  async getAll() {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    
    if (error) throw error;
    return data;
  }
};
