import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { updateUser: vi.fn() },
    functions: { invoke: vi.fn() },
  },
}));

vi.mock('../auditService', () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

import { supabase } from '../../lib/supabase';
import { configService } from '../configService';

function mockChain(resolvedValue) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolvedValue),
    maybeSingle: vi.fn().mockResolvedValue(resolvedValue),
  };
  chain.then = (resolve) => resolve(resolvedValue);
  return chain;
}

beforeEach(() => vi.clearAllMocks());

// ─── getSettings ──────────────────────────────────────────────────────────────

describe('configService.getSettings', () => {
  it('returns data when settings exist', async () => {
    const settings = { id: 1, company_name: 'MedOps RD' };
    supabase.from.mockReturnValue(mockChain({ data: settings, error: null }));

    const result = await configService.getSettings();
    expect(result).toEqual(settings);
  });

  it('returns null (no throw) when PGRST116 — no rows found', async () => {
    supabase.from.mockReturnValue(
      mockChain({ data: null, error: { code: 'PGRST116', message: 'no rows' } })
    );

    const result = await configService.getSettings();
    expect(result).toBeNull();
  });

  it('throws for non-PGRST116 errors', async () => {
    supabase.from.mockReturnValue(
      mockChain({ data: null, error: new Error('connection error') })
    );

    await expect(configService.getSettings()).rejects.toThrow('connection error');
  });
});

// ─── updateUser — allowedFields whitelist ─────────────────────────────────────

describe('configService.updateUser — allowedFields whitelist', () => {
  it('strips fields not in allowedFields', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: {}, error: null });
    const profileChain = mockChain({ data: [{ id: 'u-1' }], error: null });
    supabase.from.mockReturnValue(profileChain);

    await configService.updateUser('u-1', {
      full_name: 'Juan',
      role: 'Administrador',
      id: 'strip-me',
      created_at: 'strip-me',
      hacked: 'strip-me',
    });

    const invokePayload = supabase.functions.invoke.mock.calls[0][1].body;
    expect(invokePayload.userData).toHaveProperty('full_name', 'Juan');
    expect(invokePayload.userData).toHaveProperty('role', 'Administrador');
    expect(invokePayload.userData).not.toHaveProperty('id');
    expect(invokePayload.userData).not.toHaveProperty('created_at');
    expect(invokePayload.userData).not.toHaveProperty('hacked');
  });

  it('sets must_change_password=true in profile update when password provided', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: {}, error: null });
    const profileChain = mockChain({ data: [{ id: 'u-2' }], error: null });
    supabase.from.mockReturnValue(profileChain);

    await configService.updateUser('u-2', {
      full_name: 'María',
      password: 'newpass123',
    });

    const updatePayload = profileChain.update.mock.calls[0][0];
    expect(updatePayload.must_change_password).toBe(true);
  });

  it('does NOT set must_change_password when no password in updates', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: {}, error: null });
    const profileChain = mockChain({ data: [{ id: 'u-3' }], error: null });
    supabase.from.mockReturnValue(profileChain);

    await configService.updateUser('u-3', { full_name: 'Pedro' });

    const updatePayload = profileChain.update.mock.calls[0][0];
    expect(updatePayload.must_change_password).toBeUndefined();
  });

  it('throws when edge function fails', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: new Error('edge function error'),
    });

    await expect(
      configService.updateUser('u-4', { full_name: 'X' })
    ).rejects.toThrow('edge function error');
  });
});

// ─── createUser — surgeon record creation ────────────────────────────────────

describe('configService.createUser — surgeon creation', () => {
  it('inserts surgeon record when role is Cirujano', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { user: { id: 'uid-cirujano' } },
      error: null,
    });

    const profileChain = mockChain({ data: { id: 'uid-cirujano' }, error: null });
    const surgeonChain = mockChain({ data: {}, error: null });

    supabase.from
      .mockReturnValueOnce(profileChain)  // profiles.upsert
      .mockReturnValueOnce(surgeonChain); // surgeons.insert

    await configService.createUser({
      full_name: 'Dr. Nuevo',
      email: 'nuevo@hospital.com',
      role: 'Cirujano',
    });

    expect(supabase.from).toHaveBeenCalledWith('surgeons');
    const surgeonPayload = surgeonChain.insert.mock.calls[0][0];
    expect(surgeonPayload).toMatchObject({
      user_id: 'uid-cirujano',
      name: 'Dr. Nuevo',
      email: 'nuevo@hospital.com',
    });
  });

  it('does NOT insert surgeon record for non-Cirujano roles', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { user: { id: 'uid-admin' } },
      error: null,
    });
    supabase.from.mockReturnValue(mockChain({ data: { id: 'uid-admin' }, error: null }));

    await configService.createUser({
      full_name: 'Admin User',
      email: 'admin@hospital.com',
      role: 'Administrador',
    });

    const fromCalls = supabase.from.mock.calls.map(c => c[0]);
    expect(fromCalls).not.toContain('surgeons');
  });
});

// ─── deleteUser ───────────────────────────────────────────────────────────────

describe('configService.deleteUser', () => {
  it('returns true on success', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: {}, error: null });
    supabase.from.mockReturnValue(mockChain({ error: null }));

    const result = await configService.deleteUser('uid-del');
    expect(result).toBe(true);
  });

  it('throws when edge function fails', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: new Error('unauthorized'),
    });

    await expect(configService.deleteUser('uid-x')).rejects.toThrow('unauthorized');
  });
});
