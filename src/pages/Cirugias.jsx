import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { surgeryService } from '../services/surgeryService';
import { surgeonService } from '../services/surgeonService';
import { hospitalService } from '../services/hospitalService';
import { trayService } from '../services/trayService';
import { arsService } from '../services/arsService';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { StatusBadge } from '../components/ui/Badge';
import { PageLoader, EmptyState } from '../components/ui/Spinner';
import { SURGERY_STATUSES, PROCEDURE_TYPES, STATUS_COLORS } from '../data/catalogo';
import { Stethoscope, Plus, Pencil, Trash2, Search, ChevronDown, Calendar, User, Building2, Package, Printer } from 'lucide-react';
import { cn } from '../utils/cn';
import { printService } from '../services/printService';

// ─── Surgery Form ────────────────────────────────────────────────────────────
const SurgeryForm = ({ initial, surgeons, hospitals, arsList, onSave, onCancel, loading }) => {
  const [form, setForm] = useState(() => ({
    patient_name: '', surgery_date: '', surgeon_id: '', hospital_id: '',
    operating_room: '', procedure_type: '', status: 'Pendiente',
    delivery_responsible: '', notes: '', ars_id: '',
    ...(initial || {})
  }));
  const [selectedTrayIds, setSelectedTrayIds] = useState([]);
  const [availableTrays, setAvailableTrays] = useState([]);
  const [trayLoading, setTrayLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Pre-fill tray selection when editing
  useEffect(() => {
    if (initial?.surgery_trays) {
      setSelectedTrayIds(initial.surgery_trays.map(st => st.tray?.id).filter(Boolean));
    }
  }, [initial]);

  // Load trays when date changes
  useEffect(() => {
    if (!form.surgery_date) return;
    setTrayLoading(true);
    trayService.getAvailableForDate(new Date(form.surgery_date), initial?.id)
      .then(setAvailableTrays)
      .finally(() => setTrayLoading(false));
  }, [form.surgery_date]);

  const toggleTray = (id) => setSelectedTrayIds(prev =>
    prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
  );

  const submit = e => { e.preventDefault(); onSave(form, selectedTrayIds); };

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Patient + Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre del Paciente *</label>
          <input required className="input" value={form.patient_name} onChange={e => set('patient_name', e.target.value)} placeholder="Nombre completo del paciente" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha y Hora *</label>
          <input required type="datetime-local" className="input" value={form.surgery_date ? form.surgery_date.slice(0,16) : ''} onChange={e => set('surgery_date', e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Estado</label>
          <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
            {SURGERY_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Aseguradora (ARS) *</label>
          <select required className="input" value={form.ars_id} onChange={e => set('ars_id', e.target.value)}>
            <option value="">Seleccionar ARS...</option>
            {arsList.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>

      {/* Surgeon + Hospital */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Cirujano</label>
          <select className="input" value={form.surgeon_id} onChange={e => set('surgeon_id', e.target.value)}>
            <option value="">Seleccionar cirujano...</option>
            {surgeons.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Hospital</label>
          <select className="input" value={form.hospital_id} onChange={e => set('hospital_id', e.target.value)}>
            <option value="">Seleccionar hospital...</option>
            {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Quirófano</label>
          <input className="input" value={form.operating_room} onChange={e => set('operating_room', e.target.value)} placeholder="Qx #1" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Responsable de Entrega</label>
          <input className="input" value={form.delivery_responsible} onChange={e => set('delivery_responsible', e.target.value)} placeholder="Nombre del técnico" />
        </div>
      </div>

      {/* Procedure */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Tipo de Procedimiento *</label>
        <select required className="input" value={form.procedure_type} onChange={e => set('procedure_type', e.target.value)}>
          <option value="">Seleccionar procedimiento...</option>
          {PROCEDURE_TYPES.map(p => <option key={p}>{p}</option>)}
        </select>
      </div>

      {/* Tray Selection */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Bandejas / Sets Requeridos
          {!form.surgery_date && <span className="text-slate-400 font-normal text-xs ml-2">(selecciona una fecha primero)</span>}
        </label>
        {trayLoading
          ? <p className="text-sm text-slate-400 italic">Verificando disponibilidad...</p>
          : availableTrays.length === 0 && !form.surgery_date
            ? null
            : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto border border-slate-200 rounded-xl p-3">
                {availableTrays.map(t => (
                  <label key={t.id} className={cn(
                    'flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer border transition-all',
                    t.busy && !selectedTrayIds.includes(t.id) ? 'opacity-40 cursor-not-allowed border-slate-100 bg-slate-50' :
                    selectedTrayIds.includes(t.id) ? 'border-primary/30 bg-blue-50' : 'border-slate-100 hover:bg-slate-50'
                  )}>
                    <input type="checkbox" className="accent-blue-700"
                      checked={selectedTrayIds.includes(t.id)}
                      disabled={t.busy && !selectedTrayIds.includes(t.id)}
                      onChange={() => toggleTray(t.id)}
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{t.name}</p>
                      <p className="text-xs text-slate-400">{t.code} {t.busy ? '— Ocupada este día' : ''}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Notas Adicionales</label>
        <textarea rows={3} className="input resize-none" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Información adicional relevante..." />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={loading} className="btn btn-primary flex-1">
          {loading ? 'Guardando...' : initial ? 'Actualizar Cirugía' : 'Crear Cirugía'}
        </button>
      </div>
    </form>
  );
};

// ─── Status Quick-Change Menu ─────────────────────────────────────────────────
const StatusMenu = ({ surgery, onUpdate }) => {
  const colors = STATUS_COLORS[surgery.status] || { bg: 'bg-slate-100', text: 'text-slate-600' };
  return (
    <select 
      value={surgery.status} 
      onChange={(e) => onUpdate(surgery.id, e.target.value)}
      className={cn(
        "text-[11px] font-bold px-2.5 py-1 rounded-full cursor-pointer outline-none transition-all appearance-none pr-6 border-2 border-transparent focus:border-primary/20",
        colors.bg, colors.text
      )}
      style={{ 
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
        backgroundPosition: 'right 6px center', 
        backgroundRepeat: 'no-repeat', 
        backgroundSize: '12px' 
      }}
    >
      {SURGERY_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export const Cirugias = ({ userProfile }) => {
  const [searchParams] = useSearchParams();
  const [surgeries, setSurgeries] = useState([]);
  const [surgeons, setSurgeons]   = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [arsList, setArsList]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [search, setSearch]       = useState(searchParams.get('q') || '');
  const [filterStatus, setFilterStatus] = useState('');
  const [modal, setModal]         = useState(null);
  const [confirm, setConfirm]     = useState(null);

  const isSurgeon = userProfile?.role === 'Cirujano';
  const mySurgeonId = userProfile?.surgeon_id;

  const fetchAll = async () => {
    setLoading(true);
    // If surgeon, filter data fetching at service level
    const [surg, sur, hosp, ars] = await Promise.all([
      surgeryService.getAll(isSurgeon ? mySurgeonId : null), 
      surgeonService.getAll(), 
      hospitalService.getAll(),
      arsService.getAll()
    ]);
    setSurgeries(surg); 
    setSurgeons(sur); 
    setHospitals(hosp); 
    setArsList(ars);
    setLoading(false);
  };

  useEffect(() => { 
    if (userProfile) fetchAll(); 
  }, [userProfile]);

  // Sync search state if URL param changes (e.g. from global search)
  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null) setSearch(q);
  }, [searchParams]);

  const filtered = surgeries.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = s.patient_name?.toLowerCase().includes(q) ||
      s.surgeon?.full_name?.toLowerCase().includes(q) ||
      s.hospital?.name?.toLowerCase().includes(q) ||
      s.procedure_type?.toLowerCase().includes(q);
    return matchSearch && (!filterStatus || s.status === filterStatus);
  });

  const handleSave = async (data, trayIds) => {
    setSaving(true);
    try {
      let finalData = { ...data };
      // Force current surgeon if role is Cirujano
      if (isSurgeon) finalData.surgeon_id = mySurgeonId;

      if (modal.data?.id) {
        await surgeryService.update(modal.data.id, finalData, trayIds);
      } else {
        const newSurgery = await surgeryService.create(finalData, trayIds);
        
        // Determinar si es urgente (próximas 48 horas)
        const diffDays = (new Date(finalData.surgery_date) - new Date()) / 86400000;
        if (diffDays <= 2 && finalData.status === 'Pendiente') {
          try {
            await surgeryService.sendAlert(newSurgery, 'casadigti@gmail.com');
            console.log('Alerta de cirugía urgente enviada al almacén.');
          } catch (alertError) {
            console.error('Error al enviar la alerta de correo:', alertError);
          }
        }
      }
      setModal(null); 
      fetchAll();
    } finally { setSaving(false); }
  };
  const handleStatusUpdate = async (id, status) => {
    await surgeryService.updateStatus(id, status);
    setSurgeries(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };
  const handleDelete = async () => {
    if (isSurgeon) return; // Protection
    await surgeryService.delete(confirm.id);
    setConfirm(null); fetchAll();
  };

  const getDaysLabel = (dateStr) => {
    const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
    if (diff < 0) return { label: 'Pasada', color: 'text-slate-400' };
    if (diff === 0) return { label: 'Hoy', color: 'text-red-600 font-bold' };
    if (diff === 1) return { label: 'Mañana', color: 'text-amber-600 font-bold' };
    return { label: `En ${diff} días`, color: 'text-slate-500' };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Gestión de Cirugías</h1>
          <p className="text-slate-500">{surgeries.length} cirugías registradas</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ data: null })}>
          <Plus size={18} />Nueva Cirugía
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input className="input input-search text-sm" placeholder="Buscar por paciente, cirujano, hospital o procedimiento..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input sm:max-w-[200px] text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {SURGERY_STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? <PageLoader /> : filtered.length === 0
        ? <EmptyState icon={Stethoscope} title="Sin cirugías registradas" description="Crea la primera cirugía con el botón superior"
            action={<button className="btn btn-primary" onClick={() => setModal({ data: null })}><Plus size={16} />Nueva Cirugía</button>} />
        : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Paciente','ARS','Procedimiento','Cirujano','Hospital','Fecha','Estado','Bandejas','Acciones'].map(h => (
                      <th key={h} className="px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(s => {
                    const { label, color } = getDaysLabel(s.surgery_date);
                    return (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-slate-900 whitespace-nowrap">{s.patient_name}</p>
                          {s.operating_room && <p className="text-xs text-slate-400">Qx: {s.operating_room}</p>}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md whitespace-nowrap uppercase">
                            {arsList.find(a => a.id === s.ars_id)?.name || 'Sin ARS'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-600 max-w-[200px]">
                          <p className="truncate" title={s.procedure_type}>{s.procedure_type}</p>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-700 whitespace-nowrap">
                          {s.surgeon?.full_name || <span className="text-slate-300 italic">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-700 whitespace-nowrap">
                          {s.hospital?.name || <span className="text-slate-300 italic">—</span>}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <p className="text-sm font-medium text-slate-900">{new Date(s.surgery_date).toLocaleDateString('es-ES')}</p>
                          <p className={cn('text-xs', color)}>{label}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusMenu surgery={s} onUpdate={handleStatusUpdate} />
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex gap-1 flex-wrap">
                            {(s.surgery_trays||[]).map(st => st.tray && (
                              <span key={st.tray.id} className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                                {st.tray.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => printService.generateDeliverySheet(s)} 
                              title="Imprimir Hoja de Entrega"
                              className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-900 transition-colors"
                            >
                              <Printer size={15} />
                            </button>
                            <button onClick={() => setModal({ data: s })} className="p-2 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"><Pencil size={15} /></button>
                            <button onClick={() => setConfirm({ id: s.id, name: s.patient_name })} className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      <Modal isOpen={!!modal} onClose={() => setModal(null)} title={modal?.data ? 'Editar Cirugía' : 'Nueva Cirugía'} size="lg">
        <SurgeryForm initial={modal?.data} surgeons={surgeons} hospitals={hospitals} arsList={arsList} onSave={handleSave} onCancel={() => setModal(null)} loading={saving} />
      </Modal>
      <ConfirmDialog
        isOpen={!!confirm} onClose={() => setConfirm(null)} onConfirm={handleDelete}
        title="¿Eliminar cirugía?" message={`¿Estás seguro de eliminar la cirugía de "${confirm?.name}"?`}
      />
    </div>
  );
};
