import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { trayService } from '../services/trayService';
import { getLocalDateString } from '../utils/dateUtils';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { StatusBadge } from '../components/ui/Badge';
import { PageLoader, EmptyState } from '../components/ui/Spinner';
import { TRAY_STATUSES, MAX_STERILIZATIONS } from '../data/catalogo';
import { Package, Plus, Pencil, Trash2, Search, AlertTriangle, Wrench, Stethoscope, MapPin, ChevronDown, ChevronUp, X, ListChecks } from 'lucide-react';
import { cn } from '../utils/cn';
import { useToast } from '../components/ui/Toast';
import { implantService } from '../services/implantService';
import type { Tray, TrayItem, Implant } from '../types/domain';

const TrayForm = ({ initial, onSave, onCancel, loading }: { initial: Partial<Tray> | null; onSave: (data: any) => void; onCancel: () => void; loading: boolean }) => {
  const [form, setForm] = useState(initial || {
    name: '', code: '', procedure_type: '', content: '',
    status: 'Disponible', location: '', sterilization_count: 0,
    last_sterilization: '', next_maintenance: '', is_support_tray: false
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const submit = (e: React.FormEvent) => { e.preventDefault(); onSave(form); };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre del Set *</label>
          <input required className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Set Rodilla Total" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Código Interno *</label>
          <input required className="input" value={form.code} onChange={e => set('code', e.target.value)} placeholder="SET-ROD-001" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Estado</label>
          <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
            {TRAY_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Procedimiento Asociado</label>
          <input className="input" value={form.procedure_type} onChange={e => set('procedure_type', e.target.value)} placeholder="Artroplastia total de rodilla" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Notas / descripción general</label>
          <textarea rows={2} className="input resize-none" value={form.content} onChange={e => set('content', e.target.value)} placeholder="Notas adicionales sobre la bandeja..." />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Ubicación Actual</label>
          <input className="input" value={form.location} onChange={e => set('location', e.target.value)} placeholder="Bodega 1, Estante A..." />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Esterilizaciones Acumuladas</label>
          <input type="number" min={0} className="input" value={form.sterilization_count} onChange={e => set('sterilization_count', +e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Última Esterilización</label>
          <input type="date" className="input" value={getLocalDateString(form.last_sterilization ?? undefined)} onChange={e => set('last_sterilization', e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Próximo Mantenimiento</label>
          <input type="date" className="input" value={getLocalDateString(form.next_maintenance ?? undefined)} onChange={e => set('next_maintenance', e.target.value)} />
        </div>
      </div>
      <label className="flex items-start gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50 cursor-pointer hover:bg-amber-100 transition-colors">
        <input
          type="checkbox"
          className="accent-amber-600 mt-0.5 shrink-0"
          checked={!!(form as any).is_support_tray}
          onChange={e => set('is_support_tray', e.target.checked)}
        />
        <div>
          <p className="text-sm font-semibold text-amber-800">Es bandeja de apoyo</p>
          <p className="text-xs text-amber-600 mt-0.5">Esta bandeja se presta al hospital sin cargo al paciente. Aparece en la hoja de entrega con etiqueta "Apoyo – A devolver".</p>
        </div>
      </label>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={loading} className="btn btn-primary flex-1">
          {loading ? 'Guardando...' : 'Guardar Bandeja'}
        </button>
      </div>
    </form>
  );
};

// ─── TrayItemsPanel ──────────────────────────────────────────────────────────
const TrayItemsPanel: React.FC<{ trayId: string; canEdit: boolean }> = ({ trayId, canEdit }) => {
  const toast = useToast();
  const [items, setItems] = useState<TrayItem[]>([]);
  const [allImplants, setAllImplants] = useState<Implant[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Implant | null>(null);
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState(1);

  useEffect(() => {
    Promise.all([trayService.getTrayItems(trayId), implantService.getAll()])
      .then(([it, imp]) => { setItems(it); setAllImplants(imp); })
      .catch(() => toast.error('Error cargando componentes'))
      .finally(() => setLoadingItems(false));
  }, [trayId]);

  const results = allImplants.filter(i =>
    search.length >= 1 &&
    (i.name.toLowerCase().includes(search.toLowerCase()) || (i.sku ?? '').toLowerCase().includes(search.toLowerCase()))
  ).slice(0, 8);

  const handleAdd = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const item = await trayService.addTrayItem(trayId, selected.id, qty);
      setItems(prev => {
        const existing = prev.findIndex(i => i.implant_id === selected.id);
        if (existing >= 0) { const copy = [...prev]; copy[existing] = item; return copy; }
        return [...prev, item];
      });
      setSelected(null); setSearch(''); setQty(1); setShowDropdown(false);
      toast.success('Componente agregado');
    } catch { toast.error('Error agregando componente'); }
    finally { setSaving(false); }
  };

  const handleRemove = async (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    try { await trayService.removeTrayItem(id); }
    catch { toast.error('Error eliminando componente'); trayService.getTrayItems(trayId).then(setItems); }
  };

  const handleEditQty = async (id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: editQty } : i));
    setEditingId(null);
    try { await trayService.updateTrayItem(id, editQty); }
    catch { toast.error('Error actualizando cantidad'); trayService.getTrayItems(trayId).then(setItems); }
  };

  if (loadingItems) return <div className="py-3 text-xs text-slate-400">Cargando componentes…</div>;

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
      {canEdit && (
        <div className="relative">
          <div className="grid gap-2 items-center" style={{ gridTemplateColumns: '1fr 56px auto' }}>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                className="input !pl-8 text-sm w-full"
                placeholder="Buscar implante…"
                value={selected ? selected.name : search}
                onChange={e => { setSearch(e.target.value); setSelected(null); setShowDropdown(true); }}
                onFocus={() => { setShowDropdown(true); }}
                onBlur={() => setTimeout(() => setShowDropdown(false), 250)}
              />
            </div>
            <input type="number" min={1} max={999} className="input text-sm text-center w-full" value={qty} onChange={e => setQty(Math.max(1, +e.target.value))} title="Cantidad" />
            <button onClick={handleAdd} disabled={!selected || saving} className="btn btn-primary text-sm px-3 whitespace-nowrap">
              + Agregar
            </button>
          </div>
          {showDropdown && results.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 max-h-48 overflow-auto">
              {results.map(imp => (
                <button key={imp.id} onMouseDown={() => { setSelected(imp); setSearch(imp.name); setShowDropdown(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold text-slate-800">{imp.name}</span>
                  <span className="text-xs text-slate-400 font-mono shrink-0">{imp.sku}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-slate-400 italic">{canEdit ? 'Busca y agrega componentes desde el inventario.' : 'Sin componentes registrados.'}</p>
      ) : (
        <div className="space-y-1">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-2 group py-1 px-2 rounded-lg hover:bg-slate-50">
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-slate-800">{item.implant?.name ?? '—'}</span>
                {item.implant?.sku && <span className="ml-2 text-[10px] font-mono text-slate-400">{item.implant.sku}</span>}
              </div>
              {canEdit && editingId === item.id ? (
                <div className="flex items-center gap-1 shrink-0">
                  <input type="number" min={1} max={999} className="input w-14 text-xs text-center py-0.5" value={editQty}
                    onChange={e => setEditQty(Math.max(1, +e.target.value))}
                    onKeyDown={e => { if (e.key === 'Enter') handleEditQty(item.id); if (e.key === 'Escape') setEditingId(null); }}
                    autoFocus />
                  <button onClick={() => handleEditQty(item.id)} className="text-xs text-primary font-bold hover:underline">Ok</button>
                </div>
              ) : (
                <button onClick={() => canEdit ? (setEditingId(item.id), setEditQty(item.quantity)) : undefined}
                  className={cn('shrink-0 text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary', canEdit && 'hover:bg-primary/20 cursor-pointer')}>
                  ×{item.quantity}
                </button>
              )}
              {canEdit && (
                <button onClick={() => handleRemove(item.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all shrink-0">
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const Bandejas: React.FC = () => {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [trays, setTrays] = useState<Tray[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [filterStatus, setFilterStatus] = useState('');
  const [modal, setModal] = useState<{ data: Tray | null } | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; name: string } | null>(null);
  const [expandedItems, setExpandedItems] = useState<string | null>(null);
  const isAdmin = true; // TODO: pass userProfile when available — for now all can manage items

  const fetchTrays = async () => { setLoading(true); const d = await trayService.getAll(); setTrays(d); setLoading(false); };
  useEffect(() => { fetchTrays(); }, []);
  useEffect(() => { const q = searchParams.get('q'); if (q !== null) setSearch(q); }, [searchParams]);

  const filtered = trays.filter(t => {
    const matchSearch = t.name?.toLowerCase().includes(search.toLowerCase()) || t.code?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || t.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleSave = async (data: any) => {
    if (!modal) return;
    setSaving(true);
    try {
      if (modal.data?.id) await trayService.update(modal.data.id, data);
      else await trayService.create(data);
      setModal(null);
      fetchTrays();
      toast.success(modal.data?.id ? 'Bandeja actualizada' : 'Bandeja creada');
    } catch (err) {
      console.error('Error saving tray:', err);
      toast.error('Error al guardar la bandeja: ' + ((err as Error).message || ''));
    } finally {
      setSaving(false);
    }
  };
  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await trayService.update(id, { status });
      setTrays(prev => prev.map(t => t.id === id ? { ...t, status } : t));
      toast.success(`Estado de bandeja: ${status}`);
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      toast.error('Error al cambiar estado de bandeja');
    }
  };

  const handleDelete = async () => {
    if (!confirm) return;
    try {
      await trayService.delete(confirm.id);
      setConfirm(null);
      fetchTrays();
      toast.success('Bandeja eliminada');
    } catch (err) {
      console.error('Error deleting tray:', err);
      toast.error('Error al eliminar la bandeja');
    }
  };

  const warnings = trays.filter(t => (t.sterilization_count ?? 0) >= MAX_STERILIZATIONS * 0.9);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Bandejas / Sets</h1>
          <p className="text-slate-500">{trays.length} sets en inventario</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ data: null })}>
          <Plus size={18} />Nueva Bandeja
        </button>
      </div>

      {warnings.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-semibold text-amber-800">Alerta de Mantenimiento</p>
            <p className="text-sm text-amber-700">{warnings.map(w => w.name).join(', ')} — supera el 90% de esterilizaciones máximas.</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input className="input input-search text-sm" placeholder="Buscar por nombre o código..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input max-w-[200px] text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {TRAY_STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {loading ? <PageLoader /> : filtered.length === 0
        ? <EmptyState icon={Package} title="Sin bandejas registradas" description="Añade la primera con el botón superior" />
        : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(t => {
              const pct = Math.min(100, Math.round(((t.sterilization_count ?? 0) / MAX_STERILIZATIONS) * 100));
              const danger = (t.sterilization_count ?? 0) >= MAX_STERILIZATIONS;
              const warn = (t.sterilization_count ?? 0) >= MAX_STERILIZATIONS * 0.9;
              return (
                <div key={t.id} className={cn('card group border-2', danger ? 'border-red-200' : warn ? 'border-amber-200' : 'border-slate-200')}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="font-bold text-slate-900">{t.name}</p>
                      <p className="text-xs font-mono text-slate-400 mt-0.5">{t.code}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setModal({ data: t })} className="p-2 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => setConfirm({ id: t.id, name: t.name })} className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="mt-1">
                    <select
                      value={t.status}
                      onChange={(e) => handleStatusUpdate(t.id, e.target.value)}
                      className={cn(
                        "text-[10px] font-black uppercase px-2 py-0.5 rounded-md border cursor-pointer focus:ring-2 focus:ring-primary/20 outline-none transition-all",
                        t.status === 'Disponible' ? "bg-green-50 text-green-700 border-green-200" :
                        t.status === 'En Uso' ? "bg-blue-50 text-blue-700 border-blue-200" :
                        "bg-amber-50 text-amber-700 border-amber-200"
                      )}
                    >
                      {TRAY_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div className="flex items-center gap-4 mt-3 py-2 border-y border-slate-50">
                    <div className="flex items-center gap-1.5" title="Cirugías realizadas">
                      <Stethoscope size={14} className="text-primary" />
                      <span className="text-sm font-bold text-slate-700">{t.usage_count}</span>
                      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">Usos</span>
                    </div>
                    {t.location && (
                      <div className="flex items-center gap-1.5 border-l border-slate-100 pl-4">
                        <MapPin size={14} className="text-slate-400" />
                        <span className="text-xs text-slate-600 font-medium">{t.location}</span>
                      </div>
                    )}
                  </div>

                  {t.procedure_type && <p className="text-xs text-slate-500 mt-2 italic">{t.procedure_type}</p>}

                  <div className="mt-4">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-500 font-medium">Esterilizaciones</span>
                      <span className={cn('font-bold', danger ? 'text-red-600' : warn ? 'text-amber-600' : 'text-slate-700')}>
                        {t.sterilization_count} / {MAX_STERILIZATIONS}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', danger ? 'bg-red-500' : warn ? 'bg-amber-500' : 'bg-primary')} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  {t.last_sterilization && (
                    <p className="text-xs text-slate-400 mt-2">Última esterilización: {new Date(t.last_sterilization).toLocaleDateString('es-ES')}</p>
                  )}

                  {/* Componentes toggle */}
                  <button
                    onClick={() => setExpandedItems(prev => prev === t.id ? null : t.id)}
                    className="mt-3 w-full flex items-center justify-between text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    <span className="flex items-center gap-1.5"><ListChecks size={13} /> Componentes</span>
                    {expandedItems === t.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                  {expandedItems === t.id && (
                    <TrayItemsPanel trayId={t.id} canEdit={isAdmin} />
                  )}
                </div>
              );
            })}
          </div>
        )}

      <Modal isOpen={!!modal} onClose={() => setModal(null)} title={modal?.data ? 'Editar Bandeja' : 'Nueva Bandeja'} size="md">
        <TrayForm initial={modal?.data ?? null} onSave={handleSave} onCancel={() => setModal(null)} loading={saving} />
      </Modal>
      <ConfirmDialog
        isOpen={!!confirm} onClose={() => setConfirm(null)} onConfirm={handleDelete}
        title="¿Eliminar bandeja?" message={`¿Eliminar "${confirm?.name}"? Esto removerá todas sus asignaciones.`}
      />
    </div>
  );
};
