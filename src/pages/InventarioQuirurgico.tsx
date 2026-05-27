import React, { useEffect, useState } from 'react';
import { Package, Plus, Search, AlertTriangle, Calendar, Box, Trash2, Edit2, ChevronDown, ChevronUp, History, FileText, Upload, Download } from 'lucide-react';
import { read, utils, writeFile } from 'xlsx';
import { implantService } from '../services/implantService';
import { useToast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import { cn } from '../utils/cn';
import type { Implant, ImplantLot } from '../types/domain';

const ImplantForm = ({ onSave, onCancel, initialData, loading }: { onSave: (data: any) => void; onCancel: () => void; initialData?: Partial<Implant> | null; loading: boolean }) => {
  const [form, setForm] = useState({
    name: initialData?.name || '',
    sku: initialData?.sku || '',
    category: initialData?.category || 'Tornillo',
    description: initialData?.description || '',
    min_stock: initialData?.min_stock || 5,
    unit_cost: initialData?.unit_cost || 0,
    selling_price: initialData?.selling_price || 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre del Producto *</label>
          <input
            required
            className="input"
            value={form.name}
            onChange={e => setForm({...form, name: e.target.value})}
            placeholder="Ej: Tornillo Canulado 3.5mm"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">SKU / Referencia *</label>
          <input
            required
            className="input"
            value={form.sku}
            onChange={e => setForm({...form, sku: e.target.value.toUpperCase()})}
            placeholder="Ej: TOR-35-CAN"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Categoría</label>
          <select
            className="input"
            value={form.category}
            onChange={e => setForm({...form, category: e.target.value})}
          >
            <option value="Tornillo">Tornillo</option>
            <option value="Placa">Placa</option>
            <option value="Prótesis">Prótesis</option>
            <option value="Consumible">Consumible</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Stock Mínimo (Alerta)</label>
          <input
            type="number"
            className="input"
            value={form.min_stock}
            onChange={e => setForm({...form, min_stock: parseInt(e.target.value)})}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Costo Unitario (RD$)</label>
          <input
            type="number"
            step="0.01"
            className="input font-bold text-slate-600"
            value={form.unit_cost}
            onChange={e => setForm({...form, unit_cost: parseFloat(e.target.value)})}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Precio de Venta (RD$)</label>
          <input
            type="number"
            step="0.01"
            className="input font-bold text-primary"
            value={form.selling_price}
            onChange={e => setForm({...form, selling_price: parseFloat(e.target.value)})}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Descripción</label>
        <textarea
          className="input min-h-[80px]"
          value={form.description}
          onChange={e => setForm({...form, description: e.target.value})}
          placeholder="Detalles técnicos..."
        />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={loading} className="btn btn-primary flex-1">
          {loading ? 'Guardando...' : initialData ? 'Actualizar Producto' : 'Crear Producto'}
        </button>
      </div>
    </form>
  );
};

const LotForm = ({ onSave, onCancel, implantId, loading }: { onSave: (data: any) => void; onCancel: () => void; implantId: string; loading: boolean }) => {
  const [form, setForm] = useState({
    implant_id: implantId,
    lot_number: '',
    expiration_date: '',
    current_quantity: 1,
    location: 'Almacén Central'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Número de Lote *</label>
          <input
            required
            className="input"
            value={form.lot_number}
            onChange={e => setForm({...form, lot_number: e.target.value.toUpperCase()})}
            placeholder="Ej: L12345"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha de Vencimiento</label>
          <input
            type="date"
            className="input"
            value={form.expiration_date}
            onChange={e => setForm({...form, expiration_date: e.target.value})}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Cantidad Inicial</label>
          <input
            type="number"
            required
            min="1"
            className="input"
            value={form.current_quantity}
            onChange={e => setForm({...form, current_quantity: parseInt(e.target.value)})}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Ubicación</label>
          <input
            className="input"
            value={form.location}
            onChange={e => setForm({...form, location: e.target.value})}
            placeholder="Ej: Almacén Central"
          />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={loading} className="btn btn-primary flex-1">
          {loading ? 'Agregando...' : 'Registrar Lote'}
        </button>
      </div>
    </form>
  );
};

const ImportModal = ({ onImport, onCancel, loading }: { onImport: (data: any[]) => void; onCancel: () => void; loading: boolean }) => {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<any[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      if (!evt.target) return;
      const bstr = evt.target.result;
      const wb = read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const json = utils.sheet_to_json(ws);
      setData(json);
      setFile(f);
    };
    reader.readAsBinaryString(f);
  };

  const downloadTemplate = () => {
    const templateData = [
      ["SKU", "Nombre", "Categoria", "Descripcion", "Stock Minimo", "Costo Unitario", "Precio Venta"],
      ["TOR-35-CAN", "Tornillo Canulado 3.5mm", "Tornillo", "Ejemplo de descripción técnica", "10", "1500.00", "4500.00"]
    ];
    const ws = utils.aoa_to_sheet(templateData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Plantilla");
    writeFile(wb, "Plantilla_Inventario_MedOps.xlsx");
  };

  const handleProcess = () => {
    const processed = data.map(row => ({
      name: row.Nombre || row.nombre || row.Name || row.Producto,
      sku: (row.SKU || row.sku || row.Referencia || row.Codigo || '').toString().toUpperCase(),
      category: row.Categoria || row.categoria || row.Category || 'Tornillo',
      description: row.Descripcion || row.descripcion || row.Description || '',
      min_stock: parseInt(row.StockMinimo || row.min_stock || row.Minimo || row['Stock Mínimo'] || 5),
      unit_cost: parseFloat(row.CostoUnitario || row.unit_cost || row.Costo || row.Precio || row['Costo Unitario'] || 0),
      selling_price: parseFloat(row.PrecioVenta || row.selling_price || row.Venta || row['Precio Venta'] || 0)
    })).filter(item => item.name && item.sku);

    onImport(processed);
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center bg-slate-50">
        <input
          type="file"
          id="excel-upload"
          hidden
          accept=".xlsx, .xls"
          onChange={handleFileChange}
        />
        <label htmlFor="excel-upload" className="cursor-pointer">
          <div className="w-16 h-16 bg-white rounded-full shadow-md flex items-center justify-center mx-auto mb-4 text-primary">
            <Upload size={32} />
          </div>
          <p className="text-sm font-bold text-slate-700">Haz clic para seleccionar tu archivo Excel</p>
          <p className="text-xs text-slate-500 mt-1">Soporta .xlsx y .xls</p>
        </label>
      </div>

      {file && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="text-emerald-600" />
            <div>
              <p className="text-sm font-bold text-emerald-900">{file.name}</p>
              <p className="text-xs text-emerald-600">{data.length} filas detectadas</p>
            </div>
          </div>
          <button
            onClick={() => { setFile(null); setData([]); }}
            className="text-xs font-bold text-emerald-700 hover:underline"
          >
            Cambiar
          </button>
        </div>
      )}

      <div className="bg-slate-100 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-black text-slate-500 uppercase">Columnas esperadas:</p>
          <button
            type="button"
            onClick={downloadTemplate}
            className="text-[10px] font-bold text-primary flex items-center gap-1 hover:underline"
          >
            <Download size={12} /> Descargar Plantilla
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="px-2 py-1 bg-white rounded text-[10px] font-mono border border-slate-200">SKU / Referencia</span>
          <span className="px-2 py-1 bg-white rounded text-[10px] font-mono border border-slate-200">Nombre</span>
          <span className="px-2 py-1 bg-white rounded text-[10px] font-mono border border-slate-200">Categoria</span>
          <span className="px-2 py-1 bg-white rounded text-[10px] font-mono border border-slate-200">CostoUnitario</span>
          <span className="px-2 py-1 bg-white rounded text-[10px] font-mono border border-slate-200">PrecioVenta</span>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn btn-secondary flex-1">Cancelar</button>
        <button
          onClick={handleProcess}
          disabled={loading || !file}
          className="btn btn-primary flex-1"
        >
          {loading ? 'Procesando...' : `Importar ${data.length} Productos`}
        </button>
      </div>
    </div>
  );
};

export const InventarioQuirurgico: React.FC = () => {
  const toast = useToast();
  const [implants, setImplants] = useState<Implant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [isImplantModalOpen, setIsImplantModalOpen] = useState(false);
  const [isLotModalOpen, setIsLotModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedImplant, setSelectedImplant] = useState<Implant | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchImplants = async () => {
    try {
      setLoading(true);
      const data = await implantService.getAll();
      setImplants(data);
    } catch (error) {
      toast.error('Error al cargar inventario: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImplants();
  }, []);

  const handleSaveImplant = async (formData: any) => {
    setActionLoading(true);
    try {
      if (selectedImplant?.id) {
        await implantService.update(selectedImplant.id, formData);
        toast.success('Producto actualizado');
      } else {
        await implantService.create(formData);
        toast.success('Producto creado exitosamente');
      }
      setIsImplantModalOpen(false);
      fetchImplants();
    } catch (error) {
      toast.error('Error: ' + (error as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddLot = async (formData: any) => {
    setActionLoading(true);
    try {
      const cleanLot = { ...formData, expiration_date: formData.expiration_date || null };
      await implantService.addLot(cleanLot);
      toast.success('Lote registrado correctamente');
      setIsLotModalOpen(false);
      fetchImplants();
    } catch (error) {
      toast.error('Error: ' + (error as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkImport = async (data: any[]) => {
    setActionLoading(true);
    try {
      await implantService.bulkCreateImplants(data);
      toast.success(`${data.length} productos importados correctamente`);
      setIsImportModalOpen(false);
      fetchImplants();
    } catch (error) {
      toast.error('Error en la importación: ' + (error as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar este producto y todos sus lotes?')) return;
    try {
      await implantService.delete(id);
      toast.success('Producto eliminado');
      fetchImplants();
    } catch (error) {
      toast.error('Error al eliminar: ' + (error as Error).message);
    }
  };

  const isExpired = (date: string | null) => !!date && new Date(date) < new Date();
  const isExpiringSoon = (date: string | null) => {
    if (!date) return false;
    const exp = new Date(date);
    const today = new Date();
    const diff = (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diff > 0 && diff < 90;
  };

  const allLots = (implants || []).flatMap(imp =>
    (imp.implant_lots || [])
      .filter(lot => lot.current_quantity > 0)
      .map(lot => ({ ...lot, implantName: imp.name }))
  );
  const expiredLots = allLots.filter(l => isExpired(l.expiration_date));
  const expiringSoonLots = allLots.filter(l => isExpiringSoon(l.expiration_date));
  const expiredCount = expiredLots.length;
  const expiringSoonCount = expiringSoonLots.length;

  const filteredImplants = implants.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.sku.toLowerCase().includes(search.toLowerCase())
  );

  const getStockStatus = (implant: Implant) => {
    const total = (implant.implant_lots || []).reduce((acc: number, lot: ImplantLot) => acc + lot.current_quantity, 0);
    if (total === 0) return { label: 'Sin Stock', color: 'bg-rose-100 text-rose-700', icon: AlertTriangle };
    if (total <= (implant.min_stock || 0)) return { label: 'Stock Bajo', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle };
    return { label: `${total} unidades`, color: 'bg-emerald-100 text-emerald-700', icon: Box };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Inventario Quirúrgico</h1>
          <p className="text-slate-500">Gestión de implantes, prótesis y consumibles críticos</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Upload size={20} /> Importar Excel
          </button>
          <button
            onClick={() => { setSelectedImplant(null); setIsImplantModalOpen(true); }}
            className="btn btn-primary flex items-center gap-2 shadow-lg shadow-primary/30"
          >
            <Plus size={20} /> Nuevo Producto
          </button>
        </div>
      </div>

      <div className="flex gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
              <input
                type="text"
                placeholder="Buscar implante, código o categoría..."
                className="input input-search w-full md:w-80"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
      </div>

      {(expiredCount > 0 || expiringSoonCount > 0) && (
        <div className={cn(
          "p-4 rounded-2xl border flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500",
          expiredCount > 0 ? "bg-rose-50 border-rose-200 text-rose-800" : "bg-amber-50 border-amber-200 text-amber-800"
        )}>
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
            expiredCount > 0 ? "bg-rose-100" : "bg-amber-100"
          )}>
            <AlertTriangle size={20} className={expiredCount > 0 ? "text-rose-600" : "text-amber-600"} />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm uppercase tracking-tight">Atención: Inventario Crítico</p>
            <p className="text-sm opacity-90">
              Se detectaron <span className="font-bold underline">{expiredCount}</span> lotes vencidos y <span className="font-bold underline">{expiringSoonCount}</span> lotes por vencer en los próximos 90 días.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {expiredLots.map(l => (
                <span key={l.id} className="text-[10px] bg-rose-200/50 text-rose-900 px-2 py-0.5 rounded-md font-bold border border-rose-200">
                  {l.implantName} (Lote: {l.lot_number}) - Vencido
                </span>
              ))}
              {expiringSoonLots.map(l => (
                <span key={l.id} className="text-[10px] bg-amber-200/50 text-amber-900 px-2 py-0.5 rounded-md font-bold border border-amber-200">
                  {l.implantName} (Lote: {l.lot_number}) - Prox. Vencer
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="p-12 text-center text-slate-400 italic">Cargando inventario...</div>
        ) : filteredImplants.length === 0 ? (
          <div className="p-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
            No se encontraron productos en el inventario.
          </div>
        ) : filteredImplants.map(implant => {
          const status = getStockStatus(implant);
          const isExpanded = expandedId === implant.id;

          return (
            <div key={implant.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:border-primary/30">
              <div className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                    <Package size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900">{implant.name}</h3>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-bold uppercase tracking-wider">{implant.sku}</span>
                    </div>
                    <p className="text-sm text-slate-500">{implant.category} · {implant.description || 'Sin descripción'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold", status.color)}>
                    <status.icon size={14} />
                    {status.label}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setSelectedImplant(implant); setIsImplantModalOpen(true); }}
                      className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                      title="Editar Producto"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => { setSelectedImplant(implant); setIsLotModalOpen(true); }}
                      className="btn btn-secondary btn-sm flex items-center gap-2"
                    >
                      <Plus size={14} /> Lote
                    </button>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : implant.id)}
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50/50 p-4 md:p-6 animate-in slide-in-from-top-2 duration-200">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Lotes en Almacén</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-200">
                          <th className="pb-3 px-2 font-semibold">Nº Lote</th>
                          <th className="pb-3 px-2 font-semibold">Vencimiento</th>
                          <th className="pb-3 px-2 font-semibold">Cantidad</th>
                          <th className="pb-3 px-2 font-semibold">Ubicación</th>
                          <th className="pb-3 px-2 text-right">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(implant.implant_lots || []).length === 0 ? (
                          <tr><td colSpan={5} className="py-4 text-center text-slate-400 italic">No hay lotes registrados para este producto.</td></tr>
                        ) : (implant.implant_lots ?? []).map(lot => (
                          <tr key={lot.id} className="group">
                            <td className="py-3 px-2 font-mono font-bold text-slate-700">{lot.lot_number}</td>
                            <td className="py-3 px-2">
                              <div className="flex items-center gap-2">
                                <Calendar size={14} className="text-slate-400" />
                                <span className={cn(
                                  isExpired(lot.expiration_date) ? "text-rose-600 font-bold" :
                                  isExpiringSoon(lot.expiration_date) ? "text-amber-600 font-bold" : "text-slate-600"
                                )}>
                                  {lot.expiration_date ? new Date(lot.expiration_date).toLocaleDateString('es-ES') : 'Sin vencimiento'}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-2 font-bold text-slate-900">{lot.current_quantity}</td>
                            <td className="py-3 px-2 text-slate-500">{lot.location}</td>
                            <td className="py-3 px-2 text-right">
                              {!lot.expiration_date ? (
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-bold uppercase">Sin venc.</span>
                              ) : isExpired(lot.expiration_date) ? (
                                <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-bold uppercase">Vencido</span>
                              ) : isExpiringSoon(lot.expiration_date) ? (
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold uppercase">Vence Pronto</span>
                              ) : (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold uppercase">Ok</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Modal
        isOpen={isImplantModalOpen}
        onClose={() => setIsImplantModalOpen(false)}
        title={selectedImplant ? "Editar Producto" : "Nuevo Producto Quirúrgico"}
      >
        <ImplantForm
          onSave={handleSaveImplant}
          onCancel={() => setIsImplantModalOpen(false)}
          initialData={selectedImplant}
          loading={actionLoading}
        />
      </Modal>

      <Modal
        isOpen={isLotModalOpen}
        onClose={() => setIsLotModalOpen(false)}
        title={`Agregar Lote: ${selectedImplant?.name}`}
      >
        <LotForm
          onSave={handleAddLot}
          onCancel={() => setIsLotModalOpen(false)}
          implantId={selectedImplant?.id ?? ''}
          loading={actionLoading}
        />
      </Modal>

      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Importar Catálogo desde Excel"
      >
        <ImportModal
          onImport={handleBulkImport}
          onCancel={() => setIsImportModalOpen(false)}
          loading={actionLoading}
        />
      </Modal>
    </div>
  );
};
