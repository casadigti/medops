import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardCheck, Clock, AlertTriangle, CheckCircle2, Truck,
  ChevronRight, RefreshCw, Package,
} from 'lucide-react';
import { surgeryService } from '../services/surgeryService';
import type { Surgery, SurgeryStatus } from '../types/domain';
import { useToast } from '../components/ui/Toast';
import { PageLoader } from '../components/ui/Spinner';
import { StatusBadge } from '../components/ui/Badge';
import { cn } from '../utils/cn';
import { useRealtimeSurgeries } from '../hooks/useRealtimeSurgeries';

// ─── Status flow for technician ───────────────────────────────────────────────
const NEXT_STATUS: Partial<Record<SurgeryStatus, { label: string; status: SurgeryStatus; color: string }>> = {
  'Pendiente':      { label: 'Iniciar prep.',  status: 'En preparación', color: 'bg-blue-600 hover:bg-blue-700' },
  'En preparación': { label: 'Marcar lista',   status: 'Lista',          color: 'bg-emerald-600 hover:bg-emerald-700' },
  'Lista':          { label: 'En tránsito',    status: 'En tránsito',    color: 'bg-indigo-600 hover:bg-indigo-700' },
  'En tránsito':    { label: 'Entregada',      status: 'Entregada',      color: 'bg-purple-600 hover:bg-purple-700' },
  'Entregada':      { label: 'Completar',      status: 'Completada',     color: 'bg-slate-600 hover:bg-slate-700' },
};

