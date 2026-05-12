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
import { getLocalDateString } from '../utils/dateUtils';
import { implantService } from '../services/implantService';

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
  const [viewMode, setViewMode] = useState('operational'); // 'operational' | 'financial'
  const [consumption, setConsumption] = useState([]);

  useEffect(() => {
    Promise.all([
      surgeryService.getAll(),
      surgeonService.getAll(),
      hospitalService.getAll(),
      trayService.getAll(),
      implantService.getConsumptionReport()
    ]).then(([s, sur, h, t, c]) => {
      setSurgeries(s); setSurgeons(sur); setHospitals(h); setTrays(t); setConsumption(c);
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

  // ── Financial Data ─────────────────────────────────────────────
  const filteredConsumption = consumption.filter(c => {
    const cutoff = new Date();
    if (period === 'week') cutoff.setDate(now.getDate() - 7);
    if (period === 'month') cutoff.setDate(now.getDate() - 30);
    if (period === 'year') cutoff.setDate(now.getDate() - 365);
    return new Date(c.used_at || c.surgeries?.surgery_date) >= cutoff;
  });

  const totalCost = filteredConsumption.reduce((acc, c) => acc + (c.quantity_used * (c.implant_lots?.implants?.unit_cost || 0)), 0);
  const totalRevenue = filteredConsumption.reduce((acc, c) => acc + (c.quantity_used * (c.implant_lots?.implants?.selling_price || 0)), 0);
  const totalProfit = totalRevenue - totalCost;

  const surgeonValue = surgeons.map(sur => {
    const surCons = filteredConsumption.filter(c => c.surgeries?.surgeon_id === sur.id);
    return {
      name: sur.full_name?.split(' ').slice(0,2).join(' '),
      valor: surCons.reduce((acc, c) => acc + (c.quantity_used * (c.implant_lots?.implants?.selling_price || 0)), 0),
      costo: surCons.reduce((acc, c) => acc + (c.quantity_used * (c.implant_lots?.implants?.unit_cost || 0)), 0)
    };
  }).filter(d => d.valor > 0).sort((a,b) => b.valor - a.valor);

  const hospitalValue = hospitals.map(h => {
    const hCons = filteredConsumption.filter(c => c.surgeries?.hospital_id === h.id);
    return {
      name: h.name?.split(' ').slice(0,3).join(' '),
      venta: hCons.reduce((acc, c) => acc + (c.quantity_used * (c.implant_lots?.implants?.selling_price || 0)), 0),
      costo: hCons.reduce((acc, c) => acc + (c.quantity_used * (c.implant_lots?.implants?.unit_cost || 0)), 0)
    };
  }).map(d => ({ ...d, margen: d.venta - d.costo })).filter(d => d.venta > 0).sort((a,b) => b.venta - a.venta);

  const profitByMonth = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(now.getMonth() - (5 - i));
    const label = d.toLocaleDateString('es-ES', { month:'short' });
    const monthCons = consumption.filter(c => {
      const cDate = new Date(c.used_at || c.surgeries?.surgery_date);
      return cDate.getMonth() === d.getMonth() && cDate.getFullYear() === d.getFullYear();
    });
    return {
      name: label,
      costo: monthCons.reduce((acc, c) => acc + (c.quantity_used * (c.implant_lots?.implants?.unit_cost || 0)), 0),
      venta: monthCons.reduce((acc, c) => acc + (c.quantity_used * (c.implant_lots?.implants?.selling_price || 0)), 0)
    };
  });

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

    XLSX.writeFile(workbook, `Reporte_MedOps_${getLocalDateString()}.xlsx`);
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

      {/* Tab Switcher */}
      <div className="flex p-1 bg-slate-100 rounded-2xl w-fit">
        <button 
          onClick={() => setViewMode('operational')}
          className={cn(
            "px-6 py-2 rounded-xl text-sm font-bold transition-all",
            viewMode === 'operational' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Vista Operacional
        </button>
        <button 
          onClick={() => setViewMode('financial')}
          className={cn(
            "px-6 py-2 rounded-xl text-sm font-bold transition-all",
            viewMode === 'financial' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Vista de Negocios (Analytics Pro)
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {viewMode === 'operational' ? (
          <>
            <StatCard icon={Calendar} label="Total Cirugías" value={filtered.length} />
            <StatCard icon={Users}    label="Cirujanos Activos" value={new Set(filtered.filter(s=>s.surgeon_id).map(s=>s.surgeon_id)).size} color="text-purple-600" bg="bg-purple-50" />
            <StatCard icon={Building2} label="Hospitales" value={new Set(filtered.filter(s=>s.hospital_id).map(s=>s.hospital_id)).size} color="text-teal-600" bg="bg-teal-50" />
            <StatCard icon={Package} label="Completadas" value={completed} color="text-green-600" bg="bg-green-50" />
          </>
        ) : (
          <>
            <StatCard icon={Package} label="Venta Bruta" value={`RD$ ${totalRevenue.toLocaleString()}`} color="text-blue-600" bg="bg-blue-50" />
            <StatCard icon={Download} label="Costo Materiales" value={`RD$ ${totalCost.toLocaleString()}`} color="text-rose-600" bg="bg-rose-50" />
            <StatCard icon={BarChart3} label="Margen Bruto" value={`RD$ ${totalProfit.toLocaleString()}`} color="text-emerald-600" bg="bg-emerald-50" />
            <StatCard icon={Users} label="% Rentabilidad" value={totalRevenue ? `${Math.round((totalProfit/totalRevenue)*100)}%` : '0%'} color="text-amber-600" bg="bg-amber-50" />
          </>
        )}
      </div>

      {viewMode === 'operational' ? (
        <>
          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
        </>
      ) : (
        <>
          {/* Financial View */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Profitability Trend */}
            <div className="card">
              <SectionTitle>Costo vs Venta (Últimos 6 meses)</SectionTitle>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={profitByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value) => `RD$ ${value.toLocaleString()}`} contentStyle={{ borderRadius:12, border:'none', boxShadow:'0 4px 20px rgba(0,0,0,.1)', fontSize:12 }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize:12, paddingTop:10 }} />
                  <Bar dataKey="costo" name="Costo Material" fill="#f87171" radius={[4,4,0,0]} />
                  <Bar dataKey="venta" name="Valor Facturado" fill="#3b82f6" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Surgeon Value */}
            <div className="card">
              <SectionTitle>Facturación por Cirujano (Valor RD$)</SectionTitle>
              {surgeonValue.length === 0
                ? <div className="flex items-center justify-center h-[220px] text-slate-400 text-sm">Sin datos de consumo</div>
                : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={surgeonValue} layout="vertical" margin={{ top:0, right:30, bottom:0, left:20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={110} tick={{ fontSize:11, fill:'#475569' }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(value) => `RD$ ${value.toLocaleString()}`} contentStyle={{ borderRadius:12, border:'none', boxShadow:'0 4px 20px rgba(0,0,0,.1)', fontSize:12 }} />
                      <Bar dataKey="valor" name="Valor Consumido" fill="#8b5cf6" radius={[0,6,6,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Hospital Value */}
            <div className="card">
              <SectionTitle>Facturación por Hospital (Valor RD$)</SectionTitle>
              {hospitalValue.length === 0
                ? <div className="flex items-center justify-center h-[220px] text-slate-400 text-sm">Sin datos de consumo</div>
                : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={hospitalValue} layout="vertical" margin={{ top:0, right:30, bottom:0, left:20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={110} tick={{ fontSize:11, fill:'#475569' }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(value) => `RD$ ${value.toLocaleString('en-US', {minimumFractionDigits: 2})}`} contentStyle={{ borderRadius:12, border:'none', boxShadow:'0 4px 20px rgba(0,0,0,.1)', fontSize:12 }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize:12, paddingTop:10 }} />
                      <Bar dataKey="costo" stackId="a" name="Costo" fill="#f87171" />
                      <Bar dataKey="margen" stackId="a" name="Margen Bruto" fill="#10b981" radius={[0,6,6,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
            </div>

            {/* Insight Card */}
            <div className="card border-dashed bg-slate-50 border-slate-200 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                <Building2 size={32} className="mb-3 opacity-50 text-slate-500" />
                <h4 className="text-sm font-bold text-slate-600 mb-1">Análisis de Centros Médicos</h4>
                <p className="text-xs text-slate-500 max-w-sm">
                  Este panel te permite identificar rápidamente qué hospitales son más rentables, mostrando la relación entre el costo de los implantes utilizados y el valor facturado.
                </p>
            </div>
          </div>
          
          <div className="card border-t-4 border-t-primary">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Proyección de Compras Inteligente</h3>
                <p className="text-slate-500 text-sm">Basado en el consumo real del periodo seleccionado</p>
              </div>
              <div className="bg-blue-50 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                Motor IA Alpha
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {filteredConsumption.length === 0 ? (
                <div className="col-span-full py-8 text-center text-slate-400 italic">
                  No hay consumos suficientes para proyectar compras.
                </div>
              ) : (
                filteredConsumption.slice(0, 5).map((c, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-primary/30 transition-all group">
                    <div className="flex items-start justify-between mb-2">
                      <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-slate-100 group-hover:scale-110 transition-transform">
                        <Package size={16} className="text-primary" />
                      </div>
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md text-[10px] font-bold">
                        ALTA ROTACIÓN
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-900 mb-1 truncate" title={c.implant_lots?.implants?.name}>
                      {c.implant_lots?.implants?.name}
                    </p>
                    <p className="text-[10px] text-slate-500 mb-3 font-mono">SKU: {c.implant_lots?.implants?.sku}</p>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-black">Sugerencia</p>
                        <p className="text-xl font-black text-primary">+{c.quantity_used}</p>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold mb-1">Unidades</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Tray Rotation Table */}
      {viewMode === 'operational' && trayUsage.length > 0 && (
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
