import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture what autoTable receives so we can inspect row calculations
let capturedAutoTableCalls = [];

vi.mock('jspdf', () => {
  class MockJsPDF {
    constructor() {
      this.setFillColor = vi.fn();
      this.rect = vi.fn();
      this.setTextColor = vi.fn();
      this.setFontSize = vi.fn();
      this.setFont = vi.fn();
      this.text = vi.fn();
      this.line = vi.fn();
      this.splitTextToSize = vi.fn().mockReturnValue([]);
      this.save = vi.fn();
      this.internal = { pageSize: { width: 210 } };
      this.lastAutoTable = { finalY: 100 };
    }
  }
  return { default: MockJsPDF };
});

vi.mock('jspdf-autotable', () => ({
  default: vi.fn((_doc, opts) => {
    capturedAutoTableCalls.push(opts);
  }),
}));

import { printService } from '../printService';

beforeEach(() => {
  capturedAutoTableCalls = [];
  vi.clearAllMocks();
});

// ─── generateReplenishmentReport — row calculations ──────────────────────────

// NOTE: generateReplenishmentReport signature is (data, dateRange, summary)
// summary is the 3rd param used for Object.values().map()

describe('printService.generateReplenishmentReport — daysLeft calculation', () => {
  const dateRange = { start: '2026-05-01', end: '2026-05-31' }; // 30 days

  it('calculates daysLeft as floor(current_stock / daily_consumption)', async () => {
    const summary = {
      prod1: { name: 'Tornillo A', sku: 'T-001', category: 'Ortopedia', current_stock: 60, total_used: 30, unit_cost: 100 },
    };

    await printService.generateReplenishmentReport({}, dateRange, summary);

    // daysInRange = 30, dailyConsumption = 30/30 = 1, daysLeft = floor(60/1) = 60
    const rows = capturedAutoTableCalls[0].body;
    expect(rows[0][5]).toBe('60 días');
  });

  it('shows ∞ when total_used is 0 (no consumption)', async () => {
    const summary = {
      prod1: { name: 'Placa B', sku: 'P-001', category: 'Trauma', current_stock: 10, total_used: 0, unit_cost: 500 },
    };

    await printService.generateReplenishmentReport({}, dateRange, summary);

    const rows = capturedAutoTableCalls[0].body;
    expect(rows[0][5]).toBe('∞');
  });

  it('floors decimal daysLeft', async () => {
    const summary = {
      prod1: { name: 'Clavo C', sku: 'C-001', category: 'Trauma', current_stock: 7, total_used: 10, unit_cost: 200 },
    };

    await printService.generateReplenishmentReport({}, dateRange, summary);

    // daysInRange=30, dailyConsumption=10/30≈0.333, daysLeft=floor(7/0.333)=floor(21)=21
    const rows = capturedAutoTableCalls[0].body;
    expect(rows[0][5]).toBe('21 días');
  });
});

describe('printService.generateReplenishmentReport — totalCost calculation', () => {
  const dateRange = { start: '2026-05-01', end: '2026-05-10' }; // 9 days

  it('sums total_used * unit_cost across all products via subtotal column', async () => {
    const summary = {
      a: { name: 'A', sku: 'A1', category: 'X', current_stock: 5, total_used: 10, unit_cost: 100 },
      b: { name: 'B', sku: 'B1', category: 'Y', current_stock: 3, total_used: 5,  unit_cost: 200 },
    };
    // a subtotal: 10*100=1000, b subtotal: 5*200=1000

    await printService.generateReplenishmentReport({}, dateRange, summary);

    const rows = capturedAutoTableCalls[0].body;
    const subtotals = rows.map(r => r[6]);
    expect(subtotals[0]).toContain('1,000');
    expect(subtotals[1]).toContain('1,000');
  });
});

describe('printService.generateReplenishmentReport — table rows', () => {
  it('maps each summary item to correct column order', async () => {
    const summary = {
      p: { name: 'Tornillo X', sku: 'TX-01', category: 'Ortopedia', current_stock: 20, total_used: 10, unit_cost: 150 },
    };
    const dateRange = { start: '2026-05-01', end: '2026-05-11' }; // 10 days

    await printService.generateReplenishmentReport({}, dateRange, summary);

    const rows = capturedAutoTableCalls[0].body;
    expect(rows[0][0]).toBe('Tornillo X');     // name
    expect(rows[0][1]).toBe('TX-01');          // sku
    expect(rows[0][2]).toBe('Ortopedia');      // category
    expect(rows[0][3]).toBe(20);               // current_stock
    expect(rows[0][4]).toBe(10);               // total_used
    expect(rows[0][6]).toContain('1,500');     // subtotal: 10 * 150
  });
});

// ─── generateDeliverySheet — tray mapping ────────────────────────────────────

describe('printService.generateDeliverySheet — tray table rows', () => {
  const baseSurgery = {
    id: 'surg-uuid-12345',
    patient_name: 'Juan Pérez',
    surgery_date: '2026-06-01T08:00:00',
    hospital: { name: 'Hospital Metro' },
    surgeon: { full_name: 'Dr. García' },
    procedure_type: 'Artroplastia',
    delivery_responsible: 'Técnico A',
    notes: null,
    surgery_trays: [],
  };

  it('maps surgery_trays to [code, name, procedure_type, OK]', async () => {
    const surgery = {
      ...baseSurgery,
      surgery_trays: [
        { tray: { code: 'BDJ-01', name: 'Set Ortopédico', procedure_type: 'Ortopedia' } },
        { tray: { code: 'BDJ-02', name: 'Set Trauma', procedure_type: 'Trauma' } },
      ],
    };

    await printService.generateDeliverySheet(surgery);

    const rows = capturedAutoTableCalls[0].body;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(['BDJ-01', 'Set Ortopédico', 'Ortopedia', 'OK']);
    expect(rows[1]).toEqual(['BDJ-02', 'Set Trauma', 'Trauma', 'OK']);
  });

  it('shows placeholder row when no trays assigned', async () => {
    await printService.generateDeliverySheet(baseSurgery);

    const rows = capturedAutoTableCalls[0].body;
    expect(rows).toHaveLength(1);
    expect(rows[0][1]).toBe('No hay bandejas asignadas');
  });

  it('handles tray with missing fields gracefully', async () => {
    const surgery = {
      ...baseSurgery,
      surgery_trays: [{ tray: {} }],
    };

    await printService.generateDeliverySheet(surgery);

    const rows = capturedAutoTableCalls[0].body;
    expect(rows[0]).toEqual(['-', 'Set no especificado', '-', 'OK']);
  });
});
