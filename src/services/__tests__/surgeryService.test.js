import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getSession: vi.fn() },
    functions: { invoke: vi.fn() },
  },
}));

vi.mock('../auditService', () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

import { supabase } from '../../lib/supabase';
import { surgeryService } from '../surgeryService';

// Builds a chainable mock. resolvedValue is returned by .single() and by awaiting the chain.
function mockChain(resolvedValue) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    abortSignal: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolvedValue),
  };
  chain.then = (resolve) => resolve(resolvedValue);
  return chain;
}

beforeEach(() => vi.clearAllMocks());

// ─── create ──────────────────────────────────────────────────────────────────

describe('surgeryService.create — allowedFields whitelist', () => {
  it('strips fields not in allowedFields', async () => {
    const surgeryChain = mockChain({ data: { id: 'surg-1', patient_name: 'Juan' }, error: null });
    supabase.from.mockReturnValue(surgeryChain);

    await surgeryService.create({
      patient_name: 'Juan',
      surgery_date: '2026-06-01T08:00:00',
      id: 'should-be-stripped',
      created_at: 'should-be-stripped',
      internal_flag: 'should-be-stripped',
    });

    const payload = surgeryChain.insert.mock.calls[0][0];
    expect(payload).toHaveProperty('patient_name', 'Juan');
    expect(payload).toHaveProperty('surgery_date');
    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('created_at');
    expect(payload).not.toHaveProperty('internal_flag');
  });

  it('only includes defined allowed fields', async () => {
    const surgeryChain = mockChain({ data: { id: 'surg-2' }, error: null });
    supabase.from.mockReturnValue(surgeryChain);

    await surgeryService.create({ patient_name: 'María' });

    const payload = surgeryChain.insert.mock.calls[0][0];
    expect(Object.keys(payload)).toEqual(['patient_name']);
  });

  it('throws when supabase returns error', async () => {
    const chain = mockChain({ data: null, error: new Error('insert failed') });
    supabase.from.mockReturnValue(chain);

    await expect(surgeryService.create({ patient_name: 'Pedro' }))
      .rejects.toThrow('insert failed');
  });
});

describe('surgeryService.create — tray linking', () => {
  it('inserts surgery_trays when trayIds provided', async () => {
    const surgeryChain = mockChain({ data: { id: 'surg-3', patient_name: 'Ana' }, error: null });
    const traysChain = mockChain({ data: [], error: null });

    supabase.from
      .mockReturnValueOnce(surgeryChain)  // surgeries insert
      .mockReturnValueOnce(traysChain);   // surgery_trays insert

    await surgeryService.create({ patient_name: 'Ana' }, ['tray-1', 'tray-2']);

    expect(supabase.from).toHaveBeenCalledWith('surgery_trays');
    const traysPayload = traysChain.insert.mock.calls[0][0];
    expect(traysPayload).toEqual([
      { surgery_id: 'surg-3', tray_id: 'tray-1' },
      { surgery_id: 'surg-3', tray_id: 'tray-2' },
    ]);
  });

  it('skips surgery_trays insert when no trayIds', async () => {
    const surgeryChain = mockChain({ data: { id: 'surg-4' }, error: null });
    supabase.from.mockReturnValue(surgeryChain);

    await surgeryService.create({ patient_name: 'Luis' }, []);

    // from() called only once (surgeries), never for surgery_trays
    const calls = supabase.from.mock.calls.map(c => c[0]);
    expect(calls).not.toContain('surgery_trays');
  });
});

// ─── update ──────────────────────────────────────────────────────────────────

describe('surgeryService.update — allowedFields whitelist', () => {
  it('strips disallowed fields on update', async () => {
    const surgeryChain = mockChain({ data: { id: 'surg-5' }, error: null });
    const deleteChain = mockChain({ data: null, error: null });

    supabase.from
      .mockReturnValueOnce(surgeryChain)  // surgeries update
      .mockReturnValueOnce(deleteChain);  // surgery_trays delete

    await surgeryService.update('surg-5', {
      patient_name: 'Carlos',
      status: 'Programada',
      id: 'strip-me',
      hacked_field: 'strip-me',
    });

    const payload = surgeryChain.update.mock.calls[0][0];
    expect(payload).toHaveProperty('patient_name', 'Carlos');
    expect(payload).toHaveProperty('status', 'Programada');
    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('hacked_field');
  });
});

describe('surgeryService.update — tray replacement', () => {
  it('deletes existing trays then inserts new ones', async () => {
    const surgeryChain = mockChain({ data: { id: 'surg-6' }, error: null });
    const deleteChain = mockChain({ data: null, error: null });
    const insertChain = mockChain({ data: [], error: null });

    supabase.from
      .mockReturnValueOnce(surgeryChain)  // surgeries.update
      .mockReturnValueOnce(deleteChain)   // surgery_trays.delete
      .mockReturnValueOnce(insertChain);  // surgery_trays.insert

    await surgeryService.update('surg-6', { patient_name: 'Rosa' }, ['tray-A']);

    // delete was called on surgery_trays
    expect(deleteChain.delete).toHaveBeenCalled();
    expect(deleteChain.eq).toHaveBeenCalledWith('surgery_id', 'surg-6');

    // insert was called with correct payload
    const insertPayload = insertChain.insert.mock.calls[0][0];
    expect(insertPayload).toEqual([{ surgery_id: 'surg-6', tray_id: 'tray-A' }]);
  });

  it('deletes trays but skips insert when trayIds empty', async () => {
    const surgeryChain = mockChain({ data: { id: 'surg-7' }, error: null });
    const deleteChain = mockChain({ data: null, error: null });

    supabase.from
      .mockReturnValueOnce(surgeryChain)
      .mockReturnValueOnce(deleteChain);

    await surgeryService.update('surg-7', { patient_name: 'Tomás' }, []);

    const fromCalls = supabase.from.mock.calls.map(c => c[0]);
    // surgeries + surgery_trays(delete) — no third call for insert
    expect(fromCalls.filter(t => t === 'surgery_trays')).toHaveLength(1);
    expect(deleteChain.insert).not.toHaveBeenCalled();
  });
});

// ─── updateStatus / updateDate ───────────────────────────────────────────────

describe('surgeryService.updateStatus', () => {
  it('updates only status field', async () => {
    const chain = mockChain({ data: { id: 'surg-8', status: 'Completada' }, error: null });
    supabase.from.mockReturnValue(chain);

    const result = await surgeryService.updateStatus('surg-8', 'Completada');

    expect(chain.update).toHaveBeenCalledWith({ status: 'Completada' });
    expect(result.status).toBe('Completada');
  });
});

describe('surgeryService.updateDate', () => {
  it('updates only surgery_date field', async () => {
    const chain = mockChain({ data: { id: 'surg-9', surgery_date: '2026-07-01' }, error: null });
    supabase.from.mockReturnValue(chain);

    await surgeryService.updateDate('surg-9', '2026-07-01');

    expect(chain.update).toHaveBeenCalledWith({ surgery_date: '2026-07-01' });
  });
});
