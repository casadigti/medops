import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from '../../lib/supabase';
import { hospitalService } from '../hospitalService';

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

describe('hospitalService.getAll', () => {
  it('returns hospital list ordered by name', async () => {
    const hospitals = [
      { id: '1', name: 'Clínica Abel González' },
      { id: '2', name: 'Hospital Metropolitano' },
    ];
    supabase.from.mockReturnValue(mockChain({ data: hospitals, error: null }));

    const result = await hospitalService.getAll();

    expect(supabase.from).toHaveBeenCalledWith('hospitals');
    expect(result).toEqual(hospitals);
  });

  it('throws on supabase error', async () => {
    supabase.from.mockReturnValue(mockChain({ data: null, error: new Error('connection refused') }));
    await expect(hospitalService.getAll()).rejects.toThrow('connection refused');
  });
});

describe('hospitalService.create', () => {
  it('inserts and returns new hospital', async () => {
    const newHospital = { id: '3', name: 'Centro Médico UCE', city: 'Santo Domingo' };
    supabase.from.mockReturnValue(mockChain({ data: newHospital, error: null }));

    const result = await hospitalService.create({ name: 'Centro Médico UCE', city: 'Santo Domingo' });

    expect(result).toEqual(newHospital);
  });

  it('throws on insert error', async () => {
    supabase.from.mockReturnValue(mockChain({ data: null, error: new Error('duplicate key') }));
    await expect(hospitalService.create({ name: 'Dup' })).rejects.toThrow('duplicate key');
  });
});

describe('hospitalService.update', () => {
  it('updates and returns hospital', async () => {
    const updated = { id: '1', name: 'Clínica Abel González Updated' };
    supabase.from.mockReturnValue(mockChain({ data: updated, error: null }));

    const result = await hospitalService.update('1', { name: 'Clínica Abel González Updated' });

    const chain = supabase.from.mock.results[0].value;
    expect(chain.eq).toHaveBeenCalledWith('id', '1');
    expect(result).toEqual(updated);
  });

  it('throws on update error', async () => {
    supabase.from.mockReturnValue(mockChain({ data: null, error: new Error('not found') }));
    await expect(hospitalService.update('999', { name: 'X' })).rejects.toThrow('not found');
  });
});

describe('hospitalService.delete', () => {
  it('calls delete with correct id', async () => {
    const chain = mockChain({ error: null });
    supabase.from.mockReturnValue(chain);

    await hospitalService.delete('1');

    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('id', '1');
  });

  it('throws on delete error', async () => {
    supabase.from.mockReturnValue(mockChain({ error: new Error('foreign key constraint') }));
    await expect(hospitalService.delete('1')).rejects.toThrow('foreign key constraint');
  });
});
