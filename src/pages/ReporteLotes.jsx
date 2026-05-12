import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Calendar, 
  Download, 
  RefreshCw,
  RotateCcw,
  Search, 
  Filter, 
  Printer, 
  FileText,
  AlertTriangle,
  History,
  TrendingDown
} from 'lucide-react';
import { implantService } from '../services/implantService';
import { useToast } from '../components/ui/Toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '../utils/cn';
import { PageLoader } from '../components/ui/Spinner';
import { getLocalDateString } from '../utils/dateUtils';

export const ReporteLotes = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [lots, setLots] = useState([]);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState({
    start: '2020-01-01', 
    end: format(new Date(), 'yyyy-MM-dd') 
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await implantService.getAllLotsDetailed();
      console.log('Lots loaded:', data); 
      setLots(data || []);
      if (data && data.length > 0) {
        toast.success(`${data.length} lotes cargados`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al cargar reporte de lotes');
    } finally {
      setLoading(false);
    }
  };

  const filteredLots = lots.filter(lot => {
    const implant = lot.implants || lot.implant;
    const name = implant?.name?.toLowerCase() || '';
    const sku = implant?.sku?.toLowerCase() || '';
    const lotNum = lot.lot_number?.toLowerCase() || '';
    const query = search.toLowerCase();
    
    const matchesSearch = name.includes(query) || sku.includes(query) || lotNum.includes(query);
    
    if (!lot.created_at) return matchesSearch;

    // Convertimos la fecha UTC de la base de datos a la fecha local del computador
    const entryDate = getLocalDateString(lot.created_at);
    
    const matchesDate = entryDate >= dateRange.start && entryDate <= dateRange.end;
    
    return matchesSearch && matchesDate;
  });

  const stats = {
    totalItems: filteredLots.reduce((acc, l) => acc + (l.current_quantity || 0), 0),
    totalValue: filteredLots.reduce((acc, l) => acc + ((l.current_quantity || 0) * (l.implants?.unit_cost || 0)), 0),
    lowStock: filteredLots.filter(l => l.current_quantity > 0 && l.current_quantity <= 5).length,
    expiring: filteredLots.filter(l => {
      const exp = new Date(l.expiration_date);
      const diff = (exp - new Date()) / (1000 * 60 * 60 * 24);
      return diff > 0 && diff <= 90;
    }).length
  };

  const handlePrint = () => window.print();

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <History className="text-primary" size={32} />
            Reporte de Trazabilidad por Lotes
          </h1>
          <p className="text-slate-500">Historial de entrada y estado actual del inventario detallado</p>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-4 border-l-4 border-l-blue-500">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
            <Package size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Unidades Totales</p>
            <p className="text-2xl font-black text-slate-900">{stats.totalItems.toLocaleString()}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4 border-l-4 border-l-emerald-500">
          <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
            <TrendingDown size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Valor en Inventario</p>
            <p className="text-2xl font-black text-slate-900">RD$ {stats.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4 border-l-4 border-l-amber-500">
          <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lotes con Stock Bajo</p>
            <p className="text-2xl font-black text-slate-900">{stats.lowStock}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4 border-l-4 border-l-rose-500">
          <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Próximos a Vencer</p>
            <p className="text-2xl font-black text-slate-900">{stats.expiring}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 print:hidden space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase px-1">Buscar Producto o Lote</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                placeholder="Nombre, SKU o Número de lote..."
                className="input input-search w-full bg-slate-50 border-transparent focus:bg-white"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase px-1">Fecha de Entrada (Desde)</label>
            <input 
              type="date" 
              className="input bg-slate-50 border-transparent focus:bg-white"
              value={dateRange.start}
              onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase px-1">Fecha de Entrada (Hasta)</label>
            <input 
              type="date" 
              className="input bg-slate-50 border-transparent focus:bg-white"
              value={dateRange.end}
              onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            />
          </div>

          <div className="flex gap-2">
            <button 
              onClick={() => {
                setSearch('');
                setDateRange({ start: '2020-01-01', end: format(new Date(), 'yyyy-MM-dd') });
              }}
              className="btn bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center gap-2 h-[42px]"
              title="Limpiar filtros"
            >
              <RotateCcw size={18} />
            </button>
            <button 
              onClick={fetchData}
              className="btn btn-secondary flex items-center gap-2 h-[42px]"
            >
              <RefreshCw size={18} className={cn(loading && "animate-spin")} />
              Refrescar
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Producto</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Lote</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Categoría</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Entrada</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Vencimiento</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Stock</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Valor Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLots.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400 font-medium italic">
                    No se encontraron registros para los filtros seleccionados
                  </td>
                </tr>
              ) : (
                filteredLots.map(lot => {
                  const isExpiring = new Date(lot.expiration_date) <= new Date(Date.now() + 90 * 86400000);
                  const isLow = lot.current_quantity <= 5;
                  const implant = lot.implants || lot.implant;
                  
                  return (
                    <tr key={lot.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900 group-hover:text-primary transition-colors">{implant?.name}</p>
                        <p className="text-[10px] font-mono text-slate-400 uppercase">{implant?.sku}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-mono font-bold border border-slate-200">
                          {lot.lot_number}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium text-slate-500 px-2 py-1 bg-slate-50 rounded-full border border-slate-100">
                          {implant?.category || 'General'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <p className="text-sm text-slate-600">{format(new Date(lot.created_at), 'dd/MM/yyyy')}</p>
                        <p className="text-[10px] text-slate-400">
                          {Math.floor((new Date() - new Date(lot.created_at)) / (1000 * 60 * 60 * 24)) === 0 
                            ? 'Hoy' 
                            : `Hace ${Math.ceil((new Date() - new Date(lot.created_at))/86400000)} días`}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <p className={cn(
                          "text-sm font-medium",
                          isExpiring ? "text-rose-600" : "text-slate-600"
                        )}>
                          {format(new Date(lot.expiration_date), 'dd/MM/yyyy')}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-xs font-bold",
                          lot.current_quantity === 0 ? "bg-slate-100 text-slate-400" :
                          isLow ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                        )}>
                          {lot.current_quantity} unidades
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-sm font-bold text-slate-900">
                          RD$ {((lot.current_quantity || 0) * (implant?.unit_cost || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
