import { supabase } from '../lib/supabase';
import { auditService } from './auditService';
import { getImpersonatedOrgId } from '../utils/impersonation';
import type { OrganizationSettings, UserProfile, UserRole } from '../types/domain';

// ── Settings cache (TTL 5 min, keyed by org) ────────────────────────────────
const SETTINGS_TTL = 5 * 60 * 1000;
const _cache = new Map<string, { data: OrganizationSettings | null; ts: number }>();
function _cacheKey() { return getImpersonatedOrgId() ?? '__own__'; }
function _getCache() {
  const e = _cache.get(_cacheKey());
  return e && Date.now() - e.ts < SETTINGS_TTL ? e.data : null;
}
function _setCache(data: OrganizationSettings | null) {
  _cache.set(_cacheKey(), { data, ts: Date.now() });
}
function _clearCache() { _cache.delete(_cacheKey()); }
/** For tests only — wipes the entire cache across all orgs. */
export function _resetSettingsCacheForTests() { _cache.clear(); }

const ALLOWED_USER_FIELDS: Array<keyof UserProfile | 'password'> = [
  'full_name', 'email', 'role', 'is_active', 'password', 'must_change_password',
];

interface CreateUserInput {
  full_name: string;
  email: string;
  role: UserRole;
  password?: string;
}

interface UpdateUserInput extends Partial<UserProfile> {
  password?: string;
}

export const configService = {
  async getSettings(): Promise<OrganizationSettings | null> {
    const cached = _getCache();
    if (cached !== null) return cached;
    const { data, error } = await supabase
      .from('organization_settings')
      .select('*')
      .maybeSingle();
    // PGRST116 = "no rows found" — maybeSingle ya lo maneja devolviendo null,
    // pero si llegara por otra vía lo tratamos igual: null, no throw.
    if (error && (error as { code?: string }).code !== 'PGRST116') throw error;
    _setCache(data);
    return data;
  },

  async updateSettings(settings: Partial<OrganizationSettings>): Promise<OrganizationSettings[]> {
    _clearCache();
    // Multi-tenancy: la fila de settings se identifica por org_id (único).
    // org_id lo llena el DEFAULT get_my_org_id() en INSERT; RLS impide tocar
    // settings de otra organización.
    const { data, error } = await supabase
      .from('organization_settings')
      .upsert({ ...settings }, { onConflict: 'org_id' })
      .select();
    if (error) throw error;
    return data;
  },

  async getRoomConfig(): Promise<{ room_width: number; room_height: number }> {
    const cached = _getCache();
    if (cached) return { room_width: cached.room_width ?? 30, room_height: cached.room_height ?? 20 };
    const { data } = await supabase
      .from('organization_settings')
      .select('room_width, room_height')
      .maybeSingle();
    return { room_width: data?.room_width ?? 30, room_height: data?.room_height ?? 20 };
  },

  async saveRoomConfig(width: number, height: number): Promise<void> {
    _clearCache();
    const { error } = await supabase
      .from('organization_settings')
      .upsert({ room_width: width, room_height: height }, { onConflict: 'org_id' });
    if (error) throw error;
  },

  async getUsers(): Promise<UserProfile[]> {
    const orgOverride = getImpersonatedOrgId();
    let query = supabase.from('profiles').select('*').order('full_name');
    if (orgOverride) query = query.eq('org_id', orgOverride);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async createUser(userData: CreateUserInput): Promise<UserProfile> {
    const { data, error } = await supabase.functions.invoke('manage-users', {
      body: { action: 'create', userData },
    });
    if (error) throw error;

    const userId: string = data.user.id;
    const { data: profile, error: pError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        full_name: userData.full_name,
        email: userData.email,
        role: userData.role,
        is_active: true,
        must_change_password: true,
      })
      .select()
      .single();
    if (pError) throw pError;

    await auditService.log('USER_CREATE', 'profiles', userId, {
      name: userData.full_name,
      role: userData.role,
    });

    if (userData.role === 'Cirujano') {
      await supabase.from('surgeons').insert({
        user_id: userId,
        name: userData.full_name,
        email: userData.email,
      });
    }

    return profile;
  },

  async updateUser(userId: string, updates: UpdateUserInput): Promise<UserProfile[]> {
    const cleanUpdates: Record<string, unknown> = {};
    ALLOWED_USER_FIELDS.forEach(field => {
      if ((updates as Record<string, unknown>)[field] !== undefined) {
        cleanUpdates[field] = (updates as Record<string, unknown>)[field];
      }
    });

    const { data, error } = await supabase.functions.invoke('manage-users', {
      body: { action: 'update', userId, userData: cleanUpdates },
    });
    if (error) {
      // Surface real error from function body (context is the raw Response)
      try {
        const body = await (error as any).context?.json?.();
        throw new Error(body?.error || error.message);
      } catch (parseErr: any) {
        if (parseErr?.message && parseErr.message !== error.message) throw parseErr;
        throw error;
      }
    }

    const profileUpdate: Record<string, unknown> = {
      full_name: updates.full_name,
      email: updates.email,
      role: updates.role,
      is_active: updates.is_active,
    };
    if (updates.password) profileUpdate.must_change_password = true;

    const { data: profile, error: pError } = await supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', userId)
      .select();
    if (pError) throw pError;

    await auditService.log('USER_UPDATE', 'profiles', userId, {
      name: updates.full_name,
      role: updates.role,
      is_active: updates.is_active,
      password_reset: !!updates.password,
    });

    return profile;
  },

  async deleteUser(userId: string): Promise<true> {
    const { error } = await supabase.functions.invoke('manage-users', {
      body: { action: 'delete', userId },
    });
    if (error) throw error;

    await auditService.log('USER_DELETE', 'profiles', userId, {
      note: 'Usuario eliminado permanentemente',
    });

    const { error: pError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);
    if (pError) throw pError;

    return true;
  },

  async changePassword(newPassword: string): Promise<unknown> {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return data;
  },
};
