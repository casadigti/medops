import React, { useState, useEffect } from 'react';
import type { SurgeryConsumption } from '../types/domain';
import { ShoppingCart, Download, Search, FileText, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { implantService } from '../services/implantService';
import { printService } from '../services/printService';
import { useToast } from '../components/ui/Toast';
import { format } from 'date-fns';
import { cn } from '../utils/cn';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { exportToExcelMultiSheet } from '../utils/exportExcel';

export const ReporteReposicion: React.FC = () => {
  const toast = useToast();
  const [view, setView] = useState('material');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SurgeryConsumption[]>([]);
  const [currentStock, setCurrentStock] = useState<Record<string, number>>({});
  const [dateRange, setDateRange] = useState({
    start: format(new Date().setDate(new Date().getDate() - 7), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  const fetchReport = async () => {
    try {
      setLoading(true);
      const [reportData, implants] = await Promise.all([
        implantService.getConsumptionReport(
          dateRange.start ? new Date(dateRange.start + 'T00:00:00').toISOString() : undefined,
          dateRange.end ? new Date(dateRange.end + 'T23:59:59').toISOString() : undefined
        ),
        implantService.getAll()
      ]);

      setData(reportData);

      const stockMap: Record<string, number> = {};
      implants.forEach(imp => {
        const total = (imp.implant_lots || []).reduce((acc: number, lot: any) => acc + (lot.current_quantity || 0), 0);
        stockMap[imp.id] = total;
      });
      setCurrentStock(stockMap);

    } catch (error) {
      toast.error('Error al generar reporte: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const daysInRange = Math.max(1, Math.ceil((new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / 86400000));

  const materialSummary: Record<string, any> = data.reduce((acc: Record<string, any>, curr) => {
    const productId = (curr as any).implant_lots?.implants?.id;
    if (!productId) return acc;

    const name = (curr as any).implant_lots.implants.name;
    const sku = (curr as any).implant_lots.implants.sku;

    if (search && !name.toLowerCase().includes(search.toLowerCase()) && !sku.toLowerCase().includes(search.toLowerCase())) {
      return acc;
    }

    if (!acc[productId]) {
      const stock = currentStock[productId] || 0;
      acc[productId] = {
        name,
        sku,
        category: (curr as any).implant_lots.implants.category,
        unit_cost: (curr as any).implant_lots.implants.unit_cost || 0,
        total_used: 0,
        current_stock: stock,
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

  const surgeriesSummary: Record<string, any> = data.reduce((acc: Record<string, any>, curr) => {
    const surgeryId = curr.surgeries?.id;
    if (!surgeryId) return acc;

    const patient = curr.surgeries?.patient_name ?? '';
    const hospital = curr.surgeries?.hospital?.name ?? '';

    if (search && !patient.toLowerCase().includes(search.toLowerCase()) && !hospital.toLowerCase().includes(search.toLowerCase())) {
      return acc;
    }

    if (!acc[surgeryId]) {
      acc[surgeryId] = {
        patient,
        date: curr.surgeries?.surgery_date,
        hospital,
        nss: (curr.surgeries as any)?.nss || '',
        total_cost: 0,
        items_count: 0
      };
    }

    const cost = ((curr as any).implant_lots?.implants?.unit_cost || 0) * curr.quantity_used;
    acc[surgeryId].total_cost += cost;
    acc[surgeryId].items_count += curr.quantity_used;

    return acc;
  }, {});

  const handlePrint = () => window.print();

  const handleExportExcel = () => {
    const materialRows = (Object.values(materialSummary) as any[]).map(item => ({
      'Producto': item.name,
      'SKU': item.sku,
      'Categoría': item.category,
      'Stock Actual': item.current_stock,
      'Cantidad Usada': item.total_used,
      'Costo Unitario (RD$)': item.unit_cost,
      'Subtotal (RD$)': item.total_used * item.unit_cost,
    }));

    const surgeryRows = (Object.values(surgeriesSummary) as any[]).map(s => ({
      'Paciente': s.patient,
      'Hospital': s.hospital,
      'Fecha': s.date ? format(new Date(s.date), 'dd/MM/yyyy') : '—',
      'Ítems Consumidos': s.items_count,
      'Gasto Total (RD$)': s.total_cost,
    }));

    exportToExcelMultiSheet(
      [
        { name: 'Por Material', rows: materialRows },
        { name: 'Por Cirugía', rows: surgeryRows },
      ],
      `reporte-reposicion-${dateRange.start}_${dateRange.end}`,
    );
  };

  const handleDownloadPDF = () => {
    if (view === 'material') {
      printService.generateReplenishmentReport(data, dateRange, materialSummary);
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen de Gasto por Cirugía', margin, 20);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Período: ${dateRange.start} — ${dateRange.end}`, margin, 28);

    const rows = (Object.values(surgeriesSummary) as any[]).map(s => [
      s.patient,
      s.hospital,
      s.date ? format(new Date(s.date), 'dd/MM/yyyy') : '—',
      s.items_count,
      `RD$ ${s.total_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    ]);

    const totalCost = (Object.values(surgeriesSummary) as any[]).reduce((sum, s) => sum + s.total_cost, 0);

    autoTable(doc, {
      startY: 34,
      head: [['Paciente', 'Hospital', 'Fecha', 'Items', 'Gasto Total']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      margin: { left: margin, right: margin },
    });

    const finalY = (doc as any).lastAutoTable?.finalY ?? 34 + rows.length * 8 + 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total del período: RD$ ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, pageWidth - margin, finalY + 8, { align: 'right' });

    doc.save(`reporte-cirugias-${dateRange.start}_${dateRange.end}.pdf`);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Reporte de Gasto y Reposición</h1>
          <p className="text-slate-500">Analítica financiera y logística de materiales consumidos</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-all shadow-sm shadow-green-200 flex items-center gap-2"
          >
            <FileSpreadsheet size={18} /> Exportar Excel
          </button>
          <button
            onClick={handleDownloadPDF}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-sm shadow-emerald-200 flex items-center gap-2"
          >
            <Download size={18} /> Descargar PDF
          </button>
          <button
            onClick={fetchReport}
            disabled={loading}
            className="p-2 bg-white text-slate-400 hover:text-primary hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-sm"
          >
            <RefreshCw size={20} className={cn(loading && "animate-spin")} />
          </button>
        </div>
      </div>

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

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-end gap-4 print:hidden">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Desde</label>
          <input
            type="date"
            className="input px-4 text-sm"
            value={dateRange.start}
            onChange={e => setDateRange({...dateRange, start: e.target.value})}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Hasta</label>
          <input
            type="date"
            className="input px-4 text-sm"
            value={dateRange.end}
            onChange={e => setDateRange({...dateRange, end: e.target.value})}
          />
        </div>
        <button onClick={fetchReport} className="btn btn-primary px-6">
          Filtrar Reporte
        </button>
      </div>

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
                RD$ {data.reduce((sum, curr) => sum + (curr.quantity_used * ((curr as any).implant_lots?.implants?.unit_cost || 0)), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
                  <th className="py-4 px-6 text-center">Stock Actual</th>
                  <th className="py-4 px-6 text-center">Cant. Usada</th>
                  <th className="py-4 px-6 text-center">Días de Stock</th>
                  <th className="py-4 px-6 text-right">Subtotal</th>
                  <th className="py-4 px-6">Detalle</th>
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
                <tr><td colSpan={6} className="py-20 text-center text-slate-400 italic">Generando reporte...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={6} className="py-20 text-center text-slate-400 italic">No se encontró consumo en este rango de fechas.</td></tr>
              ) : view === 'material' ? (
                (Object.values(materialSummary) as any[]).map((item, idx) => {
                  const dailyConsumption = item.total_used / daysInRange;
                  const daysLeft = dailyConsumption > 0 ? Math.floor(item.current_stock / dailyConsumption) : '∞';

                  return (
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
                      <td className="py-4 px-6 text-center">
                        <span className={cn("font-bold", item.current_stock <= 2 ? "text-red-600" : "text-slate-900")}>
                          {item.current_stock}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center font-bold text-slate-900">{item.total_used}</td>
                      <td className="py-4 px-6 text-center">
                        <span className={cn(
                          "px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest",
                          daysLeft === '∞' ? "bg-slate-100 text-slate-400" :
                          daysLeft <= 7 ? "bg-red-100 text-red-600 animate-pulse" :
                          daysLeft <= 15 ? "bg-amber-100 text-amber-600" :
                          "bg-emerald-100 text-emerald-600"
                        )}>
                          {daysLeft} {daysLeft !== '∞' ? 'días' : ''}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right font-mono font-bold text-slate-900">
                        RD$ {(item.total_used * item.unit_cost).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-wrap gap-1">
                          {item.surgeries.slice(0, 2).map((s: any, sIdx: number) => (
                            <span key={sIdx} className="text-[9px] bg-white border border-slate-200 px-1 py-0.5 rounded text-slate-500 truncate max-w-[80px]" title={s.patient}>
                              {s.patient}
                            </span>
                          ))}
                          {item.surgeries.length > 2 && <span className="text-[9px] text-slate-400">+{item.surgeries.length - 2}</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                (Object.values(surgeriesSummary) as any[]).map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <p className="font-bold text-slate-900 leading-tight">{s.patient}</p>
                      {s.nss && <p className="text-[10px] text-primary font-semibold mt-0.5">NSS: {s.nss}</p>}
                      <p className="text-[10px] text-slate-500 mt-0.5">{s.hospital}</p>
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

      <div className="hidden print:block mt-10 border-t border-slate-200 pt-6 text-center text-xs text-slate-400">
        Reporte generado automáticamente por MedOps el {format(new Date(), 'PPP')}
      </div>
    </div>
  );
};
