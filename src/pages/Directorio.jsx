import React, { useState, useEffect } from 'react';
import { surgeonService } from '../services/surgeonService';
import { hospitalService } from '../services/hospitalService';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { PageLoader, EmptyState } from '../components/ui/Spinner';
import { SPECIALTIES } from '../data/catalogo';
import { Users, Building2, Plus, Pencil, Trash2, Phone, Mail, MapPin, Search } from 'lucide-react';
import { cn } from '../utils/cn';

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // { type: 'surgeon'|'hospital', data: null|{} }
  const [confirm, setConfirm] = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    const [s, h] = await Promise.all([surgeonService.getAll(), hospitalService.getAll()]);
    setSurgeons(s); setHospitals(h); setLoading(false);
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
          <p className="text-slate-500">Cirujanos y hospitales registrados</p>
        </div>
        <button
          className="btn btn-primary"
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
          <input className="input pl-9 text-sm" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Content */}
      {loading ? <PageLoader /> : (
        <>
          {tab === 'cirujanos' && (
            filteredSurgeons.length === 0
              ? <EmptyState icon={Users} title="Sin cirujanos registrados" description="Añade el primero con el botón superior" />
              : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredSurgeons.map(s => (
                    <div key={s.id} className="card group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center text-primary font-bold text-lg shrink-0">
                            {s.full_name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 leading-tight">{s.full_name}</p>
                            <p className="text-sm text-slate-500">{s.specialty || 'Sin especialidad'}</p>
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setModal({ type:'surgeon', data:s })} className="p-2 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"><Pencil size={15} /></button>
                          <button onClick={() => setConfirm({ type:'surgeon', id:s.id, name:s.full_name })} className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={15} /></button>
                        </div>
                      </div>
                      <div className="mt-4 space-y-1.5 text-sm text-slate-600">
                        {s.phone && <div className="flex items-center gap-2"><Phone size={13} className="text-slate-400" />{s.phone}</div>}
                        {s.email && <div className="flex items-center gap-2"><Mail size={13} className="text-slate-400" />{s.email}</div>}
                        {s.preferences && <div className="mt-2 p-2.5 bg-slate-50 rounded-lg text-xs text-slate-500 italic">{s.preferences}</div>}
                      </div>
                    </div>
                  ))}
                </div>
          )}
          {tab === 'hospitales' && (
            filteredHospitals.length === 0
              ? <EmptyState icon={Building2} title="Sin hospitales registrados" description="Añade el primero con el botón superior" />
              : <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {filteredHospitals.map(h => (
                    <div key={h.id} className="card group">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 bg-teal-100 rounded-xl flex items-center justify-center text-teal-600 shrink-0">
                            <Building2 size={22} />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{h.name}</p>
                            {h.address && <p className="text-sm text-slate-500 flex items-center gap-1"><MapPin size={11} />{h.address}</p>}
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setModal({ type:'hospital', data:h })} className="p-2 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"><Pencil size={15} /></button>
                          <button onClick={() => setConfirm({ type:'hospital', id:h.id, name:h.name })} className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={15} /></button>
                        </div>
                      </div>
                      <div className="mt-4 space-y-2">
                        {h.coordinator_contact && <p className="text-sm text-slate-600 flex items-center gap-2"><Phone size={13} className="text-slate-400" />{h.coordinator_contact}</p>}
                        {(h.operating_rooms||[]).length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {h.operating_rooms.map((r,i) => <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">{r}</span>)}
                          </div>
                        )}
                        {h.logistics_notes && <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2.5 italic mt-2">{h.logistics_notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
          )}
        </>
      )}

      {/* Modals */}
      <Modal isOpen={modal?.type==='surgeon'} onClose={() => setModal(null)} title={modal?.data ? 'Editar Cirujano' : 'Nuevo Cirujano'}>
        <SurgeonForm initial={modal?.data} onSave={handleSaveSurgeon} onCancel={() => setModal(null)} loading={saving} />
      </Modal>
      <Modal isOpen={modal?.type==='hospital'} onClose={() => setModal(null)} title={modal?.data ? 'Editar Hospital' : 'Nuevo Hospital'}>
        <HospitalForm initial={modal?.data} onSave={handleSaveHospital} onCancel={() => setModal(null)} loading={saving} />
      </Modal>
      <ConfirmDialog
        isOpen={!!confirm} onClose={() => setConfirm(null)} onConfirm={handleDelete}
        title="¿Eliminar registro?" message={`¿Estás seguro de eliminar "${confirm?.name}"? Esta acción no se puede deshacer.`}
      />
    </div>
  );
};
