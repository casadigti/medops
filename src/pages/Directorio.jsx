import React, { useState, useEffect } from 'react';
import { surgeonService } from '../services/surgeonService';
import { hospitalService } from '../services/hospitalService';
import { surgeryService } from '../services/surgeryService';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { PageLoader, EmptyState } from '../components/ui/Spinner';
import { SPECIALTIES } from '../data/catalogo';
import { 
  Users, Building2, Plus, Pencil, Trash2, Phone, Mail, 
  MapPin, Search, Calendar, Package, ClipboardList, TrendingUp, Info
} from 'lucide-react';
import { cn } from '../utils/cn';

// ── Surgeon Profile View ──────────────────────────────────────────
const SurgeonProfile = ({ surgeon, surgeries }) => {
  const mySurgeries = surgeries.filter(s => s.surgeon_id === surgeon.id);
  
  const hospitalCounts = mySurgeries.reduce((acc, s) => {
    const name = s.hospital?.name || 'Otro';
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});
  const topHospital = Object.entries(hospitalCounts).sort((a,b) => b[1] - a[1])[0];

  const trayCounts = mySurgeries.reduce((acc, s) => {
    (s.surgery_trays || []).forEach(st => {
      const name = st.tray?.name;
      if (name) acc[name] = (acc[name] || 0) + 1;
    });
    return acc;
  }, {});
  const topTrays = Object.entries(trayCounts).sort((a,b) => b[1] - a[1]).slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
          <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">Cirugías</p>
          <p className="text-2xl font-black text-slate-900">{mySurgeries.length}</p>
        </div>
        <div className="bg-teal-50 p-4 rounded-2xl border border-teal-100 col-span-2">
          <p className="text-[10px] font-bold text-teal-600 uppercase tracking-wider mb-1">Hospital más frecuente</p>
          <p className="text-sm font-bold text-slate-900 truncate">{topHospital ? topHospital[0] : 'Sin historial'}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
            <Package size={16} className="text-primary" /> Sets más utilizados
          </h4>
          <div className="space-y-2">
            {topTrays.length > 0 ? topTrays.map(([name, count]) => (
              <div key={name} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-sm font-medium text-slate-700">{name}</span>
                <span className="text-xs bg-white px-2 py-1 rounded-lg border border-slate-200 font-bold text-slate-500">{count} veces</span>
              </div>
            )) : <p className="text-sm text-slate-400 italic">No hay historial de sets utilizados.</p>}
          </div>
        </div>

        <div className="bg-slate-900 rounded-2xl p-4 text-white shadow-lg">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Preferencias del Doctor</h4>
          <p className="text-sm leading-relaxed text-slate-200">{surgeon.preferences || 'No hay preferencias registradas.'}</p>
        </div>
      </div>
    </div>
  );
};

// ── Hospital Profile View ──────────────────────────────────────────
const HospitalProfile = ({ hospital, surgeries }) => {
  const upcoming = surgeries
    .filter(s => s.hospital_id === hospital.id && new Date(s.surgery_date) >= new Date())
    .sort((a,b) => new Date(a.surgery_date) - new Date(b.surgery_date));

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
        <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2 flex items-center gap-2">
          <ClipboardList size={14} /> Notas Logísticas
        </h4>
        <p className="text-sm text-slate-700 leading-relaxed">{hospital.logistics_notes || 'Sin requisitos especiales.'}</p>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Calendar size={16} className="text-primary" /> Próximas Cirugías ({upcoming.length})
        </h4>
        <div className="space-y-2 overflow-y-auto max-h-64 pr-1">
          {upcoming.length > 0 ? upcoming.map(s => (
            <div key={s.id} className="p-3 bg-white border border-slate-100 rounded-xl hover:shadow-md transition-all group">
              <div className="flex justify-between items-start mb-1">
                <p className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">{s.patient_name}</p>
                <span className="text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase">
                  {new Date(s.surgery_date).toLocaleDateString()}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">{s.procedure_type}</p>
              <div className="flex items-center gap-2 mt-2">
                <div className="w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-500">
                  {s.operating_room?.match(/\d+/)?.[0] || 'Qx'}
                </div>
                <span className="text-[10px] text-slate-400">Sala {s.operating_room || 'N/A'}</span>
              </div>
            </div>
          )) : <p className="text-sm text-slate-400 italic py-4 text-center">No hay cirugías programadas próximamente.</p>}
        </div>
      </div>
    </div>
  );
};

