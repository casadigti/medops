import { supabase } from '../lib/supabase';
import { getImpersonatedOrgId } from '../utils/impersonation';
import type { StorageShelf, StorageSlot, SlotItemType, AvailableItems } from '../types/domain';

export const cellLabel = (row: number, col: number): string =>
  String.fromCharCode(65 + row) + (col + 1);

export const storageService = {

  async getShelves(): Promise<StorageShelf[]> {
    const orgOverride = getImpersonatedOrgId();
    let query = supabase
      .from('storage_shelves')
      .select('*, storage_slots(*)')
      .order('created_at');
    if (orgOverride) query = (query as typeof query).eq('org_id', orgOverride);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return [];

    const lotIds: string[] = [];
    const trayIds: string[] = [];
    for (const shelf of data) {
      for (const slot of (shelf.storage_slots ?? [])) {
        if (slot.item_type === 'implant_lot' && slot.item_id) lotIds.push(slot.item_id);
        if (slot.item_type === 'tray' && slot.item_id) trayIds.push(slot.item_id);
      }
    }

    const lotMap: Record<string, { label: string; detail: string }> = {};
    const trayMap: Record<string, { label: string; detail: string }> = {};

    if (lotIds.length > 0) {
      const { data: lots } = await supabase
        .from('implant_lots')
        .select('id, lot_number, current_quantity, implants(name, sku)')
        .in('id', lotIds);
      for (const l of (lots ?? [])) {
        const imp = Array.isArray(l.implants) ? l.implants[0] : l.implants;
        lotMap[l.id] = {
          label: `${imp?.name ?? '—'} · Lote ${l.lot_number}`,
          detail: `Cant: ${l.current_quantity} · ${imp?.sku ?? ''}`,
        };
      }
    }

    const supportTrayIds = new Set<string>();
    if (trayIds.length > 0) {
      const { data: trays } = await supabase
        .from('trays')
        .select('id, name, code, status, is_support_tray')
        .in('id', trayIds);
      for (const t of (trays ?? [])) {
        trayMap[t.id] = {
          label: t.name,
          detail: `${t.code ?? ''} · ${t.status}`,
        };
        if (t.is_support_tray) supportTrayIds.add(t.id);
      }
    }

    return data.map((shelf): StorageShelf => ({
      id: shelf.id,
      org_id: shelf.org_id,
      name: shelf.name,
      orientation: shelf.orientation,
      facing: shelf.facing ?? 'bottom',
      rows: shelf.rows,
      cols: shelf.cols,
      color: shelf.color,
      description: shelf.description,
      created_at: shelf.created_at,
      position_x: shelf.position_x ?? null,
      position_y: shelf.position_y ?? null,
      slots: (shelf.storage_slots ?? []).map((slot: StorageSlot) => ({
        ...slot,
        item_label:  slot.item_id
          ? (slot.item_type === 'implant_lot' ? lotMap[slot.item_id]?.label  : trayMap[slot.item_id]?.label)
          : undefined,
        item_detail: slot.item_id
          ? (slot.item_type === 'implant_lot' ? lotMap[slot.item_id]?.detail : trayMap[slot.item_id]?.detail)
          : undefined,
        is_support_tray: slot.item_type === 'tray' && slot.item_id
          ? supportTrayIds.has(slot.item_id)
          : undefined,
      })),
    }));
  },

  async createShelf(input: {
    name: string;
    orientation: 'horizontal' | 'vertical';
    rows: number;
    cols: number;
    color: string;
    description?: string;
  }): Promise<StorageShelf> {
    const { data: shelf, error } = await supabase
      .from('storage_shelves')
      .insert(input)
      .select()
      .single();
    if (error) throw error;

    const slotRows = [];
    for (let r = 0; r < shelf.rows; r++) {
      for (let c = 0; c < shelf.cols; c++) {
        slotRows.push({ shelf_id: shelf.id, row_index: r, col_index: c });
      }
    }
    const { error: slotErr } = await supabase.from('storage_slots').insert(slotRows);
    if (slotErr) throw slotErr;

    return shelf;
  },

  async updateShelf(
    id: string,
    updates: Partial<Pick<StorageShelf, 'name' | 'color' | 'description' | 'orientation' | 'position_x' | 'position_y'>>
  ): Promise<StorageShelf> {
    const { data, error } = await supabase
      .from('storage_shelves')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateShelfPosition(id: string, x: number | null, y: number | null): Promise<void> {
    const { error } = await supabase
      .from('storage_shelves')
      .update({ position_x: x, position_y: y })
      .eq('id', id);
    if (error) throw error;
  },

  async rotateShelf(id: string, currentFacing: import('../types/domain').ShelfFacing): Promise<void> {
    const cycle: Record<string, string> = { bottom: 'right', right: 'top', top: 'left', left: 'bottom' };
    const newFacing = cycle[currentFacing] ?? 'bottom';
    const newOrientation = (newFacing === 'left' || newFacing === 'right') ? 'vertical' : 'horizontal';
    const { error } = await supabase
      .from('storage_shelves')
      .update({ facing: newFacing, orientation: newOrientation })
      .eq('id', id);
    if (error) throw error;
  },

  async deleteShelf(id: string): Promise<void> {
    const { error } = await supabase.from('storage_shelves').delete().eq('id', id);
    if (error) throw error;
  },

  async assignSlot(slotId: string, itemType: SlotItemType, itemId: string, notes?: string): Promise<void> {
    const { error } = await supabase
      .from('storage_slots')
      .update({ item_type: itemType, item_id: itemId, notes: notes ?? null })
      .eq('id', slotId);
    if (error) throw error;
  },

  async clearSlot(slotId: string): Promise<void> {
    const { error } = await supabase
      .from('storage_slots')
      .update({ item_type: null, item_id: null, notes: null })
      .eq('id', slotId);
    if (error) throw error;
  },

  async getSlotLocations(itemIds: string[]): Promise<Record<string, string>> {
    if (itemIds.length === 0) return {};
    const { data, error } = await supabase
      .from('storage_slots')
      .select('item_id, row_index, col_index, storage_shelves!shelf_id(name)')
      .not('item_id', 'is', null)
      .in('item_id', itemIds);
    if (error) throw error;
    const map: Record<string, string> = {};
    for (const slot of (data ?? [])) {
      const shelves = slot.storage_shelves as unknown as { name: string } | null;
      const shelfName = Array.isArray(shelves) ? (shelves[0] as { name: string })?.name : shelves?.name;
      if (slot.item_id && shelfName) {
        map[slot.item_id] = `${shelfName} · Celda ${cellLabel(slot.row_index, slot.col_index)}`;
      }
    }
    return map;
  },

  async getAvailableItems(): Promise<AvailableItems> {
    const orgOverride = getImpersonatedOrgId();

    const { data: occupied } = await supabase
      .from('storage_slots')
      .select('item_id, item_type')
      .not('item_id', 'is', null);

    const occupiedLotIds  = (occupied ?? []).filter(s => s.item_type === 'implant_lot').map(s => s.item_id as string);
    const occupiedTrayIds = (occupied ?? []).filter(s => s.item_type === 'tray').map(s => s.item_id as string);

    let lotQuery = supabase
      .from('implant_lots')
      .select('id, lot_number, current_quantity, implants(name, sku)')
      .gt('current_quantity', 0)
      .order('lot_number');
    if (orgOverride) lotQuery = (lotQuery as typeof lotQuery).eq('org_id', orgOverride);
    if (occupiedLotIds.length > 0) {
      lotQuery = (lotQuery as typeof lotQuery).not('id', 'in', `(${occupiedLotIds.join(',')})`);
    }
    const { data: lots, error: lotErr } = await lotQuery;
    if (lotErr) throw lotErr;

    let trayQuery = supabase
      .from('trays')
      .select('id, name, code, status, is_support_tray')
      .order('name');
    if (orgOverride) trayQuery = (trayQuery as typeof trayQuery).eq('org_id', orgOverride);
    if (occupiedTrayIds.length > 0) {
      trayQuery = (trayQuery as typeof trayQuery).not('id', 'in', `(${occupiedTrayIds.join(',')})`);
    }
    const { data: trays, error: trayErr } = await trayQuery;
    if (trayErr) throw trayErr;

    return {
      implantLots: (lots ?? []).map((l) => {
        const imp = Array.isArray(l.implants) ? l.implants[0] : l.implants;
        return {
          id: l.id,
          label: `${imp?.name ?? '?'} · Lote ${l.lot_number}`,
          detail: `Cant: ${l.current_quantity} · ${imp?.sku ?? ''}`,
        };
      }),
      trays: (trays ?? []).map(t => ({
        id: t.id,
        label: t.name,
        detail: `${t.code ?? ''} · ${t.status}`,
        is_support_tray: t.is_support_tray ?? false,
      })),
    };
  },
};
