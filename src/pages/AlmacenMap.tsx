import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, Warehouse } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { PageLoader, EmptyState } from '../components/ui/Spinner';
import { useToast } from '../components/ui/Toast';
import { cn } from '../utils/cn';
import { storageService, cellLabel } from '../services/storageService';
import type { StorageShelf, StorageSlot, AvailableItems, UserProfile } from '../types/domain';

// ─── Preset colors for shelf headers ─────────────────────────────────────────
const PRESET_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

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
          'aspect-square w-full rounded-lg flex flex-col items-center justify-center p-1 transition-all',
          'border-2 hover:scale-105 hover:z-10 relative text-[10px] font-bold',
          highlighted
            ? 'border-yellow-400 bg-yellow-100 text-yellow-800 scale-110 z-20 shadow-md shadow-yellow-200'
            : isEmpty
            ? 'border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-primary hover:text-primary'
            : slot.item_type === 'implant_lot'
            ? 'border-blue-300 bg-blue-50 text-blue-700 hover:border-blue-500'
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
      className="grid gap-1.5 p-3"
      style={{ gridTemplateColumns: `repeat(${shelf.cols}, minmax(0, 1fr))` }}
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
}

const ShelfCard: React.FC<ShelfCardProps> = ({ shelf, isAdmin, onEdit, onDelete, onSlotClick, highlightedIds }) => {
  const occupied = shelf.slots?.filter(s => s.item_id).length ?? 0;
  const total = shelf.rows * shelf.cols;

  return (
    <div className="card overflow-hidden">
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
        await storageService.createShelf({
          ...form,
          description: form.description || undefined,
        });
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
          <input
            required
            className="input"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Estantería A"
          />
        </div>

        <div>
          <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Orientación</label>
          <select
            className="input"
            value={form.orientation}
            onChange={e => set('orientation', e.target.value as 'horizontal' | 'vertical')}
          >
            <option value="horizontal">Horizontal</option>
            <option value="vertical">Vertical</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1">
              Filas (1–10)
            </label>
            <input
              type="number" min={1} max={10} required
              className="input"
              disabled={isEdit}
              value={form.rows}
              onChange={e => set('rows', Math.max(1, Math.min(10, +e.target.value)))}
            />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1">
              Columnas (1–20)
            </label>
            <input
              type="number" min={1} max={20} required
              className="input"
              disabled={isEdit}
              value={form.cols}
              onChange={e => set('cols', Math.max(1, Math.min(20, +e.target.value)))}
            />
          </div>
        </div>

        {isEdit && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Las dimensiones no se pueden cambiar en una estantería existente. Para modificarlas, elimínala y crea una nueva.
          </p>
        )}

        <div>
          <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Color</label>
          <div className="flex gap-2">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => set('color', c)}
                className={cn(
                  'w-7 h-7 rounded-full border-2 transition-transform hover:scale-110',
                  form.color === c ? 'border-slate-800 scale-110' : 'border-transparent'
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1">
            Descripción (opcional)
          </label>
          <input
            className="input"
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="Ej: Implantes de cadera"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
            Cancelar
          </button>
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

  useEffect(() => {
    if (isOpen) setSearch('');
  }, [isOpen]);

  const items = tab === 'implant_lot'
    ? available.implantLots.filter(i => i.label.toLowerCase().includes(search.toLowerCase()) || i.detail.toLowerCase().includes(search.toLowerCase()))
    : available.trays.filter(i => i.label.toLowerCase().includes(search.toLowerCase()) || i.detail.toLowerCase().includes(search.toLowerCase()));

  const handleAssign = async (itemId: string) => {
    if (!slot) return;
    setSaving(true);
    try {
      await storageService.assignSlot(slot.id, tab, itemId);
      toast.success('Ítem asignado a la celda');
      onSaved();
      onClose();
    } catch {
      toast.error('Error asignando ítem');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!slot) return;
    setSaving(true);
    try {
      await storageService.clearSlot(slot.id);
      toast.success('Celda liberada');
      onSaved();
      onClose();
    } catch {
      toast.error('Error liberando celda');
    } finally {
      setSaving(false);
    }
  };

  if (!slot) return null;

  const slotLabelText = cellLabel(slot.row_index, slot.col_index);
  const title = isEmpty
    ? `Asignar ítem — Celda ${slotLabelText}`
    : `Celda ${slotLabelText}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      {!isEmpty ? (
        // ── Celda ocupada ──
        <div className="space-y-4">
          <div className={cn(
            'p-4 rounded-xl border-2',
            slot.item_type === 'implant_lot'
              ? 'border-blue-200 bg-blue-50'
              : 'border-green-200 bg-green-50'
          )}>
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
              <button
                onClick={handleClear}
                disabled={saving}
                className="btn flex-1 bg-red-500 text-white hover:bg-red-600"
              >
                {saving ? 'Liberando...' : 'Desasignar'}
              </button>
            )}
          </div>
        </div>
      ) : isAdmin ? (
        // ── Celda vacía — asignar ──
        <div className="space-y-4">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            {(['implant_lot', 'tray'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'flex-1 py-2 rounded-lg text-sm font-semibold transition-all',
                  tab === t ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {t === 'implant_lot' ? 'Implantes' : 'Bandejas'}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input !pl-10"
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1">
            {loadingItems ? (
              <p className="text-center text-slate-400 py-8 text-sm">Cargando...</p>
            ) : items.length === 0 ? (
              <p className="text-center text-slate-400 py-8 text-sm">
                {search ? 'Sin resultados' : 'No hay ítems disponibles sin asignar'}
              </p>
            ) : items.map(item => (
              <button
                key={item.id}
                onClick={() => handleAssign(item.id)}
                disabled={saving}
                className="w-full text-left p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all disabled:opacity-50"
              >
                <p className="font-semibold text-slate-800 text-sm">{item.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{item.detail}</p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        // ── Celda vacía — solo lectura ──
        <div className="text-center py-6 space-y-3">
          <p className="text-slate-500 text-sm">Esta celda está vacía.</p>
          <button onClick={onClose} className="btn btn-secondary">Cerrar</button>
        </div>
      )}
    </Modal>
  );
};

// ─── AlmacenMap (página principal) ───────────────────────────────────────────

interface AlmacenMapProps {
  userProfile: UserProfile | null;
}

export const AlmacenMap: React.FC<AlmacenMapProps> = ({ userProfile }) => {
  const toast = useToast();
  const [shelves, setShelves] = useState<StorageShelf[]>([]);
  const [loading, setLoading] = useState(true);
  const [shelfModal, setShelfModal] = useState<{ open: boolean; shelf: StorageShelf | null }>({ open: false, shelf: null });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [slotModal, setSlotModal] = useState<{ open: boolean; slot: StorageSlot | null }>({ open: false, slot: null });

  const isAdmin =
    userProfile?.role === 'Administrador' || userProfile?.role === 'Superadmin';

  const [mapSearch, setMapSearch] = useState('');

  const highlightedIds = React.useMemo((): Set<string> => {
    const q = mapSearch.trim().toLowerCase();
    if (q.length < 2) return new Set();
    const ids = new Set<string>();
    for (const shelf of shelves) {
      for (const slot of (shelf.slots ?? [])) {
        if (slot.item_id && (
          slot.item_label?.toLowerCase().includes(q) ||
          slot.item_detail?.toLowerCase().includes(q)
        )) {
          ids.add(slot.id);
        }
      }
    }
    return ids;
  }, [mapSearch, shelves]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setShelves(await storageService.getShelves());
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
    } catch {
      toast.error('Error eliminando estantería');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mapa de Almacén</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {shelves.length} {shelves.length === 1 ? 'estantería' : 'estanterías'}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShelfModal({ open: true, shelf: null })}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus size={18} />
            Nueva Estantería
          </button>
        )}
      </div>

      {/* Buscador de celdas */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          className="input !pl-10 pr-10"
          placeholder="Buscar producto en el mapa… ej: tornillo 3.5"
          value={mapSearch}
          onChange={e => setMapSearch(e.target.value)}
        />
        {mapSearch && (
          <button
            onClick={() => setMapSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        )}
      </div>
      {mapSearch.trim().length >= 2 && (
        <p className={cn(
          'text-sm font-semibold',
          highlightedIds.size > 0 ? 'text-yellow-700' : 'text-slate-400'
        )}>
          {highlightedIds.size > 0
            ? `${highlightedIds.size} ${highlightedIds.size === 1 ? 'celda encontrada' : 'celdas encontradas'}`
            : 'Sin resultados en el mapa'}
        </p>
      )}

      {/* Leyenda */}
      <div className="flex items-center gap-5 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border-2 border-dashed border-slate-300 bg-slate-50 inline-block" />
          Vacío
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border-2 border-blue-300 bg-blue-50 inline-block" />
          Lote de implante
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border-2 border-green-300 bg-green-50 inline-block" />
          Bandeja
        </span>
      </div>

      {/* Contenido */}
      {loading ? (
        <PageLoader />
      ) : shelves.length === 0 ? (
        <EmptyState
          icon={Warehouse}
          title="Sin estanterías"
          description={
            isAdmin
              ? 'Crea tu primera estantería para empezar a mapear el almacén.'
              : 'Aún no hay estanterías configuradas.'
          }
          action={
            isAdmin ? (
              <button
                onClick={() => setShelfModal({ open: true, shelf: null })}
                className="btn btn-primary mt-2"
              >
                <Plus size={16} className="inline mr-1" />
                Nueva Estantería
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
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
