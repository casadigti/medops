import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing the service
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('../auditService', () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../utils/dateUtils', () => ({
  getLocalDateString: vi.fn((date) => {
    if (!date) return '2026-05-19';
    return date.toISOString().split('T')[0];
  }),
}));

import { supabase } from '../../lib/supabase';
import { implantService } from '../implantService';

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
    gt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolvedValue),
  };
  // make the chain itself awaitable (for queries without .single())
  chain.then = (resolve) => resolve(resolvedValue);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('implantService.getLowStockImplants', () => {
  it('returns implants where total stock <= min_stock', async () => {
    const implants = [
      { id: 1, name: 'Tornillo A', min_stock: 5, implant_lots: [{ current_quantity: 3 }, { current_quantity: 1 }] },
      { id: 2, name: 'Placa B', min_stock: 10, implant_lots: [{ current_quantity: 15 }] },
      { id: 3, name: 'Clavo C', min_stock: 2, implant_lots: [{ current_quantity: 2 }] },
    ];
    supabase.from.mockReturnValue(mockChain({ data: implants, error: null }));

    const result = await implantService.getLowStockImplants();

    // id:1 total=4 <= min_stock=5 ✓  id:2 total=15 > 10 ✗  id:3 total=2 <= 2 ✓
    expect(result.map(i => i.id)).toEqual([1, 3]);
  });

  it('treats missing implant_lots as zero stock', async () => {
    const implants = [
      { id: 1, name: 'Sin lotes', min_stock: 1, implant_lots: [] },
      { id: 2, name: 'Null lotes', min_stock: 0, implant_lots: null },
    ];
    supabase.from.mockReturnValue(mockChain({ data: implants, error: null }));

    const result = await implantService.getLowStockImplants();
    expect(result.map(i => i.id)).toEqual([1, 2]);
  });

  it('treats missing min_stock as zero', async () => {
    const implants = [
      { id: 1, name: 'Sin min_stock', implant_lots: [] },
    ];
    supabase.from.mockReturnValue(mockChain({ data: implants, error: null }));

    const result = await implantService.getLowStockImplants();
    // total=0 <= min_stock=0 → included
    expect(result).toHaveLength(1);
  });

  it('throws when supabase returns error', async () => {
    supabase.from.mockReturnValue(mockChain({ data: null, error: new Error('DB error') }));
    await expect(implantService.getLowStockImplants()).rejects.toThrow('DB error');
  });
});

describe('implantService.reportConsumption', () => {
  it('throws when lot has insufficient stock', async () => {
    const chain = mockChain(null);
    // First call: get lot with current_quantity=2
    chain.single
      .mockResolvedValueOnce({ data: { current_quantity: 2 }, error: null })
      // Should never reach insert, but mock it anyway
      .mockResolvedValue({ data: {}, error: null });
    supabase.from.mockReturnValue(chain);

    await expect(
      implantService.reportConsumption({
        surgery_id: 'surg-1',
        implant_lot_id: 'lot-1',
        quantity_used: 5,
        notes: '',
        auth_number: '',
      })
    ).rejects.toThrow('Stock insuficiente en el lote seleccionado');
  });

  it('proceeds when stock is sufficient', async () => {
    const chain = mockChain(null);
    chain.single
      .mockResolvedValueOnce({ data: { current_quantity: 10 }, error: null }) // get lot
      .mockResolvedValue({ data: {}, error: null });

    // insert and update calls resolve without error
    chain.then = (resolve) => resolve({ data: {}, error: null });
    supabase.from.mockReturnValue(chain);

    const result = await implantService.reportConsumption({
      surgery_id: 'surg-1',
      implant_lot_id: 'lot-1',
      quantity_used: 3,
      notes: 'ok',
      auth_number: 'AUTH-123',
    });

    expect(result).toBe(true);
  });
});
