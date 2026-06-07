import React, { useState, useEffect } from 'react';
import { surgeryRequestService } from '../services/surgeryRequestService';
import { Modal } from '../components/ui/Modal';
import { PageLoader, EmptyState } from '../components/ui/Spinner';
import { procedureTypeService } from '../services/procedureTypeService';
import { hospitalService } from '../services/hospitalService';
import { arsService } from '../services/arsService';
import { Plus, Calendar, Building2, Clock, ShieldCheck, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/Toast';
import { cn } from '../utils/cn';
import type { UserProfile, Surgeon, Hospital, ProcedureType, ARS, SurgeryRequest, SurgeryRequestStatus } from '../types/domain';

interface MisSolicitudesProps {
  userProfile?: Partial<UserProfile> | null;
}

const STATUS_CONFIG: Record<SurgeryRequestStatus, { label: string; color: string; icon: React.ElementType }> = {
  Pendiente: { label: 'Pendiente',  color: 'bg-amber-100 text-amber-700 border-amber-200',   icon: AlertCircle },
  Aprobada:  { label: 'Aprobada',   color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
  Rechazada: { label: 'Rechazada',  color: 'bg-red-100 text-red-700 border-red-200',          icon: XCircle },
};

const StatusBadge: React.FC<{ status: SurgeryRequestStatus }> = ({ status }) => {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.Pendiente;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border', cfg.color)}>
      <cfg.icon size={12} />
      {cfg.label}
    </span>
  );
};

export const MisSolicitudes: React.FC<MisSolicitudesProps> = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<SurgeryRequest[]>([]);
  const [surgeonProfile, setSurgeonProfile] = useState<Surgeon | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [procedureTypes, setProcedureTypes] = useState<ProcedureType[]>([]);
  const [arsList, setArsList] = useState<ARS[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    patient_name:   '',
    surgery_date:   '',
    surgery_time:   '',
    hospital_id:    '',
    procedure_type: '',
    ars_id:         '',
    nss:            '',
    notes:          '',
  });

  const fetchData = async (mounted: boolean) => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !mounted) return;

      const { data: surgeonArr } = await supabase
        .from('surgeons')
        .select('*')
        .eq('user_id', session.user.id)
        .limit(1);
      const surgeonData: Surgeon | null = surgeonArr && surgeonArr.length > 0 ? surgeonArr[0] : null;
      if (!mounted) return;
      setSurgeonProfile(surgeonData);

      const [reqs, hospitalsArr, procs, ars] = await Promise.all([
        surgeonData ? surgeryRequestService.getMySurgeonRequests(surgeonData.id) : Promise.resolve([]),
        hospitalService.getAll(),
        procedureTypeService.getAll(),
        arsService.getAll(),
      ]);
      if (!mounted) return;
      setRequests(reqs);
      setHospitals(hospitalsArr);
      setProcedureTypes(procs || []);
      setArsList(ars || []);
    } catch (err) {
      console.error('MisSolicitudes: Error fetching data:', err);
    } finally {
      if (mounted) setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    fetchData(mounted);
    return () => { mounted = false; };
  }, []);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!surgeonProfile) return;
    setSaving(true);
    try {
      const surgery_date = form.surgery_time
        ? `${form.surgery_date}T${form.surgery_time}:00`
        : `${form.surgery_date}T00:00:00`;
      await surgeryRequestService.create({
        patient_name:   form.patient_name,
        hospital_id:    form.hospital_id,
        procedure_type: form.procedure_type,
        ars_id:         form.ars_id || undefined,
        nss:            form.nss || undefined,
        notes:          form.notes,
        surgery_date,
        surgeon_id: surgeonProfile.id,
      });
      setIsModalOpen(false);
      setForm({ patient_name: '', surgery_date: '', surgery_time: '', hospital_id: '', procedure_type: '', ars_id: '', nss: '', notes: '' });
      toast.success('Solicitud enviada. El equipo de logística la revisará pronto.');
      await fetchData(true);
    } catch (err) {
      toast.error('Error al enviar la solicitud: ' + ((err as Error).message || ''));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  const pending   = requests.filter(r => r.status === 'Pendiente').length;
  const approved  = requests.filter(r => r.status === 'Aprobada').length;
  const rejected  = requests.filter(r => r.status === 'Rechazada').length;

  return (
    <div className="space-y-6">
      {/* Hero */}
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
            <p className="text-blue-100 font-medium max-w-md">
              Solicita equipos, revisa el estado de tus requerimientos y tu historial de cirugías.
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
        {/* Requests list */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Clock className="text-primary" size={20} /> Mis Solicitudes
          </h2>

          {requests.length === 0 ? (
            <EmptyState
              icon={Plus}
              title="Aún no tienes solicitudes"
              description="Haz clic en el botón de arriba para solicitar tu primer equipo médico."
            />
          ) : (
            <div className="space-y-3">
              {requests.map(r => (
                <div key={r.id} className="bg-white border border-slate-100 rounded-2xl p-5 hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status={r.status} />
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">#{r.id.slice(0, 8)}</span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900">{r.patient_name}</h3>
                      <p className="text-sm text-slate-500">{r.procedure_type}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Fecha Solicitada</p>
                      <div className="flex items-center justify-end gap-1.5 text-slate-900 font-bold text-sm">
                        <Calendar size={13} className="text-primary" />
                        {new Date(r.surgery_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-slate-50">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                      <Building2 size={13} className="text-slate-400" />
                      {r.hospital?.name ?? '—'}
                    </div>
                    {r.notes && (
                      <p className="text-xs text-slate-400 italic truncate max-w-xs">"{r.notes}"</p>
                    )}
                  </div>

                  {/* Admin notes (rejection reason or approval comment) */}
                  {r.admin_notes && (
                    <div className={cn(
                      'mt-3 px-3 py-2 rounded-lg text-xs',
                      r.status === 'Rechazada' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                    )}>
                      <span className="font-bold">Nota del equipo: </span>{r.admin_notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Stats */}
          <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Mis Estadísticas</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-2xl font-black text-amber-400">{pending}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase leading-tight">Pendientes</p>
              </div>
              <div>
                <p className="text-2xl font-black text-emerald-400">{approved}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase leading-tight">Aprobadas</p>
              </div>
              <div>
                <p className="text-2xl font-black text-red-400">{rejected}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase leading-tight">Rechazadas</p>
              </div>
            </div>
          </div>

          {/* Info card */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <ShieldCheck size={18} className="text-green-500" /> Información de Logística
            </h3>
            <div className="space-y-3">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tiempos de Respuesta</p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Solicitudes antes de las <span className="font-bold text-slate-900">4:00 PM</span> se procesan para el día siguiente.
                </p>
              </div>
              <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Soporte Técnico</p>
                <p className="text-sm text-slate-700">Para equipos de emergencia, llama directamente a logística.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New Request Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Solicitar Equipo Médico">
        <form onSubmit={handleCreateRequest} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre del Paciente *</label>
            <input
              required
              className="input"
              value={form.patient_name}
              onChange={e => setForm({ ...form, patient_name: e.target.value })}
              placeholder="Ej: Carmen Rodríguez"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha de Cirugía *</label>
              <input
                required
                type="date"
                className="input"
                value={form.surgery_date}
                onChange={e => setForm({ ...form, surgery_date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Hora (Opcional)</label>
              <input
                type="time"
                className="input"
                value={form.surgery_time}
                onChange={e => setForm({ ...form, surgery_time: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Procedimiento *</label>
              <select
                required
                className="input"
                value={form.procedure_type}
                onChange={e => setForm({ ...form, procedure_type: e.target.value })}
              >
                <option value="">Seleccionar...</option>
                {procedureTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Hospital / Centro Médico *</label>
              <select
                required
                className="input"
                value={form.hospital_id}
                onChange={e => setForm({ ...form, hospital_id: e.target.value })}
              >
                <option value="">Seleccionar hospital...</option>
                {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Aseguradora (Opcional)</label>
              <select
                className="input"
                value={form.ars_id}
                onChange={e => setForm({ ...form, ars_id: e.target.value })}
              >
                <option value="">Seleccionar ARS...</option>
                {arsList.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">No. NSS (Opcional)</label>
              <input
                type="text"
                className="input"
                value={form.nss}
                onChange={e => setForm({ ...form, nss: e.target.value })}
                placeholder="Ej: 001-0000000-0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Requerimientos Especiales (Opcional)</label>
            <textarea
              rows={3}
              className="input resize-none"
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Ej: Necesito tornillos de titanio 3.5mm..."
            />
          </div>

          <div className="flex gap-3 pt-2">
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
