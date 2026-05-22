import { supabase } from '../lib/supabase';
import { auditService } from './auditService';
import type { Organization } from '../types/domain';

interface CreateOrgInput {
  name: string;
  slug?: string;
  admin_email: string;
  admin_full_name: string;
}

interface CreateOrgResult {
  org: Organization;
  admin: { id: string; email: string };
  tempPassword: string;
}

// Gestión de organizaciones (tenants). Solo accesible para un administrador
// de plataforma — RLS y la Edge Function manage-orgs lo hacen cumplir.
export const organizationService = {
  async getAll(): Promise<Organization[]> {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async createOrg(input: CreateOrgInput): Promise<CreateOrgResult> {
    const { data, error } = await supabase.functions.invoke('manage-orgs', {
      body: { action: 'create-org', orgData: input },
    });
    if (error) throw error;
    await auditService.log('ORG_CREATE', 'organizations', data.org.id, {
      name: input.name,
      admin_email: input.admin_email,
    });
    return data as CreateOrgResult;
  },

  async setActive(id: string, is_active: boolean): Promise<void> {
    const { error } = await supabase
      .from('organizations')
      .update({ is_active })
      .eq('id', id);
    if (error) throw error;
    await auditService.log('ORG_UPDATE', 'organizations', id, { is_active });
  },

  async deleteOrg(id: string, name: string): Promise<void> {
    const { data, error } = await supabase.functions.invoke('manage-orgs', {
      body: { action: 'delete-org', orgId: id },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    await auditService.log('ORG_DELETE', 'organizations', id, { name });
  },
};
