import React, { useState, useEffect } from 'react';
import { surgeryService } from '../services/surgeryService';
import { StatusBadge } from '../components/ui/Badge';
import { PageLoader } from '../components/ui/Spinner';
import { Stethoscope, Calendar, Package, AlertTriangle, TrendingUp, CheckCircle2, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { cn } from '../utils/cn';
import { supabase } from '../lib/supabase';

const MetricCard = ({ icon: Icon, label, value, sub, color = 'text-primary', bg = 'bg-blue-50' }) => (
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

export const Dashboard = () => {
  const navigate = useNavigate();
  const [surgeries, setSurgeries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Carga inicial
    surgeryService.getAll().then(d => { setSurgeries(d); setLoading(false); });

    // Suscripción en Tiempo Real a la tabla surgeries
    const channel = supabase
      .channel('dashboard-surgeries')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'surgeries' }, () => {
        // Al ocurrir cualquier cambio (Insert, Update, Delete), recargamos la data.
        surgeryService.getAll().then(d => setSurgeries(d));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());

  const thisMonth = surgeries.filter(s => new Date(s.surgery_date) >= startOfMonth);
  const thisWeek  = surgeries.filter(s => new Date(s.surgery_date) >= startOfWeek);
  const pending   = surgeries.filter(s => s.status === 'Pendiente');
  const inTransit = surgeries.filter(s => ['En tránsito','Entregada'].includes(s.status));

  // Alerts
  const alerts = surgeries
    .filter(s => s.status === 'Pendiente')
    .map(s => {
      const diff = Math.ceil((new Date(s.surgery_date) - now) / 86400000);
      if (diff <= 1) return { ...s, alertType: 'critical', msg: 'Bandeja sin preparar — cirugía inmediata' };
      if (diff <= 2) return { ...s, alertType: 'urgent', msg: 'Preparar bandeja en las próximas 24h' };
      return null;
    }).filter(Boolean);

  // Upcoming (next 7 days)
  const next7 = surgeries.filter(s => {
    const d = new Date(s.surgery_date);
    const diff = (d - now) / 86400000;
    return diff >= 0 && diff <= 7;
  }).sort((a,b) => new Date(a.surgery_date) - new Date(b.surgery_date));

  // Chart: surgeries per day this week
  const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const chartData = days.map((name, i) => {
    const dayStart = new Date(startOfWeek); dayStart.setDate(startOfWeek.getDate() + i); dayStart.setHours(0,0,0,0);
    const dayEnd = new Date(dayStart); dayEnd.setHours(23,59,59,999);
    return { name, total: surgeries.filter(s => { const d = new Date(s.surgery_date); return d >= dayStart && d <= dayEnd; }).length };
  });

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Panel Principal</h1>
          <p className="text-slate-500">{new Date().toLocaleDateString('es-ES',{ weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <MetricCard icon={Calendar} label="Cirugías del Mes" value={thisMonth.length} sub={`${thisWeek.length} esta semana`} />
        <MetricCard icon={Clock} label="Pendientes Preparar" value={pending.length} color="text-amber-600" bg="bg-amber-50" sub="Requieren atención" />
        <MetricCard icon={TrendingUp} label="En Tránsito / Entregadas" value={inTransit.length} color="text-purple-600" bg="bg-purple-50" />
        <MetricCard icon={CheckCircle2} label="Completadas" value={surgeries.filter(s=>s.status==='Completada').length} color="text-green-600" bg="bg-green-50" sub="Total histórico" />
      </div>

      {/* Alerts + Chart row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Critical Alerts */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500" />
            Alertas Críticas
            {alerts.length > 0 && <span className="ml-auto text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">{alerts.length}</span>}
          </h2>
          {alerts.length === 0
            ? <div className="card text-center py-8 text-slate-400"><CheckCircle2 size={32} className="mx-auto mb-2 text-green-400" /><p className="font-medium text-green-600">Sin alertas activas</p></div>
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
                      <span className="text-xs text-slate-500">{new Date(a.surgery_date).toLocaleDateString('es-ES')}</span>
                    </div>
                    <p className="font-bold text-slate-900">{a.patient_name}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{a.msg}</p>
                    {a.surgeon && <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">Dr. {a.surgeon.full_name}</p>}
                  </div>
                ))}
              </div>
          }
        </div>

        {/* Bar Chart */}
        <div className="lg:col-span-2 card">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Cirugías Esta Semana</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top:0, right:0, bottom:0, left:-20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize:12, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize:12, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius:12, border:'none', boxShadow:'0 4px 20px rgba(0,0,0,.1)', fontSize:13 }} />
              <Bar dataKey="total" name="Cirugías" fill="#1e40af" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Upcoming Surgeries */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Stethoscope size={18} className="text-primary" />
          Próximas Cirugías (7 días)
        </h2>
        {next7.length === 0
          ? <div className="card text-center py-10 text-slate-400"><p>No hay cirugías programadas para los próximos 7 días</p></div>
          : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Paciente','Procedimiento','Cirujano','Hospital','Fecha & Hora','Estado'].map(h => (
                      <th key={h} className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {next7.map(s => {
                    const diff = Math.ceil((new Date(s.surgery_date) - now) / 86400000);
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
                          <p className="text-sm font-medium">{new Date(s.surgery_date).toLocaleDateString('es-ES')}</p>
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
