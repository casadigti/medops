import { supabase } from '../lib/supabase';
import type { AuditLog } from '../types/domain';

const SENSITIVE_KEYS = ['password', 'token', 'key', 'secret', 'auth', 'access_token'];

function sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...details };
  for (const key of Object.keys(sanitized)) {
    if (SENSITIVE_KEYS.some(sk => key.toLowerCase().includes(sk))) {
      sanitized[key] = '[REDACTED]';
    }
  }
  return sanitized;
}

export const auditService = {
  async log(
    action: string,
    entityType: string,
    entityId: string | number | null,
    details: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const { error } = await supabase
        .from('audit_logs')
        .insert({
          user_id: user.id,
          user_email: user.email,
          action,
          entity_type: entityType,
          entity_id: entityId?.toString(),
          details: sanitizeDetails(details),
        });

      if (error) console.error('Error recording audit log:', error);
    } catch (err) {
      console.error('Audit Service Error:', err);
    }
  },

  async getAll(): Promise<AuditLog[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return data;
  },

  async getFiltered({
    dateFrom,
    dateTo,
    action,
    entityType,
    limit = 50,
    offset = 0,
  }: {
    dateFrom?: string;
    dateTo?: string;
    action?: string;
    entityType?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ data: AuditLog[]; count: number }> {
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
    if (entityType) query = query.eq('entity_type', entityType);

    const { data, error, count } = await query;
    if (error) throw error;
    return { data: data || [], count: count || 0 };
  },
};
