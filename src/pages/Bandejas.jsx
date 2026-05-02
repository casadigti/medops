import React, { useState, useEffect } from 'react';
import { trayService } from '../services/trayService';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { StatusBadge } from '../components/ui/Badge';
import { PageLoader, EmptyState } from '../components/ui/Spinner';
import { TRAY_STATUSES, MAX_STERILIZATIONS } from '../data/catalogo';
import { Package, Plus, Pencil, Trash2, Search, AlertTriangle, Wrench, Stethoscope, MapPin } from 'lucide-react';
import { cn } from '../utils/cn';

const TrayForm = ({ initial, onSave, onCancel, loading }) => {
  const [form, setForm] = useState(initial || {
    name: '', code: '', procedure_type: '', content: '',
    status: 'Disponible', location: '', sterilization_count: 0,
    last_sterilization: '', next_maintenance: ''
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const submit = e => { e.preventDefault(); onSave(form); };
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
          <label className="block text-sm font-semibold text-slate-700 mb-1">Contenido (instrumentos/implantes)</label>
          <textarea rows={3} className="input resize-none" value={form.content} onChange={e => set('content', e.target.value)} placeholder="Sierra oscilante, guías de corte, retractores..." />
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
          <input type="date" className="input" value={form.last_sterilization?.split('T')[0]||''} onChange={e => set('last_sterilization', e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Próximo Mantenimiento</label>
          <input type="date" className="input" value={form.next_maintenance?.split('T')[0]||''} onChange={e => set('next_maintenance', e.target.value)} />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={loading} className="btn btn-primary flex-1">
          {loading ? 'Guardando...' : 'Guardar Bandeja'}
        </button>
      </div>
    </form>
  );
};

export const Bandejas = () => {
  const [trays, setTrays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const fetchTrays = async () => { setLoading(true); const d = await trayService.getAll(); setTrays(d); setLoading(false); };
  useEffect(() => { fetchTrays(); }, []);

  const filtered = trays.filter(t => {
    const matchSearch = t.name?.toLowerCase().includes(search.toLowerCase()) || t.code?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || t.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleSave = async (data) => {
    setSaving(true);
    try {
      if (modal.data?.id) await trayService.update(modal.data.id, data);
      else await trayService.create(data);
      setModal(null); fetchTrays();
    } finally { setSaving(false); }
  };
  const handleStatusUpdate = async (id, status) => {
    try {
      await trayService.update(id, { status });
      setTrays(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    } catch (error) {
      console.error('Error al actualizar estado:', error);
    }
  };

  const handleDelete = async () => {
    await trayService.delete(confirm.id);
    setConfirm(null); fetchTrays();
  };

  const warnings = trays.filter(t => t.sterilization_count >= MAX_STERILIZATIONS * 0.9);

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

      {/* Maintenance Alerts */}
      {warnings.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-semibold text-amber-800">Alerta de Mantenimiento</p>
            <p className="text-sm text-amber-700">{warnings.map(w => w.name).join(', ')} — supera el 90% de esterilizaciones máximas.</p>
          </div>
        </div>
      )}

      {/* Filters */}
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

      {/* Grid */}
      {loading ? <PageLoader /> : filtered.length === 0
        ? <EmptyState icon={Package} title="Sin bandejas registradas" description="Añade la primera con el botón superior" />
        : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(t => {
              const pct = Math.min(100, Math.round((t.sterilization_count / MAX_STERILIZATIONS) * 100));
              const danger = t.sterilization_count >= MAX_STERILIZATIONS;
              const warn = t.sterilization_count >= MAX_STERILIZATIONS * 0.9;
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

                  {/* Sterilization meter */}
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
                </div>
              );
            })}
          </div>
        )}

      <Modal isOpen={!!modal} onClose={() => setModal(null)} title={modal?.data ? 'Editar Bandeja' : 'Nueva Bandeja'} size="md">
        <TrayForm initial={modal?.data} onSave={handleSave} onCancel={() => setModal(null)} loading={saving} />
      </Modal>
      <ConfirmDialog
        isOpen={!!confirm} onClose={() => setConfirm(null)} onConfirm={handleDelete}
        title="¿Eliminar bandeja?" message={`¿Eliminar "${confirm?.name}"? Esto removerá todas sus asignaciones.`}
      />
    </div>
  );
};
