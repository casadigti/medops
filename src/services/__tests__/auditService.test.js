import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getSession: vi.fn() },
  },
}));

import { supabase } from '../../lib/supabase';
import { auditService } from '../auditService';

function mockChain(resolvedValue) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolvedValue),
  };
  chain.then = (resolve) => resolve(resolvedValue);
  return chain;
}

const mockSession = (userId = 'user-1', email = 'admin@test.com') => ({
  data: { session: { user: { id: userId, email } } },
  error: null,
});

beforeEach(() => vi.clearAllMocks());

// ─── log — sensitive key sanitization ────────────────────────────────────────

describe('auditService.log — sensitive key sanitization', () => {
  it('redacts password fields', async () => {
    supabase.auth.getSession.mockResolvedValue(mockSession());
    const chain = mockChain({ error: null });
    supabase.from.mockReturnValue(chain);

    await auditService.log('USER_UPDATE', 'profiles', '1', {
      full_name: 'Juan',
      password: 'secret123',
    });

    const inserted = chain.insert.mock.calls[0][0];
    expect(inserted.details.password).toBe('[REDACTED]');
    expect(inserted.details.full_name).toBe('Juan');
  });

  it('redacts token, key, secret, auth, access_token fields', async () => {
    supabase.auth.getSession.mockResolvedValue(mockSession());
    const chain = mockChain({ error: null });
    supabase.from.mockReturnValue(chain);

    await auditService.log('SOME_ACTION', 'table', '1', {
      api_key: 'abc',
      auth_header: 'Bearer xyz',
      secret_value: 'shhh',
      access_token: 'tok',
      normal_field: 'visible',
    });

    const { details } = chain.insert.mock.calls[0][0];
    expect(details.api_key).toBe('[REDACTED]');
    expect(details.auth_header).toBe('[REDACTED]');
    expect(details.secret_value).toBe('[REDACTED]');
    expect(details.access_token).toBe('[REDACTED]');
    expect(details.normal_field).toBe('visible');
  });

  it('sanitization is case-insensitive on key names', async () => {
    supabase.auth.getSession.mockResolvedValue(mockSession());
    const chain = mockChain({ error: null });
    supabase.from.mockReturnValue(chain);

    await auditService.log('X', 'y', '1', {
      PASSWORD: 'val',
      TOKEN: 'val',
      ApiKey: 'val',
    });

    const { details } = chain.insert.mock.calls[0][0];
    expect(details.PASSWORD).toBe('[REDACTED]');
    expect(details.TOKEN).toBe('[REDACTED]');
    expect(details.ApiKey).toBe('[REDACTED]');
  });

  it('does not mutate original details object', async () => {
    supabase.auth.getSession.mockResolvedValue(mockSession());
    supabase.from.mockReturnValue(mockChain({ error: null }));

    const original = { password: 'secret', name: 'Juan' };
    await auditService.log('X', 'y', '1', original);

    expect(original.password).toBe('secret'); // original unchanged
  });
});

// ─── log — early return when no session ──────────────────────────────────────

describe('auditService.log — no session', () => {
  it('returns without inserting when session is null', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });

    await auditService.log('ACTION', 'table', '1', { note: 'test' });

    expect(supabase.from).not.toHaveBeenCalled();
  });
});

// ─── log — never throws ───────────────────────────────────────────────────────

describe('auditService.log — swallows errors', () => {
  it('does not throw when supabase.from throws', async () => {
    supabase.auth.getSession.mockResolvedValue(mockSession());
    supabase.from.mockImplementation(() => { throw new Error('network error'); });

    await expect(
      auditService.log('ACTION', 'table', '1', {})
    ).resolves.toBeUndefined();
  });
});

// ─── log — stores correct metadata ───────────────────────────────────────────

describe('auditService.log — stored payload', () => {
  it('stores action, entity_type, entity_id as string, user_id, user_email', async () => {
    supabase.auth.getSession.mockResolvedValue(mockSession('uid-99', 'doc@med.com'));
    const chain = mockChain({ error: null });
    supabase.from.mockReturnValue(chain);

    await auditService.log('SURGERY_CREATE', 'surgeries', 42, { patient: 'Ana' });

    const inserted = chain.insert.mock.calls[0][0];
    expect(inserted.user_id).toBe('uid-99');
    expect(inserted.user_email).toBe('doc@med.com');
    expect(inserted.action).toBe('SURGERY_CREATE');
    expect(inserted.entity_type).toBe('surgeries');
    expect(inserted.entity_id).toBe('42'); // numeric id converted to string
  });
});

// ─── getFiltered — conditional filters ───────────────────────────────────────

describe('auditService.getFiltered', () => {
  it('returns data and count', async () => {
    const chain = mockChain({ data: [{ id: 1 }], error: null, count: 1 });
    supabase.from.mockReturnValue(chain);

    const result = await auditService.getFiltered({});
    expect(result).toEqual({ data: [{ id: 1 }], count: 1 });
  });

  it('applies action ilike filter when provided', async () => {
    const chain = mockChain({ data: [], error: null, count: 0 });
    supabase.from.mockReturnValue(chain);

    await auditService.getFiltered({ action: 'SURGERY' });

    expect(chain.ilike).toHaveBeenCalledWith('action', '%SURGERY%');
  });

  it('skips ilike filter when action not provided', async () => {
    const chain = mockChain({ data: [], error: null, count: 0 });
    supabase.from.mockReturnValue(chain);

    await auditService.getFiltered({});

    expect(chain.ilike).not.toHaveBeenCalled();
  });

  it('applies gte filter for dateFrom', async () => {
    const chain = mockChain({ data: [], error: null, count: 0 });
    supabase.from.mockReturnValue(chain);

    await auditService.getFiltered({ dateFrom: '2026-01-01' });

    expect(chain.gte).toHaveBeenCalledWith('created_at', new Date('2026-01-01').toISOString());
  });

  it('applies lte filter for dateTo at end of day', async () => {
    const chain = mockChain({ data: [], error: null, count: 0 });
    supabase.from.mockReturnValue(chain);

    await auditService.getFiltered({ dateTo: '2026-01-31' });

    const lteArg = chain.lte.mock.calls[0][1];
    const date = new Date(lteArg);
    expect(date.getHours()).toBe(23);
    expect(date.getMinutes()).toBe(59);
    expect(date.getSeconds()).toBe(59);
  });

  it('returns empty data array when no results', async () => {
    const chain = mockChain({ data: null, error: null, count: 0 });
    supabase.from.mockReturnValue(chain);

    const result = await auditService.getFiltered({});
    expect(result.data).toEqual([]);
    expect(result.count).toBe(0);
  });
});
