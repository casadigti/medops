import React, { useState, useEffect } from 'react';
import { surgeryService } from '../services/surgeryService';
import { surgeonService } from '../services/surgeonService';
import { hospitalService } from '../services/hospitalService';
import { trayService } from '../services/trayService';
import { PageLoader } from '../components/ui/Spinner';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { BarChart3, Download, Calendar, Users, Building2, Package, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../utils/cn';

const COLORS = ['#1e40af','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899'];

const StatCard = ({ icon: Icon, label, value, color = 'text-primary', bg = 'bg-blue-50' }) => (
  <div className="card flex items-center gap-4">
    <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', bg)}>
      <Icon size={20} className={color} />
    </div>
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  </div>
);

const SectionTitle = ({ children }) => (
  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
    <span className="w-1 h-5 bg-primary rounded-full inline-block" />
    {children}
  </h2>
);

export const Reportes = () => {
  const [surgeries, setSurgeries] = useState([]);
  const [surgeons, setSurgeons]   = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [trays, setTrays]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [period, setPeriod]       = useState('month'); // 'week' | 'month' | 'year'
  const [filterSpecialty, setFilterSpecialty] = useState('');
  const [filterHospital, setFilterHospital] = useState('');

  useEffect(() => {
    Promise.all([
      surgeryService.getAll(),
      surgeonService.getAll(),
      hospitalService.getAll(),
      trayService.getAll(),
    ]).then(([s, sur, h, t]) => {
      setSurgeries(s); setSurgeons(sur); setHospitals(h); setTrays(t);
      setLoading(false);
    });
  }, []);

  if (loading) return <PageLoader />;

  const now = new Date();

  // ── Advanced Filtering ──────────────────────────────────────────
  const applyFilters = (arr) => {
    let result = [...arr];
    
    // Period filter
    const cutoff = new Date();
    if (period === 'week')  cutoff.setDate(now.getDate() - 7);
    if (period === 'month') cutoff.setDate(now.getDate() - 30);
    if (period === 'year')  cutoff.setDate(now.getDate() - 365);
    result = result.filter(s => new Date(s.surgery_date) >= cutoff);

    // Specialty filter
    if (filterSpecialty) {
      result = result.filter(s => s.procedure_type?.toLowerCase().includes(filterSpecialty.toLowerCase()));
    }

    // Hospital filter
    if (filterHospital) {
      result = result.filter(s => s.hospital_id === filterHospital);
    }

    return result;
  };

  const filtered = applyFilters(surgeries);
  const specialties = [...new Set(surgeries.map(s => s.procedure_type))].filter(Boolean);

  // ── By Status ─────────────────────────────────────────────────
  const byStatus = ['Pendiente','En preparación','Lista','En tránsito','Entregada','Completada'].map(status => ({
    name: status, total: filtered.filter(s => s.status === status).length
  })).filter(d => d.total > 0);

  // ── By Surgeon ────────────────────────────────────────────────
  const bySurgeon = surgeons.map(sur => ({
    name: sur.full_name?.split(' ').slice(0,2).join(' ') || 'Sin asignar',
    total: filtered.filter(s => s.surgeon_id === sur.id).length,
  })).filter(d => d.total > 0).sort((a,b) => b.total - a.total).slice(0, 8);

  // ── By Hospital ───────────────────────────────────────────────
  const byHospital = hospitals.map(h => ({
    name: h.name?.split(' ').slice(0,3).join(' ') || 'Sin asignar',
    total: filtered.filter(s => s.hospital_id === h.id).length,
  })).filter(d => d.total > 0).sort((a,b) => b.total - a.total);

  // ── Tray Rotation ─────────────────────────────────────────────
  const trayUsage = trays.map(t => ({
    name: t.name?.split(' ').slice(0,3).join(' '),
    usos: filtered.filter(s => s.surgery_trays?.some(st => st.tray?.id === t.id)).length,
    esterilizaciones: t.sterilization_count,
  })).filter(d => d.usos > 0).sort((a,b) => b.usos - a.usos);

  // ── By Day (last 14 days) ─────────────────────────────────────
  const dailyData = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(now.getDate() - (13 - i));
    const label = d.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit' });
    const start = new Date(d); start.setHours(0,0,0,0);
    const end   = new Date(d); end.setHours(23,59,59,999);
    return { name: label, cirugías: surgeries.filter(s => { const dt = new Date(s.surgery_date); return dt >= start && dt <= end; }).length };
  });

  // ── Excel Export ────────────────────────────────────────────────
  const exportExcel = () => {
    const data = filtered.map(s => ({
      'Fecha': new Date(s.surgery_date).toLocaleDateString('es-ES'),
      'Paciente': s.patient_name,
      'Procedimiento': s.procedure_type,
      'Cirujano': s.surgeon?.full_name || 'N/A',
      'Hospital': s.hospital?.name || 'N/A',
      'Estado': s.status,
      'Bandejas': s.surgery_trays?.map(st => st.tray?.name).join(', ') || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Cirugías");

    // Auto-size columns
    const max_width = data.reduce((w, r) => Math.max(w, r.Paciente.length, r.Procedimiento.length), 10);
    worksheet["!cols"] = [ { wch: 12 }, { wch: 25 }, { wch: 30 }, { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 40 } ];

    XLSX.writeFile(workbook, `Reporte_MedOps_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const completed   = filtered.filter(s => s.status === 'Completada').length;
  const alertsGen   = filtered.filter(s => s.status === 'Pendiente').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Reportes y Estadísticas</h1>
          <p className="text-slate-500">Análisis operacional del sistema</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Filters Toolbar */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 shadow-sm">
            <select 
              className="bg-transparent text-xs font-bold text-slate-600 px-2 py-1 outline-none border-r border-slate-200"
              value={filterSpecialty}
              onChange={e => setFilterSpecialty(e.target.value)}
            >
              <option value="">Especialidades</option>
              {specialties.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <select 
              className="bg-transparent text-xs font-bold text-slate-600 px-2 py-1 outline-none border-r border-slate-200 max-w-[150px]"
              value={filterHospital}
              onChange={e => setFilterHospital(e.target.value)}
            >
              <option value="">Hospitales</option>
              {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>

            {/* Period selector */}
            <div className="flex gap-1 ml-1">
              {[['week','7D'],['month','30D'],['year','1A']].map(([key, label]) => (
                <button key={key} onClick={() => setPeriod(key)}
                  className={cn('px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all',
                    period === key ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600')}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={exportExcel} className="btn btn-primary gap-2 text-sm shadow-md shadow-primary/10">
            <FileSpreadsheet size={16} />Exportar Excel
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Calendar} label="Total Cirugías" value={filtered.length} />
        <StatCard icon={Users}    label="Cirujanos Activos" value={new Set(filtered.filter(s=>s.surgeon_id).map(s=>s.surgeon_id)).size} color="text-purple-600" bg="bg-purple-50" />
        <StatCard icon={Building2} label="Hospitales" value={new Set(filtered.filter(s=>s.hospital_id).map(s=>s.hospital_id)).size} color="text-teal-600" bg="bg-teal-50" />
        <StatCard icon={Package} label="Completadas" value={completed} color="text-green-600" bg="bg-green-50" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Daily Trend */}
        <div className="card">
          <SectionTitle>Tendencia Diaria (Últimos 14 días)</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dailyData} margin={{ top:5, right:5, bottom:5, left:-20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius:12, border:'none', boxShadow:'0 4px 20px rgba(0,0,0,.1)', fontSize:12 }} />
              <Line type="monotone" dataKey="cirugías" stroke="#1e40af" strokeWidth={2.5} dot={{ r:4, fill:'#1e40af' }} activeDot={{ r:6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* By Status Pie */}
        <div className="card">
          <SectionTitle>Distribución por Estado</SectionTitle>
          {byStatus.length === 0
            ? <div className="flex items-center justify-center h-[220px] text-slate-400 text-sm">Sin datos en este período</div>
            : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={byStatus} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                    {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius:12, border:'none', boxShadow:'0 4px 20px rgba(0,0,0,.1)', fontSize:12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* By Surgeon */}
        <div className="card">
          <SectionTitle>Cirugías por Cirujano</SectionTitle>
          {bySurgeon.length === 0
            ? <div className="flex items-center justify-center h-[220px] text-slate-400 text-sm">Sin datos</div>
            : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={bySurgeon} layout="vertical" margin={{ top:0, right:10, bottom:0, left:10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize:11, fill:'#475569' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius:12, border:'none', boxShadow:'0 4px 20px rgba(0,0,0,.1)', fontSize:12 }} />
                  <Bar dataKey="total" name="Cirugías" fill="#3b82f6" radius={[0,6,6,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
        </div>

        {/* By Hospital */}
        <div className="card">
          <SectionTitle>Cirugías por Hospital</SectionTitle>
          {byHospital.length === 0
            ? <div className="flex items-center justify-center h-[220px] text-slate-400 text-sm">Sin datos</div>
            : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byHospital} layout="vertical" margin={{ top:0, right:10, bottom:0, left:10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize:11, fill:'#475569' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius:12, border:'none', boxShadow:'0 4px 20px rgba(0,0,0,.1)', fontSize:12 }} />
                  <Bar dataKey="total" name="Cirugías" fill="#10b981" radius={[0,6,6,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
        </div>
      </div>

      {/* Tray Rotation Table */}
      {trayUsage.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100">
            <SectionTitle>Rotación de Bandejas / Sets</SectionTitle>
          </div>
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                {['Bandeja / Set','Usos en período','Esterilizaciones Totales','% Capacidad'].map(h => (
                  <th key={h} className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trayUsage.map((t, i) => {
                const pct = Math.min(100, Math.round((t.esterilizaciones / 200) * 100));
                return (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3.5 font-semibold text-slate-900">{t.name}</td>
                    <td className="px-6 py-3.5 text-slate-700">{t.usos}</td>
                    <td className="px-6 py-3.5 text-slate-700">{t.esterilizaciones}</td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden max-w-[100px]">
                          <div className={cn('h-full rounded-full', pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-primary')} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-sm font-medium text-slate-600">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary footer */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Tasa de Completadas', value: filtered.length ? `${Math.round((completed/filtered.length)*100)}%` : '—', sub: `${completed} de ${filtered.length} cirugías` },
          { label: 'Alertas Pendientes', value: alertsGen, sub: 'Bandejas sin preparar' },
          { label: 'Sets en Inventario', value: trays.length, sub: `${trays.filter(t=>t.status==='Disponible').length} disponibles` },
        ].map((item, i) => (
          <div key={i} className="card text-center">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{item.label}</p>
            <p className="text-4xl font-bold text-primary mt-1">{item.value}</p>
            <p className="text-xs text-slate-400 mt-1">{item.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
