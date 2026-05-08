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
  },

  async getFiltered({ dateFrom, dateTo, action, limit = 50, offset = 0 } = {}) {
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (dateFrom) query = query.gte('created_at', new Date(dateFrom).toISOString());
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      query = query.lte('created_at', end.toISOString());
    }
    if (action) query = query.ilike('action', `%${action}%`);

    const { data, error, count } = await query;
    if (error) throw error;
    return { data: data || [], count: count || 0 };
  }
};
