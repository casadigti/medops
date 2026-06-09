import React, { useState, useEffect } from 'react';
import { surgeryService } from '../services/surgeryService';
import { implantService } from '../services/implantService';
import { StatusBadge } from '../components/ui/Badge';
import { PageLoader } from '../components/ui/Spinner';
import { Stethoscope, Calendar, Package, AlertTriangle, TrendingUp, CheckCircle2, Clock, Wifi } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { cn } from '../utils/cn';
import { supabase } from '../lib/supabase';
import type { Surgery, ImplantLot, Implant } from '../types/domain';
import { useToast } from '../components/ui/Toast';
import { useRealtimeSurgeries } from '../hooks/useRealtimeSurgeries';

const MetricCard = ({ icon: Icon, label, value, sub, color = 'text-primary', bg = 'bg-blue-50' }: { icon: React.ElementType; label: string; value: React.ReactNode; sub?: React.ReactNode; color?: string; bg?: string }) => (
  <div className="card flex items-center gap-4">
    <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center shrink-0', bg)}>
      <Icon size={22} className={color} />
    </div>
    <div>
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="text-3xl font-bold text-slate-900 leading-tight">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [surgeries, setSurgeries] = useState<Surgery[]>([]);
  const [expiringLots, setExpiringLots] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<Implant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useRealtimeSurgeries(setSurgeries, toast);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        setError(null);
        const [sData, iData, lsData] = await Promise.all([
          surgeryService.getAll(),
          implantService.getExpiringLots(),
          implantService.getLowStockImplants()
        ]);
        if (mounted) {
          setSurgeries(sData || []);
          setExpiringLots(iData || []);
          setLowStock(lsData || []);
          setLastUpdated(new Date());
          setLoading(false);
        }
      } catch (err) {
        console.error('Dashboard: Error loading surgeries:', err);
        if (mounted) {
          setError('No se pudieron cargar los datos. Intenta recargar.');
          setSurgeries([]);
          setLoading(false);
        }
      }
    };

    loadData();

    let channel: ReturnType<typeof supabase.channel> | null = null;
    const setupRealtime = () => {
      channel = supabase
        .channel(`dashboard-surgeries-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'surgeries' }, () => {
          if (mounted) {
            surgeryService.getAll()
              .then(d => { if (mounted) setSurgeries(d || []); })
              .catch(() => {});
          }
        })
        .subscribe();
    };

    const realtimeTimer = setTimeout(setupRealtime, 2000);

    const refreshInterval = setInterval(async () => {
      if (!mounted) return;
      try {
        const [iData, lsData] = await Promise.all([
          implantService.getExpiringLots(),
          implantService.getLowStockImplants()
        ]);
        if (mounted) {
          setExpiringLots(iData || []);
          setLowStock(lsData || []);
          setLastUpdated(new Date());
        }
      } catch { /* silent */ }
    }, 60000);

    return () => {
      mounted = false;
      clearTimeout(realtimeTimer);
      clearInterval(refreshInterval);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const now = new Date();
  // today = medianoche local (sin hora) para comparaciones de fecha pura
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());

  // Normaliza surgery_date a medianoche local ignorando cualquier componente de hora/zona
  const surgDateOnly = (dateStr: string) => {
    const s = dateStr.split('T')[0].split('-');
    return new Date(Number(s[0]), Number(s[1]) - 1, Number(s[2]));
  };
  const surgDiff = (dateStr: string) =>
    Math.round((surgDateOnly(dateStr).getTime() - today.getTime()) / 86400000);

  const thisMonth = surgeries.filter(s => surgDateOnly(s.surgery_date) >= startOfMonth);
  const thisWeek  = surgeries.filter(s => surgDateOnly(s.surgery_date) >= startOfWeek);
  const pending   = surgeries.filter(s => s.status === 'Pendiente');
  const inTransit = surgeries.filter(s => ['En tránsito','Entregada'].includes(s.status));

  const alerts = (surgeries
    .filter(s => s.status === 'Pendiente')
    .map(s => {
      const diff = surgDiff(s.surgery_date);
      if (diff <= 1) return { ...s, alertType: 'critical', msg: 'Bandeja sin preparar — cirugía inmediata' };
      if (diff <= 2) return { ...s, alertType: 'urgent', msg: 'Preparar bandeja en las próximas 24h' };
      return null;
    }).filter(Boolean)) as Array<Surgery & { alertType: string; msg: string }>;

  const next10 = surgeries.filter(s => {
    const diff = surgDiff(s.surgery_date);
    return diff >= 0 && diff <= 30;
  })
  .sort((a,b) => new Date(a.surgery_date).getTime() - new Date(b.surgery_date).getTime())
  .slice(0, 10);

  const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const chartData = days.map((name, i) => {
    const dayStart = new Date(startOfWeek);
    dayStart.setDate(startOfWeek.getDate() + i);
    dayStart.setHours(0,0,0,0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23,59,59,999);

    return {
      name,
      cirugías: surgeries.filter(s => {
        const d = surgDateOnly(s.surgery_date);
        return d >= dayStart && d <= dayEnd;
      }).length
    };
  });

  if (loading) return <PageLoader />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle size={48} className="text-amber-400" />
        <p className="text-slate-600 font-medium">{error}</p>
        <button
          onClick={() => { setLoading(true); setError(null); surgeryService.getAll().then(d => { setSurgeries(d || []); setLoading(false); }).catch(() => { setError('Error al recargar.'); setLoading(false); }); }}
          className="px-6 py-2 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Panel Principal</h1>
          <p className="text-slate-500">{new Date().toLocaleDateString('es-ES',{ weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <Wifi size={12} className="text-emerald-600" />
            <span className="text-xs font-bold text-emerald-700">En vivo</span>
          </div>
          {lastUpdated && (
            <span className="text-[11px] text-slate-400 font-medium hidden sm:block">
              Actualizado: {lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <MetricCard icon={Calendar} label="Cirugías del Mes" value={thisMonth.length} sub={`${thisWeek.length} esta semana`} />
        <MetricCard icon={Clock} label="Pendientes Preparar" value={pending.length} color="text-amber-600" bg="bg-amber-50" sub="Requieren atención" />
        <MetricCard icon={AlertTriangle} label="Inventario Crítico" value={expiringLots.length + lowStock.length} color="text-rose-600" bg="bg-rose-50" sub="Vencimientos / Stock Bajo" />
        <MetricCard icon={CheckCircle2} label="Completadas" value={surgeries.filter(s=>s.status==='Completada').length} color="text-green-600" bg="bg-green-50" sub="Total histórico" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500" />
            Alertas de Cirugías
            {alerts.length > 0 && <span className="ml-auto text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">{alerts.length}</span>}
          </h2>
          {alerts.length === 0
            ? <div className="card text-center py-8 text-slate-400"><CheckCircle2 size={32} className="mx-auto mb-2 text-green-400" /><p className="font-medium text-green-600">Sin alertas de pacientes</p></div>
            : <div className="space-y-3">
                {alerts.map(a => (
                  <div
                    key={a.id}
                    onClick={() => navigate(`/cirugias?q=${encodeURIComponent(a.patient_name)}`)}
                    className={cn(
                      'p-4 rounded-2xl border cursor-pointer hover:shadow-md transition-all active:scale-[0.98]',
                      a.alertType==='critical' ? 'bg-red-50 border-red-200 hover:border-red-400' : 'bg-amber-50 border-amber-200 hover:border-amber-400'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider text-white', a.alertType==='critical' ? 'bg-red-500' : 'bg-amber-500')}>
                        {a.alertType==='critical' ? 'Crítico' : 'Urgente'}
                      </span>
                      <span className="text-xs text-slate-500">{surgDateOnly(a.surgery_date).toLocaleDateString('es-ES')}</span>
                    </div>
                    <p className="font-bold text-slate-900">{a.patient_name}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{a.msg}</p>
                  </div>
                ))}
              </div>
          }
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Package size={18} className="text-rose-500" />
            Alertas de Inventario
            {(lowStock.length + expiringLots.length) > 0 && (
              <span className="ml-auto text-xs bg-rose-500 text-white px-2 py-0.5 rounded-full">
                {lowStock.length + expiringLots.length}
              </span>
            )}
          </h2>
          {(lowStock.length + expiringLots.length) === 0
            ? <div className="card text-center py-8 text-slate-400"><CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-400" /><p className="font-medium text-emerald-600">Stock en niveles óptimos</p></div>
            : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {lowStock.map(item => (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/inventario?q=${encodeURIComponent(item.sku)}`)}
                    className="p-4 rounded-2xl bg-rose-50 border border-rose-200 cursor-pointer hover:border-rose-400 transition-all hover:shadow-md"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-rose-500 text-white">
                        Stock Crítico
                      </span>
                      <AlertTriangle size={14} className="text-rose-500" />
                    </div>
                    <p className="font-bold text-slate-900">{item.name}</p>
                    <p className="text-xs text-rose-700 font-medium mt-1">
                      ¡Atención! Solo quedan {item.implant_lots?.reduce((acc: number, l: ImplantLot) => acc + (l.current_quantity || 0), 0) || 0} unidades.
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1 uppercase">Mínimo requerido: {item.min_stock}</p>
                  </div>
                ))}

                {expiringLots.map(lot => (
                  <div
                    key={lot.id}
                    onClick={() => navigate('/inventario')}
                    className="p-4 rounded-2xl bg-amber-50 border border-amber-200 cursor-pointer hover:border-amber-400 transition-all hover:shadow-md"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-amber-500 text-white">
                        Vencimiento Próximo
                      </span>
                      <Clock size={14} className="text-amber-500" />
                    </div>
                    <p className="font-bold text-slate-900">{lot.implants?.name}</p>
                    <p className="text-xs text-amber-700 font-medium mt-1">
                      Lote {lot.lot_number} vence el {new Date(lot.expiration_date).toLocaleDateString('es-ES')}.
                    </p>
                  </div>
                ))}
              </div>
            )}
        </div>

        <div className="space-y-4">
          <div className="card">
            <h2 className="text-lg font-bold text-slate-900 mb-6">Cirugías Esta Semana</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top:0, right:0, bottom:0, left:-20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius:'12px', border:'none', boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}} />
                <Bar dataKey="cirugías" fill="#1e40af" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Stethoscope size={18} className="text-primary" />
          Próximas Cirugías
        </h2>
        {next10.length === 0
          ? <div className="card text-center py-10 text-slate-400"><p>No hay cirugías programadas</p></div>
          : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Paciente','Procedimiento','Cirujano','Hospital','Fecha & Hora','Estado'].map(h => (
                      <th key={h} className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {next10.map(s => {
                    const diff = surgDiff(s.surgery_date);
                    return (
                      <tr
                        key={s.id}
                        onClick={() => navigate(`/cirugias?q=${encodeURIComponent(s.patient_name)}`)}
                        className="hover:bg-slate-50 transition-colors cursor-pointer group"
                      >
                        <td className="px-5 py-3.5 font-semibold text-slate-900 group-hover:text-primary transition-colors">{s.patient_name}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-600 max-w-[180px] truncate">{s.procedure_type}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-700 whitespace-nowrap">{s.surgeon?.full_name || '—'}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-700 whitespace-nowrap">{s.hospital?.name || '—'}</td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <p className="text-sm font-medium">{surgDateOnly(s.surgery_date).toLocaleDateString('es-ES')}</p>
                          <p className={cn('text-xs font-semibold', diff===0?'text-red-600':diff===1?'text-amber-600':'text-slate-400')}>
                            {diff===0?'Hoy':diff===1?'Mañana':`En ${diff} días`}
                          </p>
                        </td>
                        <td className="px-5 py-3.5"><StatusBadge status={s.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
    </div>
  );
};
