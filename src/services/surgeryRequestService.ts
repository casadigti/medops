import { supabase } from '../lib/supabase';
import { auditService } from './auditService';
import { getImpersonatedOrgId } from '../utils/impersonation';
import type { SurgeryRequest, SurgeryRequestStatus } from '../types/domain';

const REQUEST_SELECT = `
  *,
  surgeon:surgeons(id,full_name,specialty),
  hospital:hospitals(id,name),
  ars:ars(id,name)
`;

export const surgeryRequestService = {
  async getAll(): Promise<SurgeryRequest[]> {
    const orgOverride = getImpersonatedOrgId();
    let query = supabase
      .from('surgery_requests')
      .select(REQUEST_SELECT)
      .order('created_at', { ascending: false });
    if (orgOverride) query = query.eq('org_id', orgOverride);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as SurgeryRequest[];
  },

  async getPending(): Promise<SurgeryRequest[]> {
    const orgOverride = getImpersonatedOrgId();
    let query = supabase
      .from('surgery_requests')
      .select(REQUEST_SELECT)
      .eq('status', 'Pendiente')
      .order('surgery_date', { ascending: true });
    if (orgOverride) query = query.eq('org_id', orgOverride);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as SurgeryRequest[];
  },

  async getMySurgeonRequests(surgeonId: string): Promise<SurgeryRequest[]> {
    const { data, error } = await supabase
      .from('surgery_requests')
      .select(REQUEST_SELECT)
      .eq('surgeon_id', surgeonId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as SurgeryRequest[];
  },

  async create(request: Partial<SurgeryRequest>): Promise<SurgeryRequest> {
    const { data, error } = await supabase
      .from('surgery_requests')
      .insert({
        surgeon_id:     request.surgeon_id,
        patient_name:   request.patient_name,
        surgery_date:   request.surgery_date,
        hospital_id:    request.hospital_id,
        procedure_type: request.procedure_type,
        ars_id:         request.ars_id ?? null,
        nss:            request.nss ?? null,
        notes:          request.notes ?? null,
      })
      .select(REQUEST_SELECT)
      .single();
    if (error) throw error;
    await auditService.log('REQUEST_CREATE', 'surgery_requests', data.id, {
      patient: request.patient_name,
    });
    return data as unknown as SurgeryRequest;
  },

  async approve(requestId: string, adminNotes?: string): Promise<string> {
    // Fetch the request first
    const { data: req, error: fetchErr } = await supabase
      .from('surgery_requests')
      .select(REQUEST_SELECT)
      .eq('id', requestId)
      .single();
    if (fetchErr) throw fetchErr;

    // Create a real surgery from the request
    const { data: surgery, error: surgErr } = await supabase
      .from('surgeries')
      .insert({
        patient_name:   req.patient_name,
        surgery_date:   req.surgery_date,
        surgeon_id:     req.surgeon_id,
        hospital_id:    req.hospital_id,
        procedure_type: req.procedure_type,
        ars_id:         req.ars_id ?? null,
        nss:            req.nss ?? null,
        notes:          req.notes,
        status:         'Pendiente',
      })
      .select('id')
      .single();
    if (surgErr) throw surgErr;

    // Mark request approved + link surgery
    const { error: updateErr } = await supabase
      .from('surgery_requests')
      .update({
        status:     'Aprobada',
        surgery_id: surgery.id,
        admin_notes: adminNotes ?? null,
      })
      .eq('id', requestId);
    if (updateErr) throw updateErr;

    await auditService.log('REQUEST_APPROVE', 'surgery_requests', requestId, {
      surgery_id: surgery.id,
      patient: req.patient_name,
    });
    return surgery.id;
  },

  async reject(requestId: string, adminNotes: string): Promise<void> {
    const { error } = await supabase
      .from('surgery_requests')
      .update({ status: 'Rechazada', admin_notes: adminNotes })
      .eq('id', requestId);
    if (error) throw error;
    await auditService.log('REQUEST_REJECT', 'surgery_requests', requestId, {
      reason: adminNotes,
    });
  },

  async updateStatus(requestId: string, status: SurgeryRequestStatus): Promise<void> {
    const { error } = await supabase
      .from('surgery_requests')
      .update({ status })
      .eq('id', requestId);
    if (error) throw error;
  },
};
