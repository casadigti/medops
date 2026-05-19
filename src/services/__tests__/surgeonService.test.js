import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { signUp: vi.fn() },
  },
}));

import { supabase } from '../../lib/supabase';
import { surgeonService, withTimeout } from '../surgeonService';

function mockChain(resolvedValue) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(resolvedValue),
    single: vi.fn().mockResolvedValue(resolvedValue),
  };
  chain.then = (resolve) => resolve(resolvedValue);
  return chain;
}

beforeEach(() => vi.clearAllMocks());

// ─── withTimeout ─────────────────────────────────────────────────────────────

describe('withTimeout', () => {
  it('resolves with the original value when promise resolves in time', async () => {
    const fast = Promise.resolve({ data: [1, 2, 3], error: null });
    const result = await withTimeout(fast, 1000);
    expect(result).toEqual({ data: [1, 2, 3], error: null });
  });

  it('rejects with timeout error when promise exceeds ms', async () => {
    const slow = new Promise(() => {}); // never resolves
    await expect(withTimeout(slow, 50, 'SlowQuery'))
      .rejects.toThrow('SlowQuery timed out after 50ms');
  });

  it('uses default label "Query" when no label provided', async () => {
    const slow = new Promise(() => {});
    await expect(withTimeout(slow, 50))
      .rejects.toThrow('Query timed out after 50ms');
  });

  it('clears timeout after promise resolves (no lingering timer)', async () => {
    vi.useFakeTimers();
    const fast = Promise.resolve('done');
    const result = await withTimeout(fast, 5000);
    expect(result).toBe('done');
    // Advance time — should NOT throw since timer was cleared
    vi.advanceTimersByTime(6000);
    vi.useRealTimers();
  });

  it('rejects with the original error when promise rejects before timeout', async () => {
    const failing = Promise.reject(new Error('db down'));
    await expect(withTimeout(failing, 5000)).rejects.toThrow('db down');
  });
});

// ─── surgeonService CRUD ─────────────────────────────────────────────────────

describe('surgeonService.getAll', () => {
  it('returns surgeon list', async () => {
    const surgeons = [{ id: '1', full_name: 'Dr. Pérez' }];
    supabase.from.mockReturnValue(mockChain({ data: surgeons, error: null }));
    const result = await surgeonService.getAll();
    expect(result).toEqual(surgeons);
  });

  it('throws on error', async () => {
    supabase.from.mockReturnValue(mockChain({ data: null, error: new Error('timeout') }));
    await expect(surgeonService.getAll()).rejects.toThrow('timeout');
  });
});

describe('surgeonService.create', () => {
  it('inserts and returns new surgeon', async () => {
    const surgeon = { id: '2', full_name: 'Dra. Martínez', specialty: 'Ortopedia' };
    supabase.from.mockReturnValue(mockChain({ data: surgeon, error: null }));
    const result = await surgeonService.create({ full_name: 'Dra. Martínez', specialty: 'Ortopedia' });
    expect(result).toEqual(surgeon);
  });

  it('throws on duplicate', async () => {
    supabase.from.mockReturnValue(mockChain({ data: null, error: new Error('duplicate key') }));
    await expect(surgeonService.create({ full_name: 'Dup' })).rejects.toThrow('duplicate key');
  });
});

describe('surgeonService.update', () => {
  it('calls eq with correct id', async () => {
    const chain = mockChain({ data: { id: '3' }, error: null });
    supabase.from.mockReturnValue(chain);
    await surgeonService.update('3', { specialty: 'Neurocirugía' });
    expect(chain.eq).toHaveBeenCalledWith('id', '3');
  });
});

describe('surgeonService.delete', () => {
  it('throws on foreign key constraint', async () => {
    supabase.from.mockReturnValue(mockChain({ error: new Error('fk constraint') }));
    await expect(surgeonService.delete('1')).rejects.toThrow('fk constraint');
  });
});

describe('surgeonService.getUserByEmail', () => {
  it('queries profiles table by email', async () => {
    const chain = mockChain({ data: { id: 'user-1' }, error: null });
    supabase.from.mockReturnValue(chain);

    const result = await surgeonService.getUserByEmail('doc@hospital.com');

    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(chain.eq).toHaveBeenCalledWith('email', 'doc@hospital.com');
    expect(result).toEqual({ id: 'user-1' });
  });

  it('returns null when email not found', async () => {
    supabase.from.mockReturnValue(mockChain({ data: null, error: null }));
    const result = await surgeonService.getUserByEmail('nobody@x.com');
    expect(result).toBeNull();
  });
});

// ─── createPortalUser — password generation ───────────────────────────────────

describe('surgeonService.createPortalUser', () => {
  it('generates a 10-character alphanumeric temp password', async () => {
    const userId = 'auth-uuid-123';
    supabase.auth.signUp.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });

    // mock profile upsert
    const profileChain = mockChain({ error: null });
    supabase.from.mockReturnValue(profileChain);

    const { tempPassword } = await surgeonService.createPortalUser({
      email: 'nuevo@hospital.com',
      full_name: 'Dr. Nuevo',
    });

    expect(tempPassword).toHaveLength(10);
    // Only chars from the defined charset (no ambiguous chars like 0,O,1,I,l)
    expect(tempPassword).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789]+$/);
  }, 10000); // 1500ms setTimeout inside — give it room

  it('returns userId from auth.signUp', async () => {
    supabase.auth.signUp.mockResolvedValue({
      data: { user: { id: 'auth-456' } },
      error: null,
    });
    supabase.from.mockReturnValue(mockChain({ error: null }));

    const { userId } = await surgeonService.createPortalUser({
      email: 'doc2@hospital.com',
      full_name: 'Dra. Segunda',
    });

    expect(userId).toBe('auth-456');
  }, 10000);

  it('throws when signUp fails', async () => {
    supabase.auth.signUp.mockResolvedValue({
      data: null,
      error: new Error('email already registered'),
    });

    await expect(
      surgeonService.createPortalUser({ email: 'dup@hospital.com', full_name: 'Dup' })
    ).rejects.toThrow('email already registered');
  });

  it('throws when user id missing from signUp response', async () => {
    supabase.auth.signUp.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(
      surgeonService.createPortalUser({ email: 'ghost@hospital.com', full_name: 'Ghost' })
    ).rejects.toThrow('No se pudo crear el usuario de autenticación.');
  });
});
