import React, { useState, useEffect } from 'react';
import { ShoppingCart, Calendar, Download, Search, Filter, ArrowLeft, Printer, FileText } from 'lucide-react';
import { implantService } from '../services/implantService';
import { useToast } from '../components/ui/Toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '../utils/cn';

export const ReporteReposicion = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [dateRange, setDateRange] = useState({
    start: format(new Date().setDate(new Date().getDate() - 7), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  const fetchReport = async () => {
    try {
      setLoading(true);
      const reportData = await implantService.getConsumptionReport(
        dateRange.start ? new Date(dateRange.start + 'T00:00:00').toISOString() : null,
        dateRange.end ? new Date(dateRange.end + 'T23:59:59').toISOString() : null
      );
      setData(reportData);
    } catch (error) {
      toast.error('Error al generar reporte: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const [view, setView] = useState('material'); // 'material' or 'surgery'
  const [search, setSearch] = useState('');

  // Agrupar por producto para saber qué reponer
  const materialSummary = data.reduce((acc, curr) => {
    const productId = curr.implant_lots?.implants?.id;
    if (!productId) return acc;
    
    const name = curr.implant_lots.implants.name;
    const sku = curr.implant_lots.implants.sku;

    // Filtrar por búsqueda
    if (search && !name.toLowerCase().includes(search.toLowerCase()) && !sku.toLowerCase().includes(search.toLowerCase())) {
      return acc;
    }
    
    if (!acc[productId]) {
      acc[productId] = {
        name,
        sku,
        category: curr.implant_lots.implants.category,
        unit_cost: curr.implant_lots.implants.unit_cost || 0,
        total_used: 0,
        surgeries: []
      };
    }
    
    acc[productId].total_used += curr.quantity_used;
    acc[productId].surgeries.push({
      patient: curr.surgeries?.patient_name,
      date: curr.surgeries?.surgery_date,
      hospital: curr.surgeries?.hospital?.name,
      qty: curr.quantity_used,
      auth: curr.auth_number
    });
    
    return acc;
  }, {});

  // Agrupar por cirugía para ver el gasto por paciente
  const surgeriesSummary = data.reduce((acc, curr) => {
    const surgeryId = curr.surgeries?.id;
    if (!surgeryId) return acc;
    
    const patient = curr.surgeries.patient_name;
    const hospital = curr.surgeries.hospital?.name || '';

    // Filtrar por búsqueda
    if (search && !patient.toLowerCase().includes(search.toLowerCase()) && !hospital.toLowerCase().includes(search.toLowerCase())) {
      return acc;
    }
    
    if (!acc[surgeryId]) {
      acc[surgeryId] = {
        patient,
        date: curr.surgeries.surgery_date,
        hospital,
        total_cost: 0,
        items_count: 0
      };
    }
    
    const cost = (curr.implant_lots?.implants?.unit_cost || 0) * curr.quantity_used;
    acc[surgeryId].total_cost += cost;
    acc[surgeryId].items_count += curr.quantity_used;
    
    return acc;
  }, {});

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header - Hidden on print */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Reporte de Gasto y Reposición</h1>
          <p className="text-slate-500">Analítica financiera y logística de materiales consumidos</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="btn btn-secondary flex items-center gap-2">
            <Printer size={18} /> Imprimir
          </button>
          <button className="btn btn-primary flex items-center gap-2 shadow-lg shadow-primary/20">
            <Download size={18} /> Exportar
          </button>
        </div>
      </div>

      {/* View Toggle & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex p-1 bg-slate-100 rounded-xl w-fit">
          <button 
            onClick={() => setView('material')}
            className={cn(
              "px-6 py-2 rounded-lg text-xs font-bold transition-all",
              view === 'material' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Resumen por Material
          </button>
          <button 
            onClick={() => setView('surgery')}
            className={cn(
              "px-6 py-2 rounded-lg text-xs font-bold transition-all",
              view === 'surgery' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Resumen por Cirugía
          </button>
        </div>

        <div className="relative flex-1 md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          <input 
            className="input w-full text-sm" 
            style={{ paddingLeft: '2.5rem' }}
            placeholder={view === 'material' ? "Buscar por producto o SKU..." : "Buscar por paciente u hospital..."}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Filters - Hidden on print */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-end gap-4 print:hidden">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Desde</label>
          <div className="relative">
            <input 
              type="date" 
              className="input px-4 text-sm" 
              value={dateRange.start}
              onChange={e => setDateRange({...dateRange, start: e.target.value})}
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Hasta</label>
          <div className="relative">
            <input 
              type="date" 
              className="input px-4 text-sm" 
              value={dateRange.end}
              onChange={e => setDateRange({...dateRange, end: e.target.value})}
            />
          </div>
        </div>
        <button 
          onClick={fetchReport}
          className="btn btn-primary px-6"
        >
          Filtrar Reporte
        </button>
      </div>

      {/* Main Report Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            {view === 'material' ? <ShoppingCart className="text-primary" size={20} /> : <FileText className="text-primary" size={20} />}
            {view === 'material' ? 'Resumen de Material a Reponer' : 'Resumen de Gasto por Cirugía'}
          </h3>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase">Costo Total del Periodo</p>
              <p className="text-xl font-black text-primary">
                RD$ {data.reduce((sum, curr) => sum + (curr.quantity_used * (curr.implant_lots?.implants?.unit_cost || 0)), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              {view === 'material' ? (
                <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                  <th className="py-4 px-6">Producto / SKU</th>
                  <th className="py-4 px-6">Categoría</th>
                  <th className="py-4 px-6 text-center">Cant. Usada</th>
                  <th className="py-4 px-6 text-right">Costo Unit.</th>
                  <th className="py-4 px-6 text-right">Subtotal</th>
                  <th className="py-4 px-6">Detalle de Cirugías</th>
                </tr>
              ) : (
                <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                  <th className="py-4 px-6">Paciente / Hospital</th>
                  <th className="py-4 px-6">Fecha</th>
                  <th className="py-4 px-6 text-center">Ítems Consumidos</th>
                  <th className="py-4 px-6 text-right">Gasto Total</th>
                  <th className="py-4 px-6 text-center">Estado</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="6" className="py-20 text-center text-slate-400 italic">Generando reporte...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan="6" className="py-20 text-center text-slate-400 italic">No se encontró consumo en este rango de fechas.</td></tr>
              ) : view === 'material' ? (
                Object.values(materialSummary).map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <p className="font-bold text-slate-900 leading-tight">{item.name}</p>
                      <p className="text-[10px] font-mono text-primary font-bold mt-1">{item.sku}</p>
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-wider">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center font-bold text-slate-900">{item.total_used}</td>
                    <td className="py-4 px-6 text-right font-mono text-xs text-slate-500">
                      RD$ {item.unit_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-6 text-right font-mono font-bold text-slate-900">
                      RD$ {(item.total_used * item.unit_cost).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap gap-1">
                        {item.surgeries.slice(0, 3).map((s, sIdx) => (
                          <span key={sIdx} className="text-[9px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-500">
                            {s.patient}
                          </span>
                        ))}
                        {item.surgeries.length > 3 && <span className="text-[9px] text-slate-400">+{item.surgeries.length - 3} más</span>}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                Object.values(surgeriesSummary).map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <p className="font-bold text-slate-900 leading-tight">{s.patient}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{s.hospital}</p>
                    </td>
                    <td className="py-4 px-6 text-sm text-slate-600">
                      {format(new Date(s.date), 'dd/MM/yyyy')}
                    </td>
                    <td className="py-4 px-6 text-center font-bold text-slate-900">
                      {s.items_count} <span className="text-[10px] font-normal text-slate-400">piezas</span>
                    </td>
                    <td className="py-4 px-6 text-right font-mono font-black text-lg text-primary">
                      RD$ {s.total_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                        Facturado
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Print Footer - Only visible on print */}
      <div className="hidden print:block mt-10 border-t border-slate-200 pt-6 text-center text-xs text-slate-400">
        Reporte generado automáticamente por MedOps el {format(new Date(), 'PPP', { locale: es })}
      </div>
    </div>
  );
};
