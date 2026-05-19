import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

vi.mock('../../utils/dateUtils', () => ({
  getLocalDateString: vi.fn((date) => {
    if (!date) return '2026-05-19';
    if (typeof date === 'string') return date;
    return date.toISOString().split('T')[0];
  }),
}));

import { supabase } from '../../lib/supabase';
import { trayService } from '../trayService';

function mockChain(resolvedValue) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolvedValue),
  };
  chain.then = (resolve) => resolve(resolvedValue);
  return chain;
}

beforeEach(() => vi.clearAllMocks());

describe('trayService.create — empty string normalization', () => {
  it('converts empty last_sterilization to null', async () => {
    const chain = mockChain({ data: { id: '1', name: 'Bandeja A' }, error: null });
    supabase.from.mockReturnValue(chain);

    await trayService.create({
      name: 'Bandeja A',
      last_sterilization: '',
      next_maintenance: '2026-06-01',
    });

    const insertedPayload = chain.insert.mock.calls[0][0];
    expect(insertedPayload.last_sterilization).toBeNull();
    expect(insertedPayload.next_maintenance).toBe('2026-06-01');
  });

  it('converts empty next_maintenance to null', async () => {
    const chain = mockChain({ data: { id: '1', name: 'Bandeja B' }, error: null });
    supabase.from.mockReturnValue(chain);

    await trayService.create({
      name: 'Bandeja B',
      last_sterilization: '2026-04-01',
      next_maintenance: '',
    });

    const insertedPayload = chain.insert.mock.calls[0][0];
    expect(insertedPayload.next_maintenance).toBeNull();
    expect(insertedPayload.last_sterilization).toBe('2026-04-01');
  });

  it('strips surgery_trays and usage_count from payload', async () => {
    const chain = mockChain({ data: { id: '1' }, error: null });
    supabase.from.mockReturnValue(chain);

    await trayService.create({
      name: 'Bandeja C',
      surgery_trays: [{ id: 'x' }],
      usage_count: 42,
      last_sterilization: null,
      next_maintenance: null,
    });

    const insertedPayload = chain.insert.mock.calls[0][0];
    expect(insertedPayload).not.toHaveProperty('surgery_trays');
    expect(insertedPayload).not.toHaveProperty('usage_count');
  });
});

describe('trayService.update — empty string normalization', () => {
  it('converts empty date strings to null on update', async () => {
    const chain = mockChain({ data: { id: '1' }, error: null });
    supabase.from.mockReturnValue(chain);

    await trayService.update('1', {
      name: 'Bandeja D',
      last_sterilization: '',
      next_maintenance: '',
    });

    const updatedPayload = chain.update.mock.calls[0][0];
    expect(updatedPayload.last_sterilization).toBeNull();
    expect(updatedPayload.next_maintenance).toBeNull();
  });
});

describe('trayService.getAvailableForDate — availability mapping', () => {
  it('marks trays busy when assigned to surgery on that date', async () => {
    const busyChain = mockChain({ data: [{ tray_id: 'tray-busy' }], error: null });
    const allTraysChain = mockChain({
      data: [
        { id: 'tray-busy', name: 'Bandeja 1', status: 'Disponible' },
        { id: 'tray-free', name: 'Bandeja 2', status: 'Disponible' },
      ],
      error: null,
    });

    supabase.from
      .mockReturnValueOnce(busyChain)    // surgery_trays query
      .mockReturnValueOnce(allTraysChain); // trays query

    const result = await trayService.getAvailableForDate(new Date('2026-05-19'));

    const busy = result.find(t => t.id === 'tray-busy');
    const free = result.find(t => t.id === 'tray-free');

    expect(busy.busy).toBe(true);
    expect(busy.unavailable_reason).toBe('Ocupada este día');
    expect(free.busy).toBe(false);
    expect(free.unavailable_reason).toBeNull();
  });

  it('marks trays unavailable when status is not Disponible', async () => {
    const busyChain = mockChain({ data: [], error: null });
    const allTraysChain = mockChain({
      data: [
        { id: 'tray-repair', name: 'Bandeja R', status: 'En reparación' },
        { id: 'tray-clean', name: 'Bandeja L', status: 'En limpieza' },
        { id: 'tray-ok', name: 'Bandeja OK', status: 'Disponible' },
      ],
      error: null,
    });

    supabase.from
      .mockReturnValueOnce(busyChain)
      .mockReturnValueOnce(allTraysChain);

    const result = await trayService.getAvailableForDate(new Date('2026-05-19'));

    expect(result.find(t => t.id === 'tray-repair')).toMatchObject({ busy: true, unavailable_reason: 'En reparación' });
    expect(result.find(t => t.id === 'tray-clean')).toMatchObject({ busy: true, unavailable_reason: 'En limpieza' });
    expect(result.find(t => t.id === 'tray-ok')).toMatchObject({ busy: false, unavailable_reason: null });
  });
});
