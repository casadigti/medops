import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Pencil, Trash2, Search, Warehouse, LayoutGrid, Map, Settings2, RotateCcw, X, Table2, Monitor, Minus, Square, DoorOpen } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { PageLoader, EmptyState } from '../components/ui/Spinner';
import { useToast } from '../components/ui/Toast';
import { cn } from '../utils/cn';
import { storageService, cellLabel } from '../services/storageService';
import { configService } from '../services/configService';
import { roomObjectService } from '../services/roomObjectService';
import type { StorageShelf, StorageSlot, AvailableItems, UserProfile, RoomObject, RoomObjectType } from '../types/domain';

// ─── Constants ────────────────────────────────────────────────────────────────
const PRESET_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const CELL_PX = 50;       // pixels per room unit in floor plan
const CARD_CELL_PX = 52;  // fixed cell size in cards view

const ROOM_OBJECT_DEFS: Record<RoomObjectType, { label: string; color: string; w: number; h: number; Icon: React.FC<{ size?: number; style?: React.CSSProperties; className?: string }> }> = {
  table:  { label: 'Mesa',       color: '#d97706', w: 4, h: 3, Icon: Table2 },
  desk:   { label: 'Escritorio', color: '#64748b', w: 2, h: 2, Icon: Monitor },
  wall:   { label: 'Pared',      color: '#374151', w: 8, h: 1, Icon: Minus },
  column: { label: 'Columna',    color: '#6b7280', w: 1, h: 1, Icon: Square },
  door:   { label: 'Puerta',     color: '#0ea5e9', w: 2, h: 1, Icon: DoorOpen },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getFootprint(shelf: StorageShelf) {
  const isVertical = shelf.facing === 'left' || shelf.facing === 'right';
  return isVertical
    ? { w: shelf.rows, h: shelf.cols }
    : { w: shelf.cols, h: shelf.rows };
}

function hasCollision(
  shelves: StorageShelf[],
  excludeId: string,
  x: number,
  y: number,
  w: number,
  h: number
): boolean {
  return shelves
    .filter(s => s.id !== excludeId && s.position_x != null && s.position_y != null)
    .some(s => {
      const fp = getFootprint(s);
      return (
        x < s.position_x! + fp.w &&
        x + w > s.position_x! &&
        y < s.position_y! + fp.h &&
        y + h > s.position_y!
      );
    });
}

function fitsInRoom(x: number, y: number, w: number, h: number, rw: number, rh: number): boolean {
  return x >= 0 && y >= 0 && x + w <= rw && y + h <= rh;
}

// ─── SlotCell ─────────────────────────────────────────────────────────────────
interface SlotCellProps {
  slot: StorageSlot;
  onClick: () => void;
  highlighted?: boolean;
}

const SlotCell: React.FC<SlotCellProps> = ({ slot, onClick, highlighted }) => {
  const isEmpty = !slot.item_id;
  const firstName = slot.item_label?.split('·')[0].trim();

  return (
    <div className="relative">
      {highlighted && (
        <span className="absolute inset-0 rounded-lg ring-4 ring-yellow-400 animate-ping opacity-75 pointer-events-none" />
      )}
      <button
        onClick={onClick}
        title={slot.item_label ?? cellLabel(slot.row_index, slot.col_index)}
        className={cn(
          'w-full h-full rounded-lg flex flex-col items-center justify-center p-1 transition-all',
          'border-2 hover:scale-105 hover:z-10 relative text-[10px] font-bold',
          highlighted
            ? 'border-yellow-400 bg-yellow-100 text-yellow-800 scale-110 z-20 shadow-md shadow-yellow-200'
            : isEmpty
            ? 'border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-primary hover:text-primary'
            : slot.item_type === 'implant_lot'
            ? 'border-blue-300 bg-blue-50 text-blue-700 hover:border-blue-500'
            : slot.is_support_tray
            ? 'border-purple-300 bg-purple-50 text-purple-700 hover:border-purple-500'
            : 'border-green-300 bg-green-50 text-green-700 hover:border-green-500'
        )}
      >
        <span>{cellLabel(slot.row_index, slot.col_index)}</span>
        {!isEmpty && firstName && (
          <span className="truncate w-full text-center leading-tight mt-0.5 text-[9px] opacity-80 px-0.5">
            {firstName}
          </span>
        )}
      </button>
    </div>
  );
};

// ─── ShelfGrid ────────────────────────────────────────────────────────────────
interface ShelfGridProps {
  shelf: StorageShelf;
  onSlotClick: (slot: StorageSlot) => void;
  highlightedIds: Set<string>;
}

const ShelfGrid: React.FC<ShelfGridProps> = ({ shelf, onSlotClick, highlightedIds }) => {
  const matrix: (StorageSlot | undefined)[][] = Array.from({ length: shelf.rows }, (_, r) =>
    Array.from({ length: shelf.cols }, (_, c) =>
      shelf.slots?.find(s => s.row_index === r && s.col_index === c)
    )
  );

  return (
    <div
      className="grid gap-1 p-2"
      style={{
        gridTemplateColumns: `repeat(${shelf.cols}, ${CARD_CELL_PX}px)`,
        gridTemplateRows: `repeat(${shelf.rows}, ${CARD_CELL_PX}px)`,
      }}
    >
      {matrix.flat().map((slot, i) =>
        slot ? (
          <SlotCell
            key={slot.id}
            slot={slot}
            onClick={() => onSlotClick(slot)}
            highlighted={highlightedIds.has(slot.id)}
          />
        ) : (
          <div key={i} className="aspect-square bg-slate-100 rounded-lg opacity-40" />
        )
      )}
    </div>
  );
};

// ─── ShelfCard ────────────────────────────────────────────────────────────────
interface ShelfCardProps {
  shelf: StorageShelf;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSlotClick: (slot: StorageSlot) => void;
  highlightedIds: Set<string>;
  className?: string;
}

const ShelfCard: React.FC<ShelfCardProps> = ({ shelf, isAdmin, onEdit, onDelete, onSlotClick, highlightedIds, className }) => {
  const occupied = shelf.slots?.filter(s => s.item_id).length ?? 0;
  const total = shelf.rows * shelf.cols;

  return (
    <div className={cn('card overflow-hidden', className)}>
      <div className="h-1.5 w-full" style={{ backgroundColor: shelf.color }} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h3 className="font-bold text-slate-900">{shelf.name}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {shelf.rows} fila{shelf.rows !== 1 ? 's' : ''} × {shelf.cols} col ·{' '}
              <span className={occupied === total ? 'text-red-500 font-semibold' : ''}>
                {occupied}/{total} ocupados
              </span>
            </p>
            {shelf.description && (
              <p className="text-xs text-slate-400 mt-0.5 italic">{shelf.description}</p>
            )}
          </div>
          {isAdmin && (
            <div className="flex gap-1 shrink-0">
              <button
                onClick={onEdit}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-primary transition-colors"
                title="Editar estantería"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={onDelete}
                className="p-1.5 hover:bg-red-50 rounded-lg text-slate-500 hover:text-red-500 transition-colors"
                title="Eliminar estantería"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
        <ShelfGrid shelf={shelf} onSlotClick={onSlotClick} highlightedIds={highlightedIds} />
      </div>
    </div>
  );
};

// ─── ShelfFormModal ───────────────────────────────────────────────────────────
interface ShelfFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initial: StorageShelf | null;
  onSaved: () => void;
}

const ShelfFormModal: React.FC<ShelfFormModalProps> = ({ isOpen, onClose, initial, onSaved }) => {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    orientation: 'horizontal' as 'horizontal' | 'vertical',
    rows: 3,
    cols: 5,
    color: '#6366f1',
    description: '',
  });

  useEffect(() => {
    if (!isOpen) return;
    setForm({
      name:        initial?.name        ?? '',
      orientation: initial?.orientation ?? 'horizontal',
      rows:        initial?.rows        ?? 3,
      cols:        initial?.cols        ?? 5,
      color:       initial?.color       ?? '#6366f1',
      description: initial?.description ?? '',
    });
  }, [isOpen, initial]);

  const isEdit = !!initial;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await storageService.updateShelf(initial!.id, {
          name: form.name,
          color: form.color,
          description: form.description || undefined,
          orientation: form.orientation,
        });
        toast.success('Estantería actualizada');
      } else {
        await storageService.createShelf({ ...form, description: form.description || undefined });
        toast.success('Estantería creada');
      }
      onSaved();
      onClose();
    } catch {
      toast.error('Error guardando estantería');
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Editar Estantería' : 'Nueva Estantería'} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Nombre *</label>
          <input required className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Estantería A" />
        </div>
        <div>
          <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Orientación</label>
          <select className="input" value={form.orientation} onChange={e => set('orientation', e.target.value as 'horizontal' | 'vertical')}>
            <option value="horizontal">Horizontal</option>
            <option value="vertical">Vertical</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Filas (1–10)</label>
            <input type="number" min={1} max={10} required className="input" disabled={isEdit}
              value={form.rows} onChange={e => set('rows', Math.max(1, Math.min(10, +e.target.value)))} />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Columnas (1–20)</label>
            <input type="number" min={1} max={20} required className="input" disabled={isEdit}
              value={form.cols} onChange={e => set('cols', Math.max(1, Math.min(20, +e.target.value)))} />
          </div>
        </div>
        {isEdit && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Las dimensiones no se pueden cambiar. Para modificarlas, elimina y crea una nueva.
          </p>
        )}
        <div>
          <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Color</label>
          <div className="flex gap-2">
            {PRESET_COLORS.map(c => (
              <button key={c} type="button" onClick={() => set('color', c)}
                className={cn('w-7 h-7 rounded-full border-2 transition-transform hover:scale-110', form.color === c ? 'border-slate-800 scale-110' : 'border-transparent')}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Descripción (opcional)</label>
          <input className="input" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Ej: Implantes de cadera" />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={saving} className="btn btn-primary flex-1">
            {saving ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Crear Estantería'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// ─── SlotAssignModal ──────────────────────────────────────────────────────────
interface SlotAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot: StorageSlot | null;
  isAdmin: boolean;
  onSaved: () => void;
}

const SlotAssignModal: React.FC<SlotAssignModalProps> = ({ isOpen, onClose, slot, isAdmin, onSaved }) => {
  const toast = useToast();
  const [tab, setTab] = useState<'implant_lot' | 'tray'>('implant_lot');
  const [search, setSearch] = useState('');
  const [available, setAvailable] = useState<AvailableItems>({ implantLots: [], trays: [] });
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEmpty = !slot?.item_id;

  useEffect(() => {
    if (!isOpen || !isEmpty || !isAdmin) return;
    setLoadingItems(true);
    storageService.getAvailableItems()
      .then(setAvailable)
      .catch(() => toast.error('Error cargando ítems disponibles'))
      .finally(() => setLoadingItems(false));
  }, [isOpen, isEmpty, isAdmin]);

  useEffect(() => { if (isOpen) setSearch(''); }, [isOpen]);

  const items = tab === 'implant_lot'
    ? available.implantLots.filter(i => i.label.toLowerCase().includes(search.toLowerCase()) || i.detail.toLowerCase().includes(search.toLowerCase()))
    : available.trays.filter(i => i.label.toLowerCase().includes(search.toLowerCase()) || i.detail.toLowerCase().includes(search.toLowerCase()));

  const handleAssign = async (itemId: string) => {
    if (!slot) return;
    setSaving(true);
    try {
      await storageService.assignSlot(slot.id, tab, itemId);
      toast.success('Ítem asignado a la celda');
      onSaved(); onClose();
    } catch { toast.error('Error asignando ítem'); }
    finally { setSaving(false); }
  };

  const handleClear = async () => {
    if (!slot) return;
    setSaving(true);
    try {
      await storageService.clearSlot(slot.id);
      toast.success('Celda liberada');
      onSaved(); onClose();
    } catch { toast.error('Error liberando celda'); }
    finally { setSaving(false); }
  };

  if (!slot) return null;
  const slotLabelText = cellLabel(slot.row_index, slot.col_index);
  const title = isEmpty ? `Asignar ítem — Celda ${slotLabelText}` : `Celda ${slotLabelText}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      {!isEmpty ? (
        <div className="space-y-4">
          <div className={cn('p-4 rounded-xl border-2', slot.item_type === 'implant_lot' ? 'border-blue-200 bg-blue-50' : 'border-green-200 bg-green-50')}>
            <p className="text-xs font-bold uppercase tracking-wider mb-1 opacity-60">
              {slot.item_type === 'implant_lot' ? 'Lote de Implante' : 'Bandeja'}
            </p>
            <p className="font-bold text-slate-800">{slot.item_label}</p>
            <p className="text-sm text-slate-500 mt-0.5">{slot.item_detail}</p>
            {slot.notes && <p className="text-xs text-slate-400 mt-1 italic">{slot.notes}</p>}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn btn-secondary flex-1">Cerrar</button>
            {isAdmin && (
              <button onClick={handleClear} disabled={saving} className="btn flex-1 bg-red-500 text-white hover:bg-red-600">
                {saving ? 'Liberando...' : 'Desasignar'}
              </button>
            )}
          </div>
        </div>
      ) : isAdmin ? (
        <div className="space-y-4">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            {(['implant_lot', 'tray'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={cn('flex-1 py-2 rounded-lg text-sm font-semibold transition-all', tab === t ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                {t === 'implant_lot' ? 'Implantes' : 'Bandejas'}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input !pl-10" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {loadingItems ? (
              <p className="text-center text-slate-400 py-8 text-sm">Cargando...</p>
            ) : items.length === 0 ? (
              <p className="text-center text-slate-400 py-8 text-sm">{search ? 'Sin resultados' : 'No hay ítems disponibles sin asignar'}</p>
            ) : items.map(item => (
              <button key={item.id} onClick={() => handleAssign(item.id)} disabled={saving}
                className="w-full text-left p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all disabled:opacity-50">
                <p className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                  {item.label}
                  {!!(item as { is_support_tray?: boolean }).is_support_tray && (
                    <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">Apoyo</span>
                  )}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{item.detail}</p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-6 space-y-3">
          <p className="text-slate-500 text-sm">Esta celda está vacía.</p>
          <button onClick={onClose} className="btn btn-secondary">Cerrar</button>
        </div>
      )}
    </Modal>
  );
};

// ─── RoomConfigModal ──────────────────────────────────────────────────────────
interface RoomConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomWidth: number;
  roomHeight: number;
  onSaved: (w: number, h: number) => void;
}

const RoomConfigModal: React.FC<RoomConfigModalProps> = ({ isOpen, onClose, roomWidth, roomHeight, onSaved }) => {
  const toast = useToast();
  const [w, setW] = useState(roomWidth);
  const [h, setH] = useState(roomHeight);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (isOpen) { setW(roomWidth); setH(roomHeight); } }, [isOpen, roomWidth, roomHeight]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await configService.saveRoomConfig(w, h);
      toast.success('Dimensiones de sala guardadas');
      onSaved(w, h);
      onClose();
    } catch { toast.error('Error guardando configuración de sala'); }
    finally { setSaving(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configurar Sala" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">Define las dimensiones del almacén físico. 1 unidad = tamaño de 1 celda de estantería.</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Ancho (unidades)</label>
            <input type="number" min={5} max={100} className="input" value={w} onChange={e => setW(Math.max(5, Math.min(100, +e.target.value)))} />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Alto (unidades)</label>
            <input type="number" min={5} max={100} className="input" value={h} onChange={e => setH(Math.max(5, Math.min(100, +e.target.value)))} />
          </div>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-500">
          Sala: {w} × {h} unidades = {(w * CELL_PX / 100).toFixed(1)}m × {(h * CELL_PX / 100).toFixed(1)}m aprox.
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="btn btn-secondary flex-1">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary flex-1">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ─── FloorPlanCanvas ──────────────────────────────────────────────────────────
interface FloorPlanCanvasProps {
  shelves: StorageShelf[];
  roomObjects: RoomObject[];
  isAdmin: boolean;
  roomWidth: number;
  roomHeight: number;
  onShelfMoved: (shelfId: string, x: number, y: number) => void;
  onRotate: (shelf: StorageShelf) => void;
  onRemoveFromMap: (shelfId: string) => void;
  onSlotClick: (slot: StorageSlot) => void;
  onObjectCreated: (type: RoomObjectType, x: number, y: number, w: number, h: number, color: string) => void;
  onObjectMoved: (id: string, x: number, y: number) => void;
  onObjectDelete: (id: string) => void;
}

const FloorPlanCanvas: React.FC<FloorPlanCanvasProps> = ({
  shelves, roomObjects, isAdmin, roomWidth, roomHeight,
  onShelfMoved, onRotate, onRemoveFromMap, onSlotClick,
  onObjectCreated, onObjectMoved, onObjectDelete,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragShelfIdRef = useRef<string | null>(null);
  const dragObjectIdRef = useRef<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [dropPreview, setDropPreview] = useState<{ x: number; y: number; w: number; h: number; valid: boolean } | null>(null);
  const [hoveredShelfId, setHoveredShelfId] = useState<string | null>(null);
  const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null);

  const placed = shelves.filter(s => s.position_x != null && s.position_y != null);

  const handleDragStart = (e: React.DragEvent, shelf: StorageShelf) => {
    dragShelfIdRef.current = shelf.id;
    // Calculate offset from shelf origin to mouse position
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragOffsetRef.current = {
      x: Math.floor((e.clientX - rect.left) / CELL_PX),
      y: Math.floor((e.clientY - rect.top) / CELL_PX),
    };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('shelfId', shelf.id);
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();

    if (dragShelfIdRef.current) {
      const shelf = shelves.find(s => s.id === dragShelfIdRef.current);
      if (!shelf) return;
      const fp = getFootprint(shelf);
      const rawX = Math.floor((e.clientX - rect.left) / CELL_PX) - dragOffsetRef.current.x;
      const rawY = Math.floor((e.clientY - rect.top) / CELL_PX) - dragOffsetRef.current.y;
      const x = Math.max(0, Math.min(rawX, roomWidth - fp.w));
      const y = Math.max(0, Math.min(rawY, roomHeight - fp.h));
      const valid = fitsInRoom(x, y, fp.w, fp.h, roomWidth, roomHeight) && !hasCollision(shelves, dragShelfIdRef.current, x, y, fp.w, fp.h);
      setDropPreview({ x, y, w: fp.w, h: fp.h, valid });
      e.dataTransfer.dropEffect = valid ? 'move' : 'none';
      return;
    }

    // Room object (new from palette or existing)
    const objType = e.dataTransfer.types.includes('roomobjecttype') ? e.dataTransfer.getData('roomObjectType') as RoomObjectType : null;
    const objId = dragObjectIdRef.current;
    if (objType || objId) {
      const w = objType ? ROOM_OBJECT_DEFS[objType].w : (roomObjects.find(o => o.id === objId)?.width ?? 2);
      const h = objType ? ROOM_OBJECT_DEFS[objType].h : (roomObjects.find(o => o.id === objId)?.height ?? 2);
      const rawX = Math.floor((e.clientX - rect.left) / CELL_PX) - dragOffsetRef.current.x;
      const rawY = Math.floor((e.clientY - rect.top) / CELL_PX) - dragOffsetRef.current.y;
      const x = Math.max(0, Math.min(rawX, roomWidth - w));
      const y = Math.max(0, Math.min(rawY, roomHeight - h));
      setDropPreview({ x, y, w, h, valid: fitsInRoom(x, y, w, h, roomWidth, roomHeight) });
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!canvasRef.current) { setDropPreview(null); return; }
    const rect = canvasRef.current.getBoundingClientRect();

    // Shelf drop
    const shelfId = e.dataTransfer.getData('shelfId');
    if (shelfId) {
      const shelf = shelves.find(s => s.id === shelfId);
      if (shelf) {
        const fp = getFootprint(shelf);
        const rawX = Math.floor((e.clientX - rect.left) / CELL_PX) - dragOffsetRef.current.x;
        const rawY = Math.floor((e.clientY - rect.top) / CELL_PX) - dragOffsetRef.current.y;
        const x = Math.max(0, Math.min(rawX, roomWidth - fp.w));
        const y = Math.max(0, Math.min(rawY, roomHeight - fp.h));
        if (fitsInRoom(x, y, fp.w, fp.h, roomWidth, roomHeight) && !hasCollision(shelves, shelfId, x, y, fp.w, fp.h)) {
          onShelfMoved(shelfId, x, y);
        }
      }
      dragShelfIdRef.current = null;
      setDropPreview(null);
      return;
    }

    // New room object from palette
    const objType = e.dataTransfer.getData('roomObjectType') as RoomObjectType | '';
    if (objType && objType in ROOM_OBJECT_DEFS) {
      const def = ROOM_OBJECT_DEFS[objType];
      const rawX = Math.floor((e.clientX - rect.left) / CELL_PX) - Math.floor(def.w / 2);
      const rawY = Math.floor((e.clientY - rect.top)  / CELL_PX) - Math.floor(def.h / 2);
      const x = Math.max(0, Math.min(rawX, roomWidth  - def.w));
      const y = Math.max(0, Math.min(rawY, roomHeight - def.h));
      onObjectCreated(objType, x, y, def.w, def.h, def.color);
      setDropPreview(null);
      return;
    }

    // Existing room object move
    const objId = dragObjectIdRef.current;
    if (objId) {
      const obj = roomObjects.find(o => o.id === objId);
      if (obj) {
        const rawX = Math.floor((e.clientX - rect.left) / CELL_PX) - dragOffsetRef.current.x;
        const rawY = Math.floor((e.clientY - rect.top)  / CELL_PX) - dragOffsetRef.current.y;
        const x = Math.max(0, Math.min(rawX, roomWidth  - obj.width));
        const y = Math.max(0, Math.min(rawY, roomHeight - obj.height));
        onObjectMoved(objId, x, y);
      }
      dragObjectIdRef.current = null;
    }
    setDropPreview(null);
  };

  return (
    <div
      ref={canvasRef}
      className="relative border-2 border-slate-300 rounded-xl overflow-auto bg-slate-50"
      style={{
        width: roomWidth * CELL_PX,
        maxWidth: '100%',
        height: roomHeight * CELL_PX,
      }}
      onDragOver={handleCanvasDragOver}
      onDrop={handleCanvasDrop}
      onDragLeave={() => setDropPreview(null)}
    >
      {/* Grid lines */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width={roomWidth * CELL_PX}
        height={roomHeight * CELL_PX}
      >
        {Array.from({ length: roomWidth + 1 }, (_, i) => (
          <line key={`v${i}`} x1={i * CELL_PX} y1={0} x2={i * CELL_PX} y2={roomHeight * CELL_PX}
            stroke="#e2e8f0" strokeWidth={1} />
        ))}
        {Array.from({ length: roomHeight + 1 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={i * CELL_PX} x2={roomWidth * CELL_PX} y2={i * CELL_PX}
            stroke="#e2e8f0" strokeWidth={1} />
        ))}
      </svg>

      {/* Drop preview */}
      {dropPreview && (
        <div
          className={cn(
            'absolute rounded-lg border-2 border-dashed pointer-events-none z-10 transition-colors',
            dropPreview.valid ? 'border-primary bg-primary/10' : 'border-red-400 bg-red-50/50'
          )}
          style={{
            left: dropPreview.x * CELL_PX + 2,
            top: dropPreview.y * CELL_PX + 2,
            width: dropPreview.w * CELL_PX - 4,
            height: dropPreview.h * CELL_PX - 4,
          }}
        />
      )}

      {/* Placed shelves */}
      {placed.map(shelf => {
        const fp = getFootprint(shelf);
        const occupied = shelf.slots?.filter(s => s.item_id).length ?? 0;
        const total = shelf.rows * shelf.cols;
        const isHovered = hoveredShelfId === shelf.id;

        return (
          <div
            key={shelf.id}
            className={cn(
              'absolute rounded-lg overflow-hidden transition-shadow cursor-grab active:cursor-grabbing',
              isHovered ? 'shadow-lg z-20' : 'shadow-sm'
            )}
            style={{
              left: shelf.position_x! * CELL_PX + 1,
              top: shelf.position_y! * CELL_PX + 1,
              width: fp.w * CELL_PX - 2,
              height: fp.h * CELL_PX - 2,
              backgroundColor: 'white',
              // Thick colored border on back/wall side, thin on rest
              borderStyle: 'solid',
              borderTopWidth:    shelf.facing === 'bottom' ? 5 : 2,
              borderRightWidth:  shelf.facing === 'left'   ? 5 : 2,
              borderBottomWidth: shelf.facing === 'top'    ? 5 : 2,
              borderLeftWidth:   shelf.facing === 'right'  ? 5 : 2,
              borderTopColor:    shelf.facing === 'bottom' ? shelf.color : (isHovered ? '#94a3b8' : '#cbd5e1'),
              borderRightColor:  shelf.facing === 'left'   ? shelf.color : (isHovered ? '#94a3b8' : '#cbd5e1'),
              borderBottomColor: shelf.facing === 'top'    ? shelf.color : (isHovered ? '#94a3b8' : '#cbd5e1'),
              borderLeftColor:   shelf.facing === 'right'  ? shelf.color : (isHovered ? '#94a3b8' : '#cbd5e1'),
            }}
            draggable={isAdmin}
            onDragStart={e => handleDragStart(e, shelf)}
            onMouseEnter={() => setHoveredShelfId(shelf.id)}
            onMouseLeave={() => setHoveredShelfId(null)}
          >
            {/* Color bar */}
            <div className="h-1.5 w-full shrink-0" style={{ backgroundColor: shelf.color }} />

            {/* Content */}
            <div className="p-1 h-[calc(100%-6px)] flex flex-col overflow-hidden">
              {/* Header row */}
              <div className="flex items-start justify-between gap-0.5 mb-0.5">
                <div className="min-w-0">
                  <p
                    className="text-[10px] font-bold text-slate-800 truncate leading-tight"
                    style={
                      shelf.facing === 'right' ? { writingMode: 'vertical-rl', transform: 'rotate(180deg)' } :
                      shelf.facing === 'left'  ? { writingMode: 'vertical-rl' } :
                      undefined
                    }
                  >{shelf.name}</p>
                  <p className="text-[8px] text-slate-400 leading-tight">{occupied}/{total}</p>
                </div>
                {isAdmin && (
                  <div className={cn('flex gap-0.5 shrink-0 transition-opacity', isHovered ? 'opacity-100' : 'opacity-0')}>
                    <button
                      title="Rotar estantería"
                      onClick={e => { e.stopPropagation(); onRotate(shelf); }}
                      className="p-0.5 rounded hover:bg-slate-100 text-slate-500 hover:text-primary transition-colors"
                    >
                      <RotateCcw size={10} />
                    </button>
                    <button
                      title="Quitar del mapa"
                      onClick={e => { e.stopPropagation(); onRemoveFromMap(shelf.id); }}
                      className="p-0.5 rounded hover:bg-red-50 text-slate-500 hover:text-red-500 transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </div>
                )}
              </div>

              {/* Mini slot grid — respects orientation */}
              <div
                className="flex-1 grid gap-px overflow-hidden"
                style={{ gridTemplateColumns: `repeat(${fp.w}, 1fr)`, gridTemplateRows: `repeat(${fp.h}, 1fr)` }}
              >
                {Array.from({ length: fp.h }, (_, vr) =>
                  Array.from({ length: fp.w }, (_, vc) => {
                    // Map visual position → actual (row_index, col_index) based on orientation
                    const r = shelf.orientation === 'horizontal' ? vr : vc;
                    const c = shelf.orientation === 'horizontal' ? vc : vr;
                    const slot = shelf.slots?.find(s => s.row_index === r && s.col_index === c);
                    const bg = !slot?.item_id ? 'bg-slate-100'
                      : slot.item_type === 'implant_lot' ? 'bg-blue-200'
                      : slot.is_support_tray ? 'bg-purple-200'
                      : 'bg-green-200';
                    return (
                      <div
                        key={`${vr}-${vc}`}
                        title={slot?.item_label ?? cellLabel(r, c)}
                        className={cn('rounded-sm cursor-pointer hover:opacity-80 transition-opacity', bg)}
                        onClick={() => slot && onSlotClick(slot)}
                      />
                    );
                  })
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Room objects */}
      {roomObjects.map(obj => {
        const def = ROOM_OBJECT_DEFS[obj.type];
        const isObjHovered = hoveredObjectId === obj.id;
        return (
          <div
            key={obj.id}
            className={cn('absolute rounded overflow-hidden transition-shadow select-none', isAdmin ? 'cursor-grab active:cursor-grabbing' : 'cursor-default', isObjHovered ? 'shadow-md z-10' : 'shadow-sm')}
            style={{
              left: obj.position_x * CELL_PX + 1,
              top:  obj.position_y * CELL_PX + 1,
              width:  obj.width  * CELL_PX - 2,
              height: obj.height * CELL_PX - 2,
              backgroundColor: obj.color + '22',
              border: `2px solid ${obj.color}`,
            }}
            draggable={isAdmin}
            onDragStart={e => {
              dragObjectIdRef.current = obj.id;
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              dragOffsetRef.current = { x: Math.floor((e.clientX - rect.left) / CELL_PX), y: Math.floor((e.clientY - rect.top) / CELL_PX) };
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('roomObjectId', obj.id);
            }}
            onMouseEnter={() => setHoveredObjectId(obj.id)}
            onMouseLeave={() => setHoveredObjectId(null)}
          >
            <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 p-1">
              <def.Icon size={Math.min(16, (obj.width * CELL_PX) / 3)} style={{ color: obj.color }} />
              <span className="text-[9px] font-bold truncate w-full text-center leading-tight" style={{ color: obj.color }}>
                {obj.label ?? def.label}
              </span>
            </div>
            {isAdmin && isObjHovered && (
              <button
                title="Eliminar"
                onClick={e => { e.stopPropagation(); onObjectDelete(obj.id); }}
                className="absolute top-0.5 right-0.5 p-0.5 rounded bg-white/80 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
              >
                <X size={8} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── RoomObjectPalette ────────────────────────────────────────────────────────
interface RoomObjectPaletteProps { isAdmin: boolean }

const RoomObjectPalette: React.FC<RoomObjectPaletteProps> = ({ isAdmin }) => {
  if (!isAdmin) return null;
  return (
    <div className="w-48 shrink-0">
      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Objetos</p>
      <div className="space-y-2">
        {(Object.entries(ROOM_OBJECT_DEFS) as [RoomObjectType, typeof ROOM_OBJECT_DEFS[RoomObjectType]][]).map(([type, def]) => (
          <div
            key={type}
            draggable
            onDragStart={e => {
              e.dataTransfer.effectAllowed = 'copy';
              e.dataTransfer.setData('roomObjectType', type);
            }}
            className="card p-2 flex items-center gap-2 cursor-grab active:cursor-grabbing hover:shadow-md select-none"
            title={`Arrastra para agregar ${def.label}`}
          >
            <def.Icon size={14} style={{ color: def.color, flexShrink: 0 }} />
            <div>
              <p className="text-xs font-bold text-slate-800">{def.label}</p>
              <p className="text-[10px] text-slate-400">{def.w}×{def.h} un.</p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-slate-400 mt-2 italic">Arrastra al mapa →</p>
    </div>
  );
};

// ─── UnplacedPanel ────────────────────────────────────────────────────────────
interface UnplacedPanelProps {
  shelves: StorageShelf[];
  isAdmin: boolean;
}

const UnplacedPanel: React.FC<UnplacedPanelProps> = ({ shelves, isAdmin }) => {
  const unplaced = shelves.filter(s => s.position_x == null || s.position_y == null);
  if (unplaced.length === 0) return null;

  return (
    <div className="w-48 shrink-0">
      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Sin colocar</p>
      <div className="space-y-2">
        {unplaced.map(shelf => {
          const fp = getFootprint(shelf);
          const occupied = shelf.slots?.filter(s => s.item_id).length ?? 0;
          const total = shelf.rows * shelf.cols;
          return (
            <div
              key={shelf.id}
              draggable={isAdmin}
              onDragStart={e => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('shelfId', shelf.id);
              }}
              className={cn(
                'card p-2 overflow-hidden select-none',
                isAdmin ? 'cursor-grab active:cursor-grabbing hover:shadow-md' : 'cursor-default'
              )}
              title={isAdmin ? 'Arrastra al mapa para colocar' : shelf.name}
            >
              <div className="h-1 w-full mb-1 rounded" style={{ backgroundColor: shelf.color }} />
              <p className="text-xs font-bold text-slate-800 truncate">{shelf.name}</p>
              <p className="text-[10px] text-slate-400">{fp.w}×{fp.h} · {occupied}/{total}</p>
            </div>
          );
        })}
      </div>
      {isAdmin && (
        <p className="text-[10px] text-slate-400 mt-2 italic">Arrastra al mapa →</p>
      )}
    </div>
  );
};

// ─── AlmacenMap (página principal) ───────────────────────────────────────────
interface AlmacenMapProps {
  userProfile: UserProfile | null;
}

export const AlmacenMap: React.FC<AlmacenMapProps> = ({ userProfile }) => {
  const toast = useToast();
  const [shelves, setShelves] = useState<StorageShelf[]>([]);
  const [roomObjects, setRoomObjects] = useState<RoomObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'cards' | 'floorplan'>('cards');
  const [roomConfig, setRoomConfig] = useState({ room_width: 30, room_height: 20 });
  const [shelfModal, setShelfModal] = useState<{ open: boolean; shelf: StorageShelf | null }>({ open: false, shelf: null });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [slotModal, setSlotModal] = useState<{ open: boolean; slot: StorageSlot | null }>({ open: false, slot: null });
  const [roomConfigModal, setRoomConfigModal] = useState(false);

  const isAdmin = userProfile?.role === 'Administrador' || userProfile?.role === 'Superadmin';

  const [mapSearch, setMapSearch] = useState('');

  const highlightedIds = React.useMemo((): Set<string> => {
    const q = mapSearch.trim().toLowerCase();
    if (q.length < 2) return new Set();
    const ids = new Set<string>();
    for (const shelf of shelves) {
      for (const slot of (shelf.slots ?? [])) {
        if (slot.item_id && (slot.item_label?.toLowerCase().includes(q) || slot.item_detail?.toLowerCase().includes(q))) {
          ids.add(slot.id);
        }
      }
    }
    return ids;
  }, [mapSearch, shelves]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [shelvesData, cfg, objects] = await Promise.all([
        storageService.getShelves(),
        configService.getRoomConfig(),
        roomObjectService.getAll(),
      ]);
      setShelves(shelvesData);
      setRoomConfig(cfg);
      setRoomObjects(objects);
    } catch {
      toast.error('Error cargando mapa de almacén');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await storageService.deleteShelf(deleteTarget);
      toast.success('Estantería eliminada');
      load();
    } catch { toast.error('Error eliminando estantería'); }
    finally { setDeleteTarget(null); }
  };

  const handleShelfMoved = async (shelfId: string, x: number, y: number) => {
    // Optimistic update
    setShelves(prev => prev.map(s => s.id === shelfId ? { ...s, position_x: x, position_y: y } : s));
    try {
      await storageService.updateShelfPosition(shelfId, x, y);
    } catch {
      toast.error('Error guardando posición');
      load();
    }
  };

  const handleRotate = async (shelf: StorageShelf) => {
    const cycle: Record<string, import('../types/domain').ShelfFacing> = { bottom: 'right', right: 'top', top: 'left', left: 'bottom' };
    const newFacing = cycle[shelf.facing ?? 'bottom'];
    const isVertical = newFacing === 'left' || newFacing === 'right';
    const newW = isVertical ? shelf.rows : shelf.cols;
    const newH = isVertical ? shelf.cols : shelf.rows;
    if (shelf.position_x != null && shelf.position_y != null) {
      if (!fitsInRoom(shelf.position_x, shelf.position_y, newW, newH, roomConfig.room_width, roomConfig.room_height)) {
        toast.error('La rotación no cabe en la posición actual'); return;
      }
      if (hasCollision(shelves, shelf.id, shelf.position_x, shelf.position_y, newW, newH)) {
        toast.error('Hay colisión con otra estantería al rotar'); return;
      }
    }
    const newOrientation = isVertical ? 'vertical' : 'horizontal';
    setShelves(prev => prev.map(s => s.id === shelf.id ? { ...s, facing: newFacing, orientation: newOrientation } : s));
    try {
      await storageService.rotateShelf(shelf.id, shelf.facing ?? 'bottom');
    } catch {
      toast.error('Error rotando estantería');
      load();
    }
  };

  const handleRemoveFromMap = async (shelfId: string) => {
    setShelves(prev => prev.map(s => s.id === shelfId ? { ...s, position_x: null, position_y: null } : s));
    try {
      await storageService.updateShelfPosition(shelfId, null, null);
    } catch {
      toast.error('Error quitando estantería del mapa');
      load();
    }
  };

  const handleObjectCreated = async (type: RoomObjectType, x: number, y: number, w: number, h: number, color: string) => {
    try {
      const obj = await roomObjectService.create({ type, position_x: x, position_y: y, width: w, height: h, color });
      setRoomObjects(prev => [...prev, obj]);
    } catch { toast.error('Error creando objeto'); }
  };

  const handleObjectMoved = async (id: string, x: number, y: number) => {
    setRoomObjects(prev => prev.map(o => o.id === id ? { ...o, position_x: x, position_y: y } : o));
    try {
      await roomObjectService.updatePosition(id, x, y);
    } catch { toast.error('Error moviendo objeto'); load(); }
  };

  const handleObjectDelete = async (id: string) => {
    setRoomObjects(prev => prev.filter(o => o.id !== id));
    try {
      await roomObjectService.delete(id);
    } catch { toast.error('Error eliminando objeto'); load(); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mapa de Almacén</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {shelves.length} {shelves.length === 1 ? 'estantería' : 'estanterías'}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* View toggle */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setView('cards')}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all',
                view === 'cards' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700')}
            >
              <LayoutGrid size={14} /> Tarjetas
            </button>
            <button
              onClick={() => setView('floorplan')}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all',
                view === 'floorplan' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700')}
            >
              <Map size={14} /> Mapa de Sala
            </button>
          </div>

          {/* Room config (admin + floorplan view) */}
          {isAdmin && view === 'floorplan' && (
            <button
              onClick={() => setRoomConfigModal(true)}
              className="btn btn-secondary flex items-center gap-2 text-sm"
              title={`Sala: ${roomConfig.room_width}×${roomConfig.room_height} unidades`}
            >
              <Settings2 size={16} />
              {roomConfig.room_width}×{roomConfig.room_height}
            </button>
          )}

          {isAdmin && (
            <button onClick={() => setShelfModal({ open: true, shelf: null })} className="btn btn-primary flex items-center gap-2">
              <Plus size={18} /> Nueva Estantería
            </button>
          )}
        </div>
      </div>

      {/* Buscador (solo en vista tarjetas) */}
      {view === 'cards' && (
        <>
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              className="input !pl-10 pr-10"
              placeholder="Buscar producto en el mapa… ej: tornillo 3.5"
              value={mapSearch}
              onChange={e => setMapSearch(e.target.value)}
            />
            {mapSearch && (
              <button onClick={() => setMapSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">✕</button>
            )}
          </div>
          {mapSearch.trim().length >= 2 && (
            <p className={cn('text-sm font-semibold', highlightedIds.size > 0 ? 'text-yellow-700' : 'text-slate-400')}>
              {highlightedIds.size > 0
                ? `${highlightedIds.size} ${highlightedIds.size === 1 ? 'celda encontrada' : 'celdas encontradas'}`
                : 'Sin resultados en el mapa'}
            </p>
          )}

          {/* Leyenda */}
          <div className="flex items-center gap-5 text-xs text-slate-500 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded border-2 border-dashed border-slate-300 bg-slate-50 inline-block" />Vacío
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded border-2 border-blue-300 bg-blue-50 inline-block" />Lote de implante
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded border-2 border-green-300 bg-green-50 inline-block" />Bandeja
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded border-2 border-purple-300 bg-purple-50 inline-block" />Bandeja de apoyo
            </span>
          </div>
        </>
      )}

      {/* Contenido */}
      {loading ? (
        <PageLoader />
      ) : shelves.length === 0 ? (
        <EmptyState
          icon={Warehouse}
          title="Sin estanterías"
          description={isAdmin ? 'Crea tu primera estantería para empezar a mapear el almacén.' : 'Aún no hay estanterías configuradas.'}
          action={isAdmin ? (
            <button onClick={() => setShelfModal({ open: true, shelf: null })} className="btn btn-primary mt-2">
              <Plus size={16} className="inline mr-1" />Nueva Estantería
            </button>
          ) : undefined}
        />
      ) : view === 'cards' ? (
        // ── Vista Tarjetas ──────────────────────────────────────────────────
        <div className="flex flex-wrap gap-4 items-start">
          {shelves.map(shelf => (
            <ShelfCard
              key={shelf.id}
              shelf={shelf}
              isAdmin={isAdmin}
              onEdit={() => setShelfModal({ open: true, shelf })}
              onDelete={() => setDeleteTarget(shelf.id)}
              onSlotClick={slot => setSlotModal({ open: true, slot })}
              highlightedIds={highlightedIds}
            />
          ))}
        </div>
      ) : (
        // ── Vista Mapa de Sala ──────────────────────────────────────────────
        <div className="space-y-3">
          <p className="text-xs text-slate-400 italic">
            {isAdmin ? 'Arrastra las estanterías para posicionarlas en la sala.' : 'Vista del layout físico del almacén.'}
          </p>
          <div className="flex gap-4 items-start overflow-auto">
            <div className="overflow-auto rounded-xl">
              <FloorPlanCanvas
                shelves={shelves}
                roomObjects={roomObjects}
                isAdmin={isAdmin}
                roomWidth={roomConfig.room_width}
                roomHeight={roomConfig.room_height}
                onShelfMoved={handleShelfMoved}
                onRotate={handleRotate}
                onRemoveFromMap={handleRemoveFromMap}
                onSlotClick={slot => setSlotModal({ open: true, slot })}
                onObjectCreated={handleObjectCreated}
                onObjectMoved={handleObjectMoved}
                onObjectDelete={handleObjectDelete}
              />
            </div>
            <div className="flex flex-col gap-4">
              <UnplacedPanel shelves={shelves} isAdmin={isAdmin} />
              <RoomObjectPalette isAdmin={isAdmin} />
            </div>
          </div>
        </div>
      )}

      {/* Modales */}
      <ShelfFormModal
        isOpen={shelfModal.open}
        onClose={() => setShelfModal({ open: false, shelf: null })}
        initial={shelfModal.shelf}
        onSaved={load}
      />

      <SlotAssignModal
        isOpen={slotModal.open}
        onClose={() => setSlotModal({ open: false, slot: null })}
        slot={slotModal.slot}
        isAdmin={isAdmin}
        onSaved={load}
      />

      <RoomConfigModal
        isOpen={roomConfigModal}
        onClose={() => setRoomConfigModal(false)}
        roomWidth={roomConfig.room_width}
        roomHeight={roomConfig.room_height}
        onSaved={(w, h) => setRoomConfig({ room_width: w, room_height: h })}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Eliminar Estantería"
        message="Se eliminarán la estantería y todas sus celdas. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
      />
    </div>
  );
};
