import React, { useState, useEffect, useCallback } from 'react';
import { surgeryRequestService } from '../services/surgeryRequestService';
import { PageLoader } from '../components/ui/Spinner';
import { useToast } from '../components/ui/Toast';
import { supabase } from '../lib/supabase';
import { cn } from '../utils/cn';
import {
  CheckCircle, XCircle, AlertCircle, ClipboardList,
  Calendar, Building2, Search,
} from 'lucide-react';
import type { SurgeryRequest, SurgeryRequestStatus, Surgeon } from '../types/domain';

const STATUS_CFG: Record<SurgeryRequestStatus, { label: string; color: string; icon: React.ElementType }> = {
  Pendiente: { label: 'Pendiente', color: 'bg-amber-100 text-amber-700 border-amber-200',     icon: AlertCircle },
  Aprobada:  { label: 'Aprobada',  color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
  Rechazada: { label: 'Rechazada', color: 'bg-red-100 text-red-700 border-red-200',            icon: XCircle },
};

const StatusBadge: React.FC<{ status: SurgeryRequestStatus }> = ({ status }) => {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.Pendiente;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border', cfg.color)}>
      <cfg.icon size={12} /> {cfg.label}
    </span>
  );
};

export const SolicitudesAdmin: React.FC = () => {
  const toast = useToast();
  const [loading, setLoading]     = useState(true);
  const [requests, setRequests]   = useState<SurgeryRequest[]>([]);
  const [surgeons, setSurgeons]   = useState<Surgeon[]>([]);
  const [saving, setSaving]       = useState<string | null>(null);

  // Filters
  const [search, setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState<SurgeryRequestStatus | ''>('');
  const [filterSurgeon, setFilterSurgeon] = useState('');
  const [dateFrom, setDateFrom]   = useState('');
  const [dateTo, setDateTo]       = useState('');

  // Reject modal
  const [rejectModal, setRejectModal] = useState<{ req: SurgeryRequest } | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [reqs, { data: surgData }] = await Promise.all([
        surgeryRequestService.getAll(),
        supabase.from('surgeons').select('id,full_name').order('full_name'),
      ]);
      setRequests(reqs);
      setSurgeons((surgData ?? []) as Surgeon[]);
    } catch (err) {
      toast.error('Error cargando solicitudes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleApprove = async (req: SurgeryRequest) => {
    setSaving(req.id);
    try {
      await surgeryRequestService.approve(req.id);
      toast.success(`Solicitud de ${req.patient_name} aprobada. Cirugía creada.`);
      fetchAll();
    } catch (err) {
      toast.error('Error al aprobar: ' + (err as Error).message);
    } finally {
      setSaving(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setSaving(rejectModal.req.id);
    try {
      await surgeryRequestService.reject(rejectModal.req.id, rejectNotes);
      toast.success('Solicitud rechazada.');
      setRejectModal(null);
      setRejectNotes('');
      fetchAll();
    } catch (err) {
      toast.error('Error al rechazar: ' + (err as Error).message);
    } finally {
      setSaving(null);
    }
  };

  // Filtered list
  const filtered = requests.filter(r => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (filterSurgeon && r.surgeon_id !== filterSurgeon) return false;
    if (dateFrom && r.surgery_date < dateFrom) return false;
    if (dateTo   && r.surgery_date > dateTo + 'T23:59:59') return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !r.patient_name.toLowerCase().includes(q) &&
        !(r.surgeon?.full_name || '').toLowerCase().includes(q) &&
        !(r.procedure_type || '').toLowerCase().includes(q) &&
        !(r.hospital?.name || '').toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const counts = {
    total:     requests.length,
    pendiente: requests.filter(r => r.status === 'Pendiente').length,
    aprobada:  requests.filter(r => r.status === 'Aprobada').length,
    rechazada: requests.filter(r => r.status === 'Rechazada').length,
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ClipboardList className="text-primary" size={28} /> Solicitudes de Cirujanos
          </h1>
          <p className="text-slate-500 mt-1">{requests.length} solicitudes registradas</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total',      value: counts.total,     color: 'bg-slate-900 text-white' },
          { label: 'Pendientes', value: counts.pendiente,  color: 'bg-amber-50 text-amber-700 border border-amber-200' },
          { label: 'Aprobadas',  value: counts.aprobada,   color: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
          { label: 'Rechazadas', value: counts.rechazada,  color: 'bg-red-50 text-red-700 border border-red-200' },
        ].map(s => (
          <div key={s.label} className={cn('rounded-2xl p-5 shadow-sm', s.color)}>
            <p className="text-3xl font-black">{s.value}</p>
            <p className="text-sm font-semibold mt-1 opacity-80">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-nowrap gap-2 items-center overflow-x-auto">
        <div className="relative flex-1 min-w-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            className="input text-sm w-full"
            style={{ paddingLeft: '2rem' }}
            placeholder="Buscar paciente, cirujano, procedimiento..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input text-sm w-36 shrink-0" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
          <option value="">Todos los estados</option>
          <option value="Pendiente">Pendiente</option>
          <option value="Aprobada">Aprobada</option>
          <option value="Rechazada">Rechazada</option>
        </select>
        <select className="input text-sm w-40 shrink-0" value={filterSurgeon} onChange={e => setFilterSurgeon(e.target.value)}>
          <option value="">Todos los cirujanos</option>
          {surgeons.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
        <div className="flex items-center gap-1.5 shrink-0">
          <input type="date" className="input text-sm w-32" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <span className="text-slate-400 text-sm">—</span>
          <input type="date" className="input text-sm w-32" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        {(search || filterStatus || filterSurgeon || dateFrom || dateTo) && (
          <button className="text-xs text-slate-500 hover:text-red-500 underline whitespace-nowrap" onClick={() => { setSearch(''); setFilterStatus(''); setFilterSurgeon(''); setDateFrom(''); setDateTo(''); }}>
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Paciente','Cirujano','Procedimiento','Hospital','ARS / NSS','Fecha Solicitada','Estado','Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-[11px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-sm">Sin solicitudes que coincidan con los filtros</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3.5">
                    <p className="font-semibold text-slate-900 whitespace-nowrap">{r.patient_name}</p>
                    <p className="text-[10px] text-slate-400">#{r.id.slice(0, 8)}</p>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-slate-700 whitespace-nowrap">
                    {r.surgeon?.full_name ?? '—'}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-slate-600 max-w-[180px] truncate">
                    {r.procedure_type}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                    <span className="flex items-center gap-1"><Building2 size={12} className="text-slate-400" />{r.hospital?.name ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-[11px] font-bold text-slate-600 uppercase">{r.ars?.name ?? 'Sin ARS'}</p>
                    {r.nss && <p className="text-[10px] text-slate-400">NSS: {r.nss}</p>}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                    {new Date(r.surgery_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="space-y-1">
                      <StatusBadge status={r.status} />
                      {r.admin_notes && (
                        <p className="text-[10px] text-slate-400 italic max-w-[160px] truncate" title={r.admin_notes}>
                          "{r.admin_notes}"
                        </p>
                      )}
                      {r.notes && (
                        <p className="text-[10px] text-blue-400 italic max-w-[160px] truncate" title={r.notes}>
                          Dr: "{r.notes}"
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    {r.status === 'Pendiente' && (
                      <div className="flex gap-2">
                        <button
                          disabled={saving === r.id}
                          onClick={() => handleApprove(r)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                        >
                          {saving === r.id ? '...' : 'Aprobar'}
                        </button>
                        <button
                          disabled={saving === r.id}
                          onClick={() => { setRejectModal({ req: r }); setRejectNotes(''); }}
                          className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                      </div>
                    )}
                    {r.status === 'Aprobada' && r.surgery_id && (
                      <span className="text-xs text-emerald-600 font-semibold">Cirugía creada ✓</span>
                    )}
                    {r.status === 'Rechazada' && (
                      <span className="text-xs text-red-400 italic">Rechazada</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Rechazar solicitud</h2>
            <p className="text-sm text-slate-600">
              Estás rechazando la solicitud de <span className="font-bold">{rejectModal.req.patient_name}</span> del {rejectModal.req.surgeon?.full_name}.
            </p>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Motivo del rechazo *</label>
              <textarea
                rows={3}
                required
                className="input resize-none"
                value={rejectNotes}
                onChange={e => setRejectNotes(e.target.value)}
                placeholder="Ej: Equipo no disponible para esa fecha..."
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button className="btn btn-secondary flex-1" onClick={() => setRejectModal(null)}>Cancelar</button>
              <button
                className="btn flex-1 bg-red-600 hover:bg-red-700 text-white"
                disabled={!rejectNotes.trim() || saving === rejectModal.req.id}
                onClick={handleReject}
              >
                {saving === rejectModal.req.id ? 'Rechazando...' : 'Confirmar Rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
