import React, { useState, useEffect } from 'react';
import type { Surgery, Surgeon, Hospital, Tray, SurgeryConsumption, Implant } from '../types/domain';
import { surgeryService } from '../services/surgeryService';
import { surgeonService } from '../services/surgeonService';
import { hospitalService } from '../services/hospitalService';
import { trayService } from '../services/trayService';
import { PageLoader } from '../components/ui/Spinner';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { BarChart3, Download, Calendar, Users, Building2, Package, FileSpreadsheet, Printer, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../utils/cn';
import { getLocalDateString } from '../utils/dateUtils';
import { implantService } from '../services/implantService';

const COLORS = ['#1e40af','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899'];

const StatCard = ({ icon: Icon, label, value, color = 'text-primary', bg = 'bg-blue-50' }: { icon: React.ElementType; label: string; value: React.ReactNode; color?: string; bg?: string }) => (
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

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
    <span className="w-1 h-5 bg-primary rounded-full inline-block" />
    {children}
  </h2>
);

export const Reportes: React.FC = () => {
  const [surgeries, setSurgeries] = useState<Surgery[]>([]);
  const [surgeons, setSurgeons]   = useState<Surgeon[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [trays, setTrays]         = useState<Tray[]>([]);
  const [loading, setLoading]     = useState(true);
  const [period, setPeriod]       = useState('month');
  const [filterSpecialty, setFilterSpecialty] = useState('');
  const [filterHospital, setFilterHospital] = useState('');
  const [viewMode, setViewMode] = useState('operational');
  const [consumption, setConsumption] = useState<SurgeryConsumption[]>([]);
  const [allImplants, setAllImplants] = useState<Implant[]>([]);
  const [filterSurgeon, setFilterSurgeon] = useState('');

  useEffect(() => {
    Promise.all([
      surgeryService.getAll(),
      surgeonService.getAll(),
      hospitalService.getAll(),
      trayService.getAll(),
      implantService.getConsumptionReport(),
      implantService.getAll()
    ]).then(([s, sur, h, t, c, imp]) => {
      setSurgeries(s); setSurgeons(sur); setHospitals(h); setTrays(t);
      setConsumption(c); setAllImplants(imp);
      setLoading(false);
    });
  }, []);

  if (loading) return <PageLoader />;

  const now = new Date();

  const applyFilters = (arr: any[]) => {
    let result = [...arr];

    const cutoff = new Date();
    if (period === 'week')  cutoff.setDate(now.getDate() - 7);
    if (period === 'month') cutoff.setDate(now.getDate() - 30);
    if (period === 'year')  cutoff.setDate(now.getDate() - 365);
    result = result.filter(s => new Date(s.surgery_date) >= cutoff);

    if (filterSpecialty) {
      result = result.filter(s => s.procedure_type?.toLowerCase().includes(filterSpecialty.toLowerCase()));
    }

    if (filterHospital) {
      result = result.filter(s => s.hospital_id === filterHospital);
    }

    return result;
  };

  const filtered = applyFilters(surgeries);
  const specialties = [...new Set(surgeries.map(s => s.procedure_type))].filter(Boolean);

  const byStatus = ['Pendiente','En preparación','Lista','En tránsito','Entregada','Completada'].map(status => ({
    name: status, total: filtered.filter(s => s.status === status).length
  })).filter(d => d.total > 0);

  const bySurgeon = surgeons.map(sur => ({
    name: sur.full_name?.split(' ').slice(0,2).join(' ') || 'Sin asignar',
    total: filtered.filter(s => s.surgeon_id === sur.id).length,
  })).filter(d => d.total > 0).sort((a,b) => b.total - a.total).slice(0, 8);

  const byHospital = hospitals.map(h => ({
    name: h.name?.split(' ').slice(0,3).join(' ') || 'Sin asignar',
    total: filtered.filter(s => s.hospital_id === h.id).length,
  })).filter(d => d.total > 0).sort((a,b) => b.total - a.total);

  const trayUsage = trays.map(t => ({
    name: t.name?.split(' ').slice(0,3).join(' '),
    usos: filtered.filter(s => s.surgery_trays?.some((st: any) => st.tray?.id === t.id)).length,
    esterilizaciones: t.sterilization_count ?? 0,
  })).filter(d => d.usos > 0).sort((a,b) => b.usos - a.usos);

  const filteredConsumption = consumption.filter(c => {
    const cutoff = new Date();
    if (period === 'week') cutoff.setDate(now.getDate() - 7);
    if (period === 'month') cutoff.setDate(now.getDate() - 30);
    if (period === 'year') cutoff.setDate(now.getDate() - 365);
    return new Date(c.used_at ?? c.surgeries?.surgery_date ?? '') >= cutoff;
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
      const cDate = new Date(c.used_at ?? c.surgeries?.surgery_date ?? '');
      return cDate.getMonth() === d.getMonth() && cDate.getFullYear() === d.getFullYear();
    });
    return {
      name: label,
      costo: monthCons.reduce((acc, c) => acc + (c.quantity_used * (c.implant_lots?.implants?.unit_cost || 0)), 0),
      venta: monthCons.reduce((acc, c) => acc + (c.quantity_used * (c.implant_lots?.implants?.selling_price || 0)), 0)
    };
  });

  const dailyData = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(now.getDate() - (13 - i));
    const label = d.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit' });
    const start = new Date(d); start.setHours(0,0,0,0);
    const end   = new Date(d); end.setHours(23,59,59,999);
    return { name: label, cirugías: surgeries.filter(s => { const dt = new Date(s.surgery_date); return dt >= start && dt <= end; }).length };
  });

  const exportExcel = () => {
    const data = filtered.map(s => ({
      'Fecha': new Date(s.surgery_date).toLocaleDateString('es-ES'),
      'Paciente': s.patient_name,
      'Procedimiento': s.procedure_type,
      'Cirujano': s.surgeon?.full_name || 'N/A',
      'Hospital': s.hospital?.name || 'N/A',
      'Estado': s.status,
      'Bandejas': s.surgery_trays?.map((st: any) => st.tray?.name).join(', ') || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Cirugías");

    worksheet["!cols"] = [ { wch: 12 }, { wch: 25 }, { wch: 30 }, { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 40 } ];

    XLSX.writeFile(workbook, `Reporte_MedOps_${getLocalDateString()}.xlsx`);
  };

  const completed   = filtered.filter(s => s.status === 'Completada').length;
  const alertsGen   = filtered.filter(s => s.status === 'Pendiente').length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Reportes y Estadísticas</h1>
          <p className="text-slate-500">Análisis operacional del sistema</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
                      <Pie data={byStatus} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }: any) => `${name} ${((percent ?? 0)*100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                        {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius:12, border:'none', boxShadow:'0 4px 20px rgba(0,0,0,.1)', fontSize:12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
            </div>
          </div>

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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <SectionTitle>Costo vs Venta (Últimos 6 meses)</SectionTitle>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={profitByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value: any) =>`RD$ ${(value ?? 0).toLocaleString()}`} contentStyle={{ borderRadius:12, border:'none', boxShadow:'0 4px 20px rgba(0,0,0,.1)', fontSize:12 }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize:12, paddingTop:10 }} />
                  <Bar dataKey="costo" name="Costo Material" fill="#f87171" radius={[4,4,0,0]} />
                  <Bar dataKey="venta" name="Valor Facturado" fill="#3b82f6" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

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
                      <Tooltip formatter={(value: any) =>`RD$ ${(value ?? 0).toLocaleString()}`} contentStyle={{ borderRadius:12, border:'none', boxShadow:'0 4px 20px rgba(0,0,0,.1)', fontSize:12 }} />
                      <Bar dataKey="valor" name="Valor Consumido" fill="#8b5cf6" radius={[0,6,6,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
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
                      <Tooltip formatter={(value: any) =>`RD$ ${(value ?? 0).toLocaleString('en-US', {minimumFractionDigits: 2})}`} contentStyle={{ borderRadius:12, border:'none', boxShadow:'0 4px 20px rgba(0,0,0,.1)', fontSize:12 }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize:12, paddingTop:10 }} />
                      <Bar dataKey="costo" stackId="a" name="Costo" fill="#f87171" />
                      <Bar dataKey="margen" stackId="a" name="Margen Bruto" fill="#10b981" radius={[0,6,6,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <SectionTitle>Implantes por Cirujano</SectionTitle>
                  <p className="text-xs text-slate-400 mt-0.5">Análisis de preferencia — diferenciador para negociar con proveedores</p>
                </div>
                <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-2.5 py-1 rounded-full uppercase tracking-wider">Inteligencia Comercial</span>
              </div>
              {filteredConsumption.length === 0 ? (
                <div className="flex items-center justify-center h-[180px] text-slate-400 text-sm">Sin datos en el período</div>
              ) : (() => {
                const bySurgeonImplant: Record<string, Record<string, { sku: string; qty: number; cost: number }>> = {};
                filteredConsumption.forEach(c => {
                  const surgeonName = c.surgeries?.surgeon?.full_name || 'Sin asignar';
                  const implantName = c.implant_lots?.implants?.name || 'Desconocido';
                  const sku  = c.implant_lots?.implants?.sku || '—';
                  const qty  = c.quantity_used || 0;
                  const cost = qty * (c.implant_lots?.implants?.unit_cost || 0);
                  if (!bySurgeonImplant[surgeonName]) bySurgeonImplant[surgeonName] = {};
                  if (!bySurgeonImplant[surgeonName][implantName])
                    bySurgeonImplant[surgeonName][implantName] = { sku, qty: 0, cost: 0 };
                  bySurgeonImplant[surgeonName][implantName].qty  += qty;
                  bySurgeonImplant[surgeonName][implantName].cost += cost;
                });

                const totalGlobalCost = filteredConsumption.reduce((s, c) =>
                  s + (c.quantity_used || 0) * (c.implant_lots?.implants?.unit_cost || 0), 0);

                const allRows = Object.entries(bySurgeonImplant).map(([surgeon, implants]) => {
                  const top = Object.entries(implants).sort((a, b) => b[1].qty - a[1].qty)[0];
                  const surgeonTotal = Object.values(implants).reduce((s, v) => s + v.cost, 0);
                  return { surgeon, topImplant: top[0], sku: top[1].sku, qty: top[1].qty,
                    cost: surgeonTotal, pct: totalGlobalCost > 0 ? Math.round((surgeonTotal / totalGlobalCost) * 100) : 0 };
                }).sort((a, b) => b.cost - a.cost);

                const surgeonNames = allRows.map(r => r.surgeon);
                const rows = filterSurgeon ? allRows.filter(r => r.surgeon === filterSurgeon) : allRows;
                const periodLabel = period === 'week' ? 'Últimos 7 días' : period === 'month' ? 'Últimos 30 días' : 'Último año';

                const exportPDF = () => {
                  const win = window.open('', '_blank', 'width=950,height=700');
                  if (!win) return;
                  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
                    <title>Implantes por Cirujano — MedOps</title>
                    <style>
                      *{margin:0;padding:0;box-sizing:border-box}
                      body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;padding:32px}
                      .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #7c3aed;padding-bottom:16px;margin-bottom:24px}
                      .brand{font-size:22px;font-weight:900;color:#7c3aed}
                      .sub{font-size:11px;color:#64748b;margin-top:2px}
                      .meta{text-align:right;font-size:11px;color:#64748b}
                      .meta b{display:block;font-size:13px;color:#1e293b;margin-bottom:2px}
                      h2{font-size:16px;font-weight:700;margin-bottom:4px}
                      .tag{display:inline-block;background:#ede9fe;color:#7c3aed;font-size:9px;font-weight:700;padding:2px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:14px}
                      table{width:100%;border-collapse:collapse;font-size:12px}
                      thead tr{background:#7c3aed;color:#fff}
                      th{padding:10px 12px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;text-align:left}
                      td{padding:9px 12px;border-bottom:1px solid #f1f5f9}
                      tr:nth-child(even) td{background:#faf5ff}
                      .footer{margin-top:24px;font-size:10px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:12px}
                    </style></head><body>
                    <div class="hdr">
                      <div><div class="brand">MedOps</div><div class="sub">Gestión Médica · Inteligencia Comercial</div></div>
                      <div class="meta"><b>Implantes por Cirujano</b>Período: ${periodLabel} · ${new Date().toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}</div>
                    </div>
                    <h2>Análisis de Frecuencia de Implantes</h2>
                    <span class="tag">Inteligencia Comercial</span>
                    <table><thead><tr>
                      <th>Cirujano</th><th>Implante Más Usado</th><th>SKU</th>
                      <th style="text-align:center">Usos</th><th>Gasto Total</th><th style="text-align:center">% del Total</th>
                    </tr></thead><tbody>
                    ${rows.map(r => `<tr><td>${r.surgeon}</td><td>${r.topImplant}</td>
                      <td style="font-family:monospace">${r.sku}</td>
                      <td style="text-align:center">${r.qty}</td>
                      <td>RD$ ${r.cost.toLocaleString('en-US',{minimumFractionDigits:2})}</td>
                      <td style="text-align:center">${r.pct}%</td></tr>`).join('')}
                    </tbody></table>
                    <div class="footer">Generado por MedOps · ${new Date().toLocaleString('es-ES')} · Confidencial — Solo para uso interno</div>
                    </body></html>`);
                  win.document.close();
                  setTimeout(() => { win.focus(); win.print(); }, 400);
                };

                return (
                  <>
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                        <Filter size={13} className="text-slate-400" />
                        <select value={filterSurgeon} onChange={e => setFilterSurgeon(e.target.value)}
                          className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer">
                          <option value="">Todos los cirujanos</option>
                          {surgeonNames.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                      <button onClick={exportPDF}
                        className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm">
                        <Printer size={14} />Exportar PDF
                      </button>
                      {filterSurgeon && (
                        <button onClick={() => setFilterSurgeon('')} className="text-xs text-slate-400 hover:text-slate-700 underline">
                          Limpiar filtro
                        </button>
                      )}
                    </div>
                    <div className="overflow-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100">
                            {['Cirujano','Implante Más Usado','SKU','Usos','Gasto Total','% del Total'].map(h => (
                              <th key={h} className="py-2 pr-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, i) => (
                            <tr key={i} className="border-b border-slate-50 hover:bg-violet-50/40 transition-colors">
                              <td className="py-3 pr-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-black text-[10px] shrink-0">
                                    {row.surgeon.split(' ').map(n => n[0]).slice(0,2).join('')}
                                  </div>
                                  <span className="font-semibold text-slate-800 whitespace-nowrap">{row.surgeon}</span>
                                </div>
                              </td>
                              <td className="py-3 pr-4 font-medium text-slate-700 max-w-[180px] truncate">{row.topImplant}</td>
                              <td className="py-3 pr-4 font-mono text-slate-500">{row.sku}</td>
                              <td className="py-3 pr-4"><span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-bold">{row.qty}</span></td>
                              <td className="py-3 pr-4 font-bold text-slate-800">RD$ {row.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                              <td className="py-3">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full min-w-[60px]">
                                    <div className="h-1.5 rounded-full bg-violet-500" style={{ width: `${row.pct}%` }} />
                                  </div>
                                  <span className="font-bold text-violet-700 text-[11px] w-8">{row.pct}%</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
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
              ) : (() => {
                const periodDays = period === 'week' ? 7 : period === 'month' ? 30 : 365;

                const aggregated = (Object.values(
                  filteredConsumption.reduce((acc: Record<string, any>, c: SurgeryConsumption) => {
                    const implantId = c.implant_lots?.implants?.id || c.implant_lots?.implant_id;
                    const key = c.implant_lots?.implants?.sku || implantId || c.implant_lot_id;
                    if (!key) return acc;
                    if (!acc[key]) {
                      acc[key] = {
                        key,
                        implantId,
                        name: c.implant_lots?.implants?.name,
                        sku: c.implant_lots?.implants?.sku,
                        totalQty: 0,
                      };
                    }
                    acc[key].totalQty += (c.quantity_used || 0);
                    return acc;
                  }, {})
                ) as any[]).sort((a, b) => b.totalQty - a.totalQty).slice(0, 5);

                return aggregated.map((item, i) => {
                  const implantData = allImplants.find(imp =>
                    imp.sku === item.sku || imp.id === item.implantId
                  );
                  const currentStock = (implantData?.implant_lots || [])
                    .reduce((s, lot) => s + (lot.current_quantity || 0), 0);
                  const dailyRate = item.totalQty / periodDays;
                  const daysLeft = dailyRate > 0 ? Math.floor(currentStock / dailyRate) : null;

                  const urgency = daysLeft === null ? 'ok'
                    : daysLeft < 7  ? 'critical'
                    : daysLeft < 30 ? 'warning'
                    : 'ok';

                  const stockLabel = (() => {
                    if (daysLeft === null) return '—';
                    if (daysLeft < 7)  return `${daysLeft} días ⚠️`;
                    if (daysLeft < 30) return `${daysLeft} días`;
                    const months = Math.round(daysLeft / 30);
                    return `~${months} ${months === 1 ? 'mes' : 'meses'}`;
                  })();

                  const urgencyStyles = {
                    critical: { badge: 'bg-red-100 text-red-700',    dot: 'bg-red-500',    label: stockLabel },
                    warning:  { badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500',  label: stockLabel },
                    ok:       { badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', label: stockLabel },
                  }[urgency];

                  return (
                    <div key={item.key || i} className={`p-4 rounded-2xl bg-slate-50 border transition-all group ${urgency === 'critical' ? 'border-red-200 hover:border-red-400' : 'border-slate-100 hover:border-primary/30'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-slate-100 group-hover:scale-110 transition-transform">
                          <Package size={16} className="text-primary" />
                        </div>
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md text-[10px] font-bold">
                          ALTA ROTACIÓN
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-900 mb-0.5 truncate" title={item.name}>
                        {item.name}
                      </p>
                      <p className="text-[10px] text-slate-500 mb-3 font-mono">SKU: {item.sku}</p>

                      <div className={`flex items-center gap-1.5 mb-3 px-2 py-1 rounded-lg ${urgencyStyles.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${urgencyStyles.dot} ${urgency === 'critical' ? 'animate-pulse' : ''}`} />
                        <span className="text-[10px] font-bold">
                          {daysLeft !== null ? `Stock: ${urgencyStyles.label} restantes` : 'Stock no calculado'}
                        </span>
                      </div>

                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-black">Sugerencia</p>
                          <p className="text-xl font-black text-primary">+{item.totalQty}</p>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold mb-1">Unidades</p>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </>
      )}

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
