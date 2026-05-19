import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

vi.mock('../auditService', () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

import { supabase } from '../../lib/supabase';
import { auditService } from '../auditService';
import { arsService } from '../arsService';

function mockChain(resolvedValue) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolvedValue),
  };
  chain.then = (resolve) => resolve(resolvedValue);
  return chain;
}

beforeEach(() => vi.clearAllMocks());

// ─── getAll ───────────────────────────────────────────────────────────────────

describe('arsService.getAll', () => {
  it('filters by is_active = true', async () => {
    const chain = mockChain({ data: [], error: null });
    supabase.from.mockReturnValue(chain);

    await arsService.getAll();

    expect(chain.eq).toHaveBeenCalledWith('is_active', true);
  });

  it('returns active ARS list', async () => {
    const arsList = [
      { id: '1', name: 'ARS Humano', is_active: true },
      { id: '2', name: 'ARS Senasa', is_active: true },
    ];
    supabase.from.mockReturnValue(mockChain({ data: arsList, error: null }));

    const result = await arsService.getAll();
    expect(result).toEqual(arsList);
  });

  it('throws on error', async () => {
    supabase.from.mockReturnValue(mockChain({ data: null, error: new Error('db error') }));
    await expect(arsService.getAll()).rejects.toThrow('db error');
  });
});

// ─── create ───────────────────────────────────────────────────────────────────

describe('arsService.create', () => {
  it('wraps name string in { name } object for insert', async () => {
    const chain = mockChain({ data: { id: '3', name: 'ARS Nueva' }, error: null });
    supabase.from.mockReturnValue(chain);

    await arsService.create('ARS Nueva');

    expect(chain.insert).toHaveBeenCalledWith({ name: 'ARS Nueva' });
  });

  it('returns created ARS', async () => {
    const created = { id: '3', name: 'ARS Nueva' };
    supabase.from.mockReturnValue(mockChain({ data: created, error: null }));

    const result = await arsService.create('ARS Nueva');
    expect(result).toEqual(created);
  });

  it('logs ARS_CREATE audit event', async () => {
    const created = { id: '4', name: 'ARS Test' };
    supabase.from.mockReturnValue(mockChain({ data: created, error: null }));

    await arsService.create('ARS Test');

    expect(auditService.log).toHaveBeenCalledWith('ARS_CREATE', 'ars', '4', { name: 'ARS Test' });
  });

  it('throws on insert error (no audit log)', async () => {
    supabase.from.mockReturnValue(mockChain({ data: null, error: new Error('duplicate name') }));

    await expect(arsService.create('Dup')).rejects.toThrow('duplicate name');
    expect(auditService.log).not.toHaveBeenCalled();
  });
});

// ─── update ───────────────────────────────────────────────────────────────────

describe('arsService.update', () => {
  it('calls eq with correct id', async () => {
    const chain = mockChain({ data: [{ id: '1', name: 'Updated' }], error: null });
    supabase.from.mockReturnValue(chain);

    await arsService.update('1', { name: 'Updated' });

    expect(chain.eq).toHaveBeenCalledWith('id', '1');
  });

  it('logs ARS_UPDATE audit event', async () => {
    supabase.from.mockReturnValue(mockChain({ data: [{ id: '1' }], error: null }));

    await arsService.update('1', { name: 'Renamed', is_active: false });

    expect(auditService.log).toHaveBeenCalledWith(
      'ARS_UPDATE', 'ars', '1', { name: 'Renamed', is_active: false }
    );
  });

  it('throws and skips audit on error', async () => {
    supabase.from.mockReturnValue(mockChain({ data: null, error: new Error('not found') }));

    await expect(arsService.update('999', { name: 'X' })).rejects.toThrow('not found');
    expect(auditService.log).not.toHaveBeenCalled();
  });
});

// ─── delete ───────────────────────────────────────────────────────────────────

describe('arsService.delete', () => {
  it('returns true on success', async () => {
    supabase.from.mockReturnValue(mockChain({ error: null }));

    const result = await arsService.delete('1');
    expect(result).toBe(true);
  });

  it('logs ARS_DELETE audit event', async () => {
    supabase.from.mockReturnValue(mockChain({ error: null }));

    await arsService.delete('2');

    expect(auditService.log).toHaveBeenCalledWith(
      'ARS_DELETE', 'ars', '2', { note: 'Aseguradora eliminada' }
    );
  });

  it('throws and skips audit on error', async () => {
    supabase.from.mockReturnValue(mockChain({ error: new Error('fk constraint') }));

    await expect(arsService.delete('1')).rejects.toThrow('fk constraint');
    expect(auditService.log).not.toHaveBeenCalled();
  });
});