const KPICard = ({
  icon: Icon, label, value, color = 'text-primary', bg = 'bg-blue-50', sub,
}: {
  icon: React.ElementType; label: string; value: number; color?: string; bg?: string; sub?: string;
}) => (
  <div className="card flex items-center gap-4">
    <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center shrink-0', bg)}>
      <Icon size={22} className={color} />
    </div>
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

const surgDateOnly = (dateStr: string) => {
  const s = dateStr.split('T')[0].split('-');
  return new Date(Number(s[0]), Number(s[1]) - 1, Number(s[2]));
};

export const PreparacionBandeja: React.FC = () => {
  const toast = useToast();
  const [surgeries, setSurgeries] = useState<Surgery[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useRealtimeSurgeries(setSurgeries, toast);

  const load = useCallback(async () => {
    try {
      const data = await surgeryService.getAll();
      setSurgeries(data || []);
    } catch {
      toast.error('Error cargando cirugías');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (surgery: Surgery, next: SurgeryStatus) => {
    setUpdatingId(surgery.id);
    try {
      const updated = await surgeryService.updateStatus(surgery.id, next);
      setSurgeries(prev => prev.map(s => s.id === surgery.id ? { ...s, ...updated } : s));
      toast.success(`${surgery.patient_name} → ${next}`);
    } catch {
      toast.error('Error actualizando estado');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) return <PageLoader />;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

  const isToday = (s: Surgery) => {
    const d = surgDateOnly(s.surgery_date);
    return d.getTime() === today.getTime();
  };

  const diff = (s: Surgery) =>
    Math.round((surgDateOnly(s.surgery_date).getTime() - today.getTime()) / 86400000);

  // KPIs
  const todayCount   = surgeries.filter(isToday).length;
  const pendingCount = surgeries.filter(s => s.status === 'Pendiente').length;
  const prepCount    = surgeries.filter(s => s.status === 'En preparación').length;
  const readyCount   = surgeries.filter(s => s.status === 'Lista').length;

  // Critical alerts: Pendiente with surgery today or tomorrow
  const criticals = surgeries
    .filter(s => s.status === 'Pendiente' && diff(s) <= 1 && diff(s) >= 0)
    .sort((a, b) => surgDateOnly(a.surgery_date).getTime() - surgDateOnly(b.surgery_date).getTime());

  // Main table: upcoming (next 60 days + today), sorted soonest first
  // Exclude Completada / Cancelada / Facturada
  const ACTIVE: SurgeryStatus[] = ['Pendiente', 'En preparación', 'Lista', 'En tránsito', 'Entregada', 'Programada'];
  const upcoming = surgeries
    .filter(s => {
      const d = surgDateOnly(s.surgery_date);
      return ACTIVE.includes(s.status) && d >= today;
    })
    .sort((a, b) => surgDateOnly(a.surgery_date).getTime() - surgDateOnly(b.surgery_date).getTime());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardCheck size={24} className="text-primary" />
            Preparación de Bandejas
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button
          onClick={load}
          className="btn btn-secondary flex items-center gap-2 text-sm"
        >
          <RefreshCw size={15} />
          Actualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={Clock}         label="Hoy"             value={todayCount}   bg="bg-blue-50"    color="text-blue-600"    sub="programadas hoy" />
        <KPICard icon={AlertTriangle} label="Por preparar"    value={pendingCount} bg="bg-amber-50"   color="text-amber-600"   sub="requieren atención" />
        <KPICard icon={Package}       label="En preparación"  value={prepCount}    bg="bg-indigo-50"  color="text-indigo-600"  sub="en proceso" />
        <KPICard icon={CheckCircle2}  label="Listas"          value={readyCount}   bg="bg-emerald-50" color="text-emerald-600" sub="para despachar" />
      </div>

      {/* Critical alerts */}
      {criticals.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 space-y-2">
          <p className="text-sm font-bold text-red-700 flex items-center gap-2">
            <AlertTriangle size={16} />
            {criticals.length} cirugía{criticals.length > 1 ? 's' : ''} crítica{criticals.length > 1 ? 's' : ''} — bandeja sin preparar
          </p>
          {criticals.map(s => {
            const next = NEXT_STATUS[s.status];
            return (
              <div key={s.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-red-100">
                <div>
                  <p className="font-bold text-slate-900">{s.patient_name}</p>
                  <p className="text-xs text-slate-500">
                    {s.hospital?.name} · {diff(s) === 0 ? '¡Hoy!' : 'Mañana'}
                  </p>
                </div>
                {next && (
                  <button
                    disabled={updatingId === s.id}
                    onClick={() => handleStatusChange(s, next.status)}
                    className={cn(
                      'text-xs font-bold text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50',
                      next.color
                    )}
                  >
                    {updatingId === s.id ? '...' : next.label}
                    <ChevronRight size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Main table */}
      <div>
        <h2 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
          <Truck size={16} className="text-primary" />
          Próximas Cirugías
          <span className="ml-auto text-xs font-normal text-slate-400">{upcoming.length} cirugías activas</span>
        </h2>

        {upcoming.length === 0 ? (
          <div className="card text-center py-12 text-slate-400">
            <CheckCircle2 size={36} className="mx-auto mb-2 text-emerald-400" />
            <p className="font-medium text-emerald-600">Sin cirugías activas próximas</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Fecha', 'Paciente', 'Procedimiento', 'Hospital', 'Cirujano', 'Bandeja(s)', 'Estado', 'Acción'].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {upcoming.map(s => {
                  const d = diff(s);
                  const next = NEXT_STATUS[s.status];
                  const trays = s.surgery_trays?.map((st: any) => st.tray?.name).filter(Boolean) || [];

                  return (
                    <tr key={s.id} className={cn(
                      'hover:bg-slate-50 transition-colors',
                      d === 0 && 'bg-amber-50/40',
                    )}>
                      {/* Fecha */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-semibold text-slate-800">
                          {surgDateOnly(s.surgery_date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                        </p>
                        <p className={cn(
                          'text-[11px] font-bold',
                          d === 0 ? 'text-red-600' : d === 1 ? 'text-amber-600' : 'text-slate-400'
                        )}>
                          {d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : `En ${d}d`}
                        </p>
                      </td>

                      {/* Paciente */}
                      <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                        {s.patient_name}
                      </td>

                      {/* Procedimiento */}
                      <td className="px-4 py-3 text-slate-600 max-w-[160px] truncate" title={s.procedure_type}>
                        {s.procedure_type || '—'}
                      </td>

                      {/* Hospital */}
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                        {s.hospital?.name || '—'}
                      </td>

                      {/* Cirujano */}
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                        {s.surgeon?.full_name || '—'}
                      </td>

                      {/* Bandejas */}
                      <td className="px-4 py-3">
                        {trays.length === 0
                          ? <span className="text-[11px] text-slate-400 italic">Sin asignar</span>
                          : (
                            <div className="flex flex-wrap gap-1">
                              {trays.slice(0, 2).map((t: string) => (
                                <span key={t} className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium truncate max-w-[100px]" title={t}>
                                  {t}
                                </span>
                              ))}
                              {trays.length > 2 && (
                                <span className="text-[11px] text-slate-400">+{trays.length - 2}</span>
                              )}
                            </div>
                          )
                        }
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3">
                        <StatusBadge status={s.status} />
                      </td>

                      {/* Acción */}
                      <td className="px-4 py-3">
                        {next ? (
                          <button
                            disabled={updatingId === s.id}
                            onClick={() => handleStatusChange(s, next.status)}
                            className={cn(
                              'text-[11px] font-bold text-white px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors disabled:opacity-50 whitespace-nowrap',
                              next.color
                            )}
                          >
                            {updatingId === s.id ? '...' : next.label}
                            <ChevronRight size={12} />
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
