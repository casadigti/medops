import React, { useState, useEffect } from 'react';
import { surgeryService } from '../services/surgeryService';
import { surgeonService } from '../services/surgeonService';
import { hospitalService } from '../services/hospitalService';
import { trayService } from '../services/trayService';
import { Modal } from '../components/ui/Modal';
import { StatusBadge } from '../components/ui/Badge';
import { PageLoader, EmptyState } from '../components/ui/Spinner';
import { SURGERY_STATUSES, PROCEDURE_TYPES } from '../data/catalogo';
import { Plus, Search, Calendar, Building2, Package, Clock, ShieldCheck, ChevronRight, MessageSquare } from 'lucide-react';
import { cn } from '../utils/cn';
import { supabase } from '../lib/supabase';

// ── Surgeon Portal: My Requests ──────────────────────────────────────────
export const MisSolicitudes = () => {
  const [loading, setLoading] = useState(true);
  const [surgeries, setSurgeries] = useState([]);
  const [surgeonProfile, setSurgeonProfile] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Simplified Form for Surgeon
  const [form, setForm] = useState({
    patient_name: '',
    surgery_date: '',
    hospital_id: '',
    procedure_type: '',
    notes: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // 1. Get the surgeon ID linked to this user
      const { data: surgeonData } = await supabase
        .from('surgeons')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();
      
      setSurgeonProfile(surgeonData);

      if (surgeonData) {
        // 2. Get their surgeries
        const allSurgeries = await surgeryService.getAll();
        setSurgeries(allSurgeries.filter(s => s.surgeon_id === surgeonData.id));
      }

      // 3. Get hospitals for the form
      const h = await hospitalService.getAll();
      setHospitals(h);

    } catch (error) {
      console.error('Error fetching portal data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    if (!surgeonProfile) return;
    
    setSaving(true);
    try {
      await surgeryService.create({
        ...form,
        surgeon_id: surgeonProfile.id,
        status: 'Pendiente' // Always starts as Pending
      });
      setIsModalOpen(false);
      setForm({ patient_name: '', surgery_date: '', hospital_id: '', procedure_type: '', notes: '' });
      await fetchData();
    } catch (error) {
      console.error('Error creating request:', error);
      alert('Error al enviar la solicitud.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-primary to-blue-600 rounded-3xl p-8 text-white shadow-xl shadow-primary/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md">Portal de Cirujanos</span>
            </div>
            <h1 className="text-4xl font-black tracking-tight mb-2">
              ¡Hola, Dr. {surgeonProfile?.full_name?.split(' ')[0] || 'Especialista'}!
            </h1>
            <p className="text-primary-100 font-medium max-w-md">
              Desde aquí puedes solicitar equipos, ver tus cirugías programadas y el estatus de tus requerimientos.
            </p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-white text-primary px-6 py-4 rounded-2xl font-bold flex items-center gap-3 shadow-lg hover:scale-105 active:scale-95 transition-all group"
          >
            <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
              <Plus size={20} />
            </div>
            Nueva Solicitud de Equipo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Clock className="text-primary" size={20} /> Mis Solicitudes Recientes
            </h2>
          </div>

          {surgeries.length === 0 ? (
            <EmptyState 
              icon={Plus} 
              title="Aún no tienes solicitudes" 
              description="Haz clic en el botón de arriba para solicitar tu primer equipo médico." 
            />
          ) : (
            <div className="space-y-3">
              {surgeries.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).map(s => (
                <div key={s.id} className="bg-white border border-slate-100 rounded-2xl p-5 hover:shadow-xl hover:border-primary/20 transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status={s.status} />
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">#{s.id.slice(0,8)}</span>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 group-hover:text-primary transition-colors">{s.patient_name}</h3>
                      <p className="text-sm font-medium text-slate-500">{s.procedure_type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Fecha Programada</p>
                      <div className="flex items-center justify-end gap-2 text-slate-900 font-bold">
                        <Calendar size={14} className="text-primary" />
                        {new Date(s.surgery_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                      <Building2 size={14} className="text-slate-400" /> {s.hospital?.name}
                    </div>
                    {s.surgery_trays?.length > 0 && (
                      <div className="flex items-center gap-2 text-xs font-bold text-primary">
                        <Package size={14} /> {s.surgery_trays.length} Sets Asignados
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <ShieldCheck size={18} className="text-green-500" /> Información de Logística
            </h3>
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tiempos de Respuesta</p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Las solicitudes realizadas antes de las <span className="font-bold text-slate-900">4:00 PM</span> son procesadas para el día siguiente.
                </p>
              </div>
              <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">Soporte Técnico</p>
                <p className="text-sm text-slate-700">Si necesitas un equipo de emergencia, favor llamar directamente a logística.</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Mis Estadísticas</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-3xl font-black">{surgeries.length}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Totales</p>
              </div>
              <div>
                <p className="text-3xl font-black text-green-400">{surgeries.filter(s => s.status === 'Completada').length}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Exitosas</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Nueva Solicitud */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Solicitar Equipo Médico">
        <form onSubmit={handleCreateRequest} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre del Paciente *</label>
              <input 
                required 
                className="input" 
                value={form.patient_name} 
                onChange={e => setForm({...form, patient_name: e.target.value})} 
                placeholder="Ej: Carmen Rodríguez" 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha de Cirugía *</label>
                <input 
                  required 
                  type="datetime-local" 
                  className="input" 
                  value={form.surgery_date} 
                  onChange={e => setForm({...form, surgery_date: e.target.value})} 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Procedimiento *</label>
                <select 
                  required 
                  className="input" 
                  value={form.procedure_type} 
                  onChange={e => setForm({...form, procedure_type: e.target.value})}
                >
                  <option value="">Seleccionar...</option>
                  {PROCEDURE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Hospital / Centro Médico *</label>
              <select 
                required 
                className="input" 
                value={form.hospital_id} 
                onChange={e => setForm({...form, hospital_id: e.target.value})}
              >
                <option value="">Seleccionar hospital...</option>
                {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Requerimientos Especiales (Opcional)</label>
              <textarea 
                rows={3} 
                className="input resize-none" 
                value={form.notes} 
                onChange={e => setForm({...form, notes: e.target.value})} 
                placeholder="Ej: Necesito tornillos de titanio 3.5mm..." 
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={saving} className="btn btn-primary flex-1 shadow-lg shadow-primary/30">
              {saving ? 'Enviando...' : 'Enviar Solicitud'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