// ── Surgeon Form ────────────────────────────────────────────────
const SurgeonForm = ({ initial, onSave, onCancel, loading }) => {
  const [form, setForm] = useState(initial || { full_name:'', specialty:'', phone:'', email:'', preferences:'' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const submit = e => { e.preventDefault(); onSave(form); };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre completo *</label>
          <input required className="input" value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Dr. Juan Pérez" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Especialidad</label>
          <select className="input" value={form.specialty} onChange={e => set('specialty', e.target.value)}>
            <option value="">Seleccionar...</option>
            {SPECIALTIES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Teléfono</label>
          <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 809 000 0000" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Correo electrónico</label>
          <input type="email" className="input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="dr@hospital.com" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Preferencias / Notas</label>
          <textarea rows={3} className="input resize-none" value={form.preferences} onChange={e => set('preferences', e.target.value)} placeholder="Sets preferidos, implantes específicos..." />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={loading} className="btn btn-primary flex-1">
          {loading ? 'Guardando...' : 'Guardar Cirujano'}
        </button>
      </div>
    </form>
  );
};

// ── Hospital Form ───────────────────────────────────────────────
const HospitalForm = ({ initial, onSave, onCancel, loading }) => {
  const [form, setForm] = useState(initial || { name:'', address:'', coordinator_contact:'', logistics_notes:'', operating_rooms:[] });
  const [roomInput, setRoomInput] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const addRoom = () => {
    if (roomInput.trim()) { set('operating_rooms', [...(form.operating_rooms||[]), roomInput.trim()]); setRoomInput(''); }
  };
  const removeRoom = (i) => set('operating_rooms', form.operating_rooms.filter((_,idx) => idx !== i));
  const submit = e => { e.preventDefault(); onSave(form); };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre del Hospital *</label>
        <input required className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Hospital General Plaza..." />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Dirección</label>
        <input className="input" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Av. Winston Churchill..." />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Contacto Coordinador</label>
        <input className="input" value={form.coordinator_contact} onChange={e => set('coordinator_contact', e.target.value)} placeholder="Nombre - Tel: 809 000 0000" />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Quirófanos</label>
        <div className="flex gap-2 mb-2">
          <input className="input flex-1" value={roomInput} onChange={e => setRoomInput(e.target.value)} placeholder="Qx #1" onKeyDown={e => e.key==='Enter' && (e.preventDefault(), addRoom())} />
          <button type="button" onClick={addRoom} className="btn btn-secondary px-3">+</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(form.operating_rooms||[]).map((r,i) => (
            <span key={i} className="flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
              {r}<button type="button" onClick={() => removeRoom(i)} className="ml-1 text-blue-400 hover:text-blue-700">×</button>
            </span>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Notas Logísticas</label>
        <textarea rows={2} className="input resize-none" value={form.logistics_notes} onChange={e => set('logistics_notes', e.target.value)} placeholder="Horario de recepción, requisitos especiales..." />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={loading} className="btn btn-primary flex-1">
          {loading ? 'Guardando...' : 'Guardar Hospital'}
        </button>
      </div>
    </form>
  );
};

// ── Main Page ───────────────────────────────────────────────────
export const Directorio = () => {
  const [tab, setTab] = useState('cirujanos');
  const [surgeons, setSurgeons] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [surgeries, setSurgeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // { type: 'surgeon'|'hospital'|'profile_s'|'profile_h', data: {} }
  const [confirm, setConfirm] = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    const [s, h, surg] = await Promise.all([
      surgeonService.getAll(), 
      hospitalService.getAll(),
      surgeryService.getAll()
    ]);
    setSurgeons(s); setHospitals(h); setSurgeries(surg);
    setLoading(false);
  };
  useEffect(() => { fetchAll(); }, []);

  const filteredSurgeons = surgeons.filter(s =>
    s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.specialty?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredHospitals = hospitals.filter(h =>
    h.name?.toLowerCase().includes(search.toLowerCase()) ||
    h.address?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSaveSurgeon = async (data) => {
    setSaving(true);
    try {
      if (modal.data?.id) await surgeonService.update(modal.data.id, data);
      else await surgeonService.create(data);
      setModal(null); fetchAll();
    } finally { setSaving(false); }
  };
  const handleSaveHospital = async (data) => {
    setSaving(true);
    try {
      if (modal.data?.id) await hospitalService.update(modal.data.id, data);
      else await hospitalService.create(data);
      setModal(null); fetchAll();
    } finally { setSaving(false); }
  };
  const handleDelete = async () => {
    if (confirm.type === 'surgeon') await surgeonService.delete(confirm.id);
    else await hospitalService.delete(confirm.id);
    setConfirm(null); fetchAll();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Directorio</h1>
          <p className="text-slate-500">Gestión de especialistas y centros médicos</p>
        </div>
        <button
          className="btn btn-primary shadow-lg shadow-primary/20"
          onClick={() => setModal({ type: tab === 'cirujanos' ? 'surgeon' : 'hospital', data: null })}
        >
          <Plus size={18} />
          {tab === 'cirujanos' ? 'Nuevo Cirujano' : 'Nuevo Hospital'}
        </button>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
          {[['cirujanos','Cirujanos', Users], ['hospitales','Hospitales', Building2]].map(([key, label, Icon]) => (
            <button key={key} onClick={() => { setTab(key); setSearch(''); }}
              className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                tab === key ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              <Icon size={16} />{label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input className="input input-search text-sm" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Content */}
      {loading ? <PageLoader /> : (
        <>
          {tab === 'cirujanos' && (
            filteredSurgeons.length === 0
              ? <EmptyState icon={Users} title="Sin cirujanos registrados" description="Añade el primero para comenzar." />
              : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredSurgeons.map(s => (
                    <div key={s.id} className="card group hover:border-primary/30 transition-all">
                      <div className="flex items-start justify-between gap-2">
                        <div 
                          className="flex items-center gap-3 cursor-pointer hover:opacity-80"
                          onClick={() => setModal({ type: 'profile_s', data: s })}
                        >
                          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary font-black text-xl shrink-0 group-hover:bg-primary group-hover:text-white transition-all">
                            {s.full_name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 leading-tight flex items-center gap-1.5">
                              {s.full_name} <Info size={12} className="text-slate-300" />
                            </p>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-0.5">{s.specialty || 'General'}</p>
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setModal({ type:'surgeon', data:s })} className="p-2 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"><Pencil size={14} /></button>
                          <button onClick={() => setConfirm({ type:'surgeon', id:s.id, name:s.full_name })} className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-slate-50 space-y-2 text-sm text-slate-600">
                        {s.phone && <div className="flex items-center gap-2 font-medium"><Phone size={13} className="text-slate-400" />{s.phone}</div>}
                        {s.email && <div className="flex items-center gap-2"><Mail size={13} className="text-slate-400" />{s.email}</div>}
                      </div>
                    </div>
                  ))}
                </div>
          )}
          {tab === 'hospitales' && (
            filteredHospitals.length === 0
              ? <EmptyState icon={Building2} title="Sin hospitales registrados" description="Añade el primero para comenzar." />
              : <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {filteredHospitals.map(h => (
                    <div key={h.id} className="card group hover:border-teal-300 transition-all">
                      <div className="flex items-start justify-between">
                        <div 
                          className="flex items-center gap-3 cursor-pointer hover:opacity-80"
                          onClick={() => setModal({ type: 'profile_h', data: h })}
                        >
                          <div className="w-12 h-12 bg-teal-50 rounded-2xl flex items-center justify-center text-teal-600 shrink-0 group-hover:bg-teal-600 group-hover:text-white transition-all">
                            <Building2 size={24} />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 flex items-center gap-1.5">
                              {h.name} <Info size={12} className="text-slate-300" />
                            </p>
                            {h.address && <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><MapPin size={11} />{h.address}</p>}
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setModal({ type:'hospital', data:h })} className="p-2 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"><Pencil size={14} /></button>
                          <button onClick={() => setConfirm({ type:'hospital', id:h.id, name:h.name })} className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                         <div className="flex gap-1">
                            {(h.operating_rooms||[]).slice(0,3).map((r,i) => <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">{r}</span>)}
                            {(h.operating_rooms||[]).length > 3 && <span className="text-[10px] text-slate-400 font-bold">+{h.operating_rooms.length - 3}</span>}
                         </div>
                         {h.coordinator_contact && <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1"><Phone size={10} /> Contacto Disponible</p>}
                      </div>
                    </div>
                  ))}
                </div>
          )}
        </>
      )}

      {/* Modals de Formulario */}
      <Modal isOpen={modal?.type==='surgeon'} onClose={() => setModal(null)} title={modal?.data ? 'Editar Cirujano' : 'Nuevo Cirujano'}>
        <SurgeonForm initial={modal?.data} onSave={handleSaveSurgeon} onCancel={() => setModal(null)} loading={saving} />
      </Modal>
      <Modal isOpen={modal?.type==='hospital'} onClose={() => setModal(null)} title={modal?.data ? 'Editar Hospital' : 'Nuevo Hospital'}>
        <HospitalForm initial={modal?.data} onSave={handleSaveHospital} onCancel={() => setModal(null)} loading={saving} />
      </Modal>

      {/* Modals de Perfil Analítico */}
      <Modal 
        isOpen={modal?.type==='profile_s'} 
        onClose={() => setModal(null)} 
        title={`Perfil: ${modal?.data?.full_name}`}
        size="md"
      >
        <SurgeonProfile surgeon={modal?.data} surgeries={surgeries} />
      </Modal>
      <Modal 
        isOpen={modal?.type==='profile_h'} 
        onClose={() => setModal(null)} 
        title={`Detalle: ${modal?.data?.name}`}
        size="md"
      >
        <HospitalProfile hospital={modal?.data} surgeries={surgeries} />
      </Modal>

      <ConfirmDialog
        isOpen={!!confirm} onClose={() => setConfirm(null)} onConfirm={handleDelete}
        title="¿Eliminar registro?" message={`¿Estás seguro de eliminar "${confirm?.name}"? Esta acción no se puede deshacer.`}
      />
    </div>
  );
};
