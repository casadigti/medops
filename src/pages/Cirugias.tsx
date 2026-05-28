import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { surgeryService } from '../services/surgeryService';
import { surgeonService } from '../services/surgeonService';
import { hospitalService } from '../services/hospitalService';
import { trayService } from '../services/trayService';
import { arsService } from '../services/arsService';
import { procedureTypeService } from '../services/procedureTypeService';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { StatusBadge } from '../components/ui/Badge';
import { PageLoader, EmptyState } from '../components/ui/Spinner';
import { SURGERY_STATUSES, STATUS_COLORS } from '../data/catalogo';
import { Stethoscope, Plus, Pencil, Trash2, Search, ChevronDown, Calendar, User, Building2, Package, Printer, AlertTriangle } from 'lucide-react';
import { cn } from '../utils/cn';
import { printService } from '../services/printService';
import { implantService } from '../services/implantService';
import { useToast } from '../components/ui/Toast';
import { ShoppingCart, CheckCircle2, FileText } from 'lucide-react';
import { generateActaQuirurgica } from '../utils/pdfGenerator';
import type { UserProfile, Surgery, Surgeon, Hospital, ARS, Implant, SurgeryConsumption, TrayWithAvailability, SurgeryStatus, ProcedureType } from '../types/domain';

// ─── Consumption Form ─────────────────────────────────────────────────────────
const ConsumptionForm = ({ surgery, onSave, onCancel, loading }: { surgery: Surgery; onSave: (data: any) => void; onCancel: () => void; loading: boolean }) => {
  const [implants, setImplants] = useState<Implant[]>([]);
  const [selectedImplantId, setSelectedImplantId] = useState('');
  const [selectedLotId, setSelectedLotId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [authNumber, setAuthNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [currentConsumption, setCurrentConsumption] = useState<SurgeryConsumption[]>([]);
  const [fetching, setFetching] = useState(true);

  const fetchImplants = async () => {
    try {
      const data = await implantService.getAll();
      setImplants(data);
    } finally {
      setFetching(false);
    }
  };

  const fetchConsumption = async () => {
    const data = await implantService.getConsumptionBySurgery(surgery.id);
    setCurrentConsumption(data);
  };

  useEffect(() => {
    fetchImplants();
    fetchConsumption();
  }, [surgery.id]);

  const selectedImplant = implants.find(i => i.id === selectedImplantId);
  const availableLots = selectedImplant?.implant_lots?.filter(l => l.current_quantity > 0) || [];

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedLotId) return;

    onSave({
      surgery_id: surgery.id,
      implant_lot_id: selectedLotId,
      quantity_used: quantity,
      auth_number: authNumber,
      notes
    });

    setSelectedLotId('');
    setQuantity(1);
    setAuthNumber('');
    setNotes('');
    setTimeout(fetchConsumption, 500);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Registrar Nuevo Gasto</h4>
        <form onSubmit={handleAdd} className="grid grid-cols-12 gap-4">
          <div className="col-span-12">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Producto</label>
            <select
              className="input text-sm"
              value={selectedImplantId}
              onChange={e => { setSelectedImplantId(e.target.value); setSelectedLotId(''); }}
            >
              <option value="">Seleccionar producto...</option>
              {implants.map(i => (
                <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>
              ))}
            </select>
          </div>

          <div className="col-span-12 md:col-span-5">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Lote Disponible</label>
            <select
              className="input text-sm"
              disabled={!selectedImplantId}
              value={selectedLotId}
              onChange={e => setSelectedLotId(e.target.value)}
            >
              <option value="">Seleccionar lote...</option>
              {availableLots.map(l => (
                <option key={l.id} value={l.id}>
                  Lote: {l.lot_number} (Stock: {l.current_quantity})
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-8 md:col-span-5">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nº Autorización</label>
            <input
              className="input text-sm"
              placeholder="Opcional"
              value={authNumber}
              onChange={e => setAuthNumber(e.target.value)}
            />
          </div>

          <div className="col-span-4 md:col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cant.</label>
            <input
              type="number"
              min="1"
              className="input text-sm"
              value={quantity}
              onChange={e => setQuantity(parseInt(e.target.value))}
            />
          </div>

          <div className="col-span-12 flex gap-2">
            <input
              className="input text-sm flex-1"
              placeholder="Notas u observaciones del uso..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading || !selectedLotId}
              className="btn btn-primary px-6 whitespace-nowrap"
            >
              <Plus size={16} className="mr-1" /> Cargar
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Material Consumido en esta Cirugía</h4>
        {currentConsumption.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-4">No se ha reportado consumo aún.</p>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
            {currentConsumption.map(c => (
              <div key={c.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div>
                  <p className="text-sm font-bold text-slate-900">{c.implant_lots?.implants?.name}</p>
                  <p className="text-[10px] text-slate-500 uppercase">
                    SKU: {c.implant_lots?.implants?.sku} · Lote: <span className="font-mono font-bold text-slate-700">{c.implant_lots?.lot_number}</span>
                    {c.auth_number && <span className="ml-2 text-primary">· Aut: {c.auth_number}</span>}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                    Costo: RD$ {(c.implant_lots?.implants?.unit_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} c/u
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-black text-primary">x{c.quantity_used}</p>
                    <p className="text-[10px] text-slate-400">{c.used_at ? new Date(c.used_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '—'}</p>
                  </div>
                  <CheckCircle2 size={18} className="text-emerald-500" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {currentConsumption.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between mt-6">
          <div>
            <p className="text-[10px] font-black text-primary uppercase tracking-widest">Total Gasto Quirúrgico</p>
            <p className="text-2xl font-black text-slate-900">
              RD$ {currentConsumption.reduce((sum, c) => sum + (c.quantity_used * (c.implant_lots?.implants?.unit_cost || 0)), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-primary shadow-sm border border-primary/10">
            <ShoppingCart size={24} />
          </div>
        </div>
      )}

      <div className="pt-2 flex gap-3">
        <button
          onClick={async () => {
            if (currentConsumption.length === 0) return;
            generateActaQuirurgica(surgery, currentConsumption);
          }}
          disabled={currentConsumption.length === 0}
          className={cn(
            "btn flex-1",
            currentConsumption.length > 0 ? "btn-secondary" : "btn-secondary opacity-50 cursor-not-allowed"
          )}
        >
          <FileText size={16} className="mr-2" /> Descargar Acta
        </button>
        <button onClick={onCancel} className="btn btn-primary flex-1">Cerrar y Finalizar</button>
      </div>
    </div>
  );
};

// ─── Surgery Form ────────────────────────────────────────────────────────────
const SurgeryForm = ({ initial, surgeons, hospitals, arsList, procedureTypes, onSave, onCancel, loading }: { initial?: Partial<Surgery> | null; surgeons: Surgeon[]; hospitals: Hospital[]; arsList: ARS[]; procedureTypes: ProcedureType[]; onSave: (data: any, trayIds: string[]) => void; onCancel: () => void; loading: boolean }) => {
  const [form, setForm] = useState(() => ({
    patient_name: '', surgery_date: '', surgeon_id: '', hospital_id: '',
    operating_room: '', procedure_type: '', status: 'Pendiente',
    delivery_responsible: '', notes: '',
    ...(initial || {}),
    ars_id: initial?.ars_id || ''
  }));
  const [selectedProcTypes, setSelectedProcTypes] = useState<string[]>(() =>
    initial?.procedure_type
      ? initial.procedure_type.split(',').map(s => s.trim()).filter(Boolean)
      : []
  );
  const toggleProcType = (p: string) => setSelectedProcTypes(prev =>
    prev.includes(p) ? prev.filter(t => t !== p) : [...prev, p]
  );
  const [selectedTrayIds, setSelectedTrayIds] = useState<string[]>([]);
  const [availableTrays, setAvailableTrays] = useState<TrayWithAvailability[]>([]);
  const [trayLoading, setTrayLoading] = useState(false);
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (initial?.surgery_trays) {
      setSelectedTrayIds(initial.surgery_trays.map(st => st.tray?.id).filter((id): id is string => Boolean(id)));
    }
  }, [initial]);

  useEffect(() => {
    if (!form.surgery_date) return;
    setTrayLoading(true);
    trayService.getAvailableForDate(new Date(form.surgery_date), initial?.id)
      .then((trays: TrayWithAvailability[]) => setAvailableTrays(trays))
      .finally(() => setTrayLoading(false));
  }, [form.surgery_date]);

  const toggleTray = (id: string) => setSelectedTrayIds(prev =>
    prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
  );

  const selectedHospital = hospitals.find(h => h.id === form.hospital_id);
  const needsSupportTray = !!selectedHospital?.requires_support_tray;
  const hasSupportTraySelected = selectedTrayIds.some(id => availableTrays.find(t => t.id === id)?.is_support_tray);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (selectedProcTypes.length === 0) return;
    if (needsSupportTray && !hasSupportTraySelected) return;
    onSave({ ...form, procedure_type: selectedProcTypes.join(', ') }, selectedTrayIds);
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre del Paciente *</label>
          <input required className="input" value={form.patient_name} onChange={e => set('patient_name', e.target.value)} placeholder="Nombre completo del paciente" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha y Hora *</label>
          <input required type="datetime-local" className="input" value={form.surgery_date ? form.surgery_date.slice(0,16) : ''} onChange={e => set('surgery_date', e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Estado</label>
          <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
            {SURGERY_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Aseguradora (ARS) *</label>
          <select required className="input" value={form.ars_id} onChange={e => set('ars_id', e.target.value)}>
            <option value="">Seleccionar ARS...</option>
            {arsList.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">No. NSS</label>
          <input className="input" value={(form as any).nss || ''} onChange={e => set('nss', e.target.value)} placeholder="No. carnet aseguradora" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Cirujano</label>
          <select className="input" value={form.surgeon_id} onChange={e => set('surgeon_id', e.target.value)}>
            <option value="">Seleccionar cirujano...</option>
            {surgeons.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Hospital</label>
          <select className="input" value={form.hospital_id} onChange={e => set('hospital_id', e.target.value)}>
            <option value="">Seleccionar hospital...</option>
            {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Quirófano</label>
          <input className="input" value={form.operating_room} onChange={e => set('operating_room', e.target.value)} placeholder="Qx #1" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Responsable de Entrega</label>
          <input className="input" value={form.delivery_responsible} onChange={e => set('delivery_responsible', e.target.value)} placeholder="Nombre del técnico" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">
          Tipo de Procedimiento *
          {selectedProcTypes.length > 0 && (
            <span className="ml-2 text-xs font-normal text-blue-600">({selectedProcTypes.length} seleccionado{selectedProcTypes.length > 1 ? 's' : ''})</span>
          )}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-slate-200 rounded-xl p-3 max-h-52 overflow-y-auto">
          {procedureTypes.length === 0 && (
            <p className="col-span-2 text-sm text-slate-400 italic py-2">No hay tipos de procedimiento configurados. Agrégalos en Configuración → Tipos de Procedimiento.</p>
          )}
          {procedureTypes.map(p => (
            <label key={p.id} className={cn(
              'flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer border transition-all',
              selectedProcTypes.includes(p.name) ? 'border-primary/30 bg-blue-50' : 'border-slate-100 hover:bg-slate-50'
            )}>
              <input
                type="checkbox"
                className="accent-blue-700 shrink-0"
                checked={selectedProcTypes.includes(p.name)}
                onChange={() => toggleProcType(p.name)}
              />
              <span className="text-sm text-slate-700">{p.name}</span>
            </label>
          ))}
        </div>
        {selectedProcTypes.length === 0 && (
          <p className="text-xs text-red-500 mt-1">Selecciona al menos un tipo de procedimiento</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Bandejas / Sets Requeridos
          {!form.surgery_date && <span className="text-slate-400 font-normal text-xs ml-2">(selecciona una fecha primero)</span>}
        </label>
        {needsSupportTray && (
          <div className={cn(
            'flex items-start gap-2.5 p-3 rounded-xl border mb-3 text-sm',
            hasSupportTraySelected
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          )}>
            <span className="text-lg leading-none shrink-0">{hasSupportTraySelected ? '✅' : '⚠️'}</span>
            <div>
              <p className="font-semibold">{hasSupportTraySelected ? 'Bandeja de apoyo seleccionada' : 'Este hospital requiere bandeja de apoyo'}</p>
              <p className="text-xs mt-0.5 opacity-80">
                {hasSupportTraySelected
                  ? 'La bandeja de apoyo aparecerá en la hoja de entrega como "Apoyo – A devolver".'
                  : 'Selecciona una Bandeja de Apoyo (marcada con 🔶). No genera costo al paciente.'}
              </p>
            </div>
          </div>
        )}
        {trayLoading
          ? <p className="text-sm text-slate-400 italic">Verificando disponibilidad...</p>
          : availableTrays.length === 0 && !form.surgery_date
            ? null
            : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto border border-slate-200 rounded-xl p-3">
                {availableTrays.map(t => (
                  <label key={t.id} className={cn(
                    'flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer border transition-all',
                    t.busy && !selectedTrayIds.includes(t.id) ? 'opacity-40 cursor-not-allowed border-slate-100 bg-slate-50' :
                    selectedTrayIds.includes(t.id) && t.is_support_tray ? 'border-amber-300 bg-amber-50' :
                    selectedTrayIds.includes(t.id) ? 'border-primary/30 bg-blue-50' :
                    t.is_support_tray ? 'border-amber-200 bg-amber-50/40 hover:bg-amber-50' :
                    'border-slate-100 hover:bg-slate-50'
                  )}>
                    <input type="checkbox" className={t.is_support_tray ? 'accent-amber-600' : 'accent-blue-700'}
                      checked={selectedTrayIds.includes(t.id)}
                      disabled={t.busy && !selectedTrayIds.includes(t.id)}
                      onChange={() => toggleTray(t.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                        {t.is_support_tray && <span title="Bandeja de apoyo">🔶</span>}
                        {t.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {t.code}{t.is_support_tray ? ' · Apoyo (sin costo)' : ''}{t.unavailable_reason ? ` — ${t.unavailable_reason}` : ''}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
        {needsSupportTray && !hasSupportTraySelected && (
          <p className="text-xs text-amber-600 mt-1">⚠️ Debes seleccionar al menos una bandeja de apoyo para este hospital.</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Notas Adicionales</label>
        <textarea rows={3} className="input resize-none" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Información adicional relevante..." />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={loading} className="btn btn-primary flex-1">
          {loading ? 'Guardando...' : initial ? 'Actualizar Cirugía' : 'Crear Cirugía'}
        </button>
      </div>
    </form>
  );
};

// ─── Status Quick-Change Menu ─────────────────────────────────────────────────
const StatusMenu = ({ surgery, onUpdate }: { surgery: Surgery; onUpdate: (id: string, status: string) => void }) => {
  const colors = STATUS_COLORS[surgery.status] || { bg: 'bg-slate-100', text: 'text-slate-600' };
  return (
    <select
      value={surgery.status}
      onChange={(e) => onUpdate(surgery.id, e.target.value)}
      className={cn(
        "text-[11px] font-bold px-2.5 py-1 rounded-full cursor-pointer outline-none transition-all appearance-none pr-6 border-2 border-transparent focus:border-primary/20",
        colors.bg, colors.text
      )}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
        backgroundPosition: 'right 6px center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '12px'
      }}
    >
      {SURGERY_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
interface CirugiasProps {
  userProfile: Partial<UserProfile> | null;
}

export const Cirugias: React.FC<CirugiasProps> = ({ userProfile }) => {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [surgeries, setSurgeries] = useState<Surgery[]>([]);
  const [surgeons, setSurgeons]   = useState<Surgeon[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [arsList, setArsList]     = useState<ARS[]>([]);
  const [procedureTypes, setProcedureTypes] = useState<ProcedureType[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [search, setSearch]       = useState(searchParams.get('q') || '');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo]     = useState('');
  const [modal, setModal]         = useState<{ data: Surgery | null } | null>(null);
  const [consumptionModal, setConsumptionModal] = useState<Surgery | null>(null);
  const [confirm, setConfirm]     = useState<{ id: string; name: string } | null>(null);

  const isSurgeon = userProfile?.role === 'Cirujano';
  const mySurgeonId = (userProfile as any)?.surgeon_id;

  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [surg, sur, hosp, ars, procs] = await Promise.all([
        surgeryService.getAll(isSurgeon ? mySurgeonId : null),
        surgeonService.getAll(),
        hospitalService.getAll(),
        arsService.getAll(),
        procedureTypeService.getAll(),
      ]);
      setSurgeries(surg || []);
      setSurgeons(sur || []);
      setHospitals(hosp || []);
      setArsList(ars || []);
      setProcedureTypes(procs || []);
    } catch (err) {
      console.error('Cirugias: Error cargando datos:', err);
      setFetchError('No se pudieron cargar los datos. Intenta recargar.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userProfile) fetchAll();
  }, [userProfile]);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null) setSearch(q);
  }, [searchParams]);

  const filtered = surgeries.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = s.patient_name?.toLowerCase().includes(q) ||
      (s.surgeon?.full_name || '').toLowerCase().includes(q) ||
      (s.hospital?.name || '').toLowerCase().includes(q) ||
      (s.procedure_type || '').toLowerCase().includes(q);
    const matchStatus = !filterStatus || s.status === filterStatus;
    const dateStr = s.surgery_date.slice(0, 10);
    const matchDateFrom = !filterDateFrom || dateStr >= filterDateFrom;
    const matchDateTo   = !filterDateTo   || dateStr <= filterDateTo;
    return matchSearch && matchStatus && matchDateFrom && matchDateTo;
  });

  const handleSave = async (data: any, trayIds: string[]) => {
    setSaving(true);
    try {
      let finalData = { ...data };
      if (isSurgeon) finalData.surgeon_id = mySurgeonId;

      if (modal?.data?.id) {
        await surgeryService.update(modal.data.id, finalData, trayIds);
      } else {
        const newSurgery = await surgeryService.create(finalData, trayIds);

        const _sd = finalData.surgery_date.split('T')[0].split('-');
        const _surgMidnight = new Date(Number(_sd[0]), Number(_sd[1]) - 1, Number(_sd[2]));
        const _todayMidnight = new Date(); _todayMidnight.setHours(0,0,0,0);
        const diffDays = Math.round((_surgMidnight.getTime() - _todayMidnight.getTime()) / 86400000);
        if (diffDays <= 2 && finalData.status === 'Pendiente') {
          try {
            await surgeryService.sendAlert(newSurgery, 'casadigti@gmail.com');
          } catch (alertError) {
            console.error('Error al enviar la alerta de correo:', alertError);
          }
        }
      }
      setModal(null);
      fetchAll();
    } finally { setSaving(false); }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await surgeryService.updateStatus(id, status as SurgeryStatus);
      setSurgeries(prev => prev.map(s => s.id === id ? { ...s, status: status as Surgery['status'] } : s));
      toast.success(`Estado actualizado: ${status}`);
    } catch (err) {
      console.error('Error actualizando estado:', err);
      const e = err as any;
      const isRLS = e?.message?.includes('row-level security') || e?.code === '42501';
      toast.error(
        isRLS
          ? 'Error de permisos en base de datos. Contacta al administrador del sistema.'
          : 'Error al actualizar el estado. Intenta de nuevo.'
      );
    }
  };

  const handleDelete = async () => {
    if (isSurgeon || !confirm) return;
    await surgeryService.delete(confirm.id);
    setConfirm(null); fetchAll();
  };

  const handleConsumptionReport = async (consumptionData: any) => {
    setSaving(true);
    try {
      await implantService.reportConsumption(consumptionData);
      toast.success('Gasto registrado y stock actualizado');
    } catch (err) {
      toast.error('Error: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateActa = async (surgery: Surgery) => {
    try {
      toast.success('Generando acta quirúrgica...');
      const consumptions = await implantService.getConsumptionBySurgery(surgery.id);
      generateActaQuirurgica(surgery, consumptions);
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast.error('Error al generar el PDF');
    }
  };

  const getDaysLabel = (dateStr: string) => {
    const s = dateStr.split('T')[0].split('-');
    const surgMidnight = new Date(Number(s[0]), Number(s[1]) - 1, Number(s[2]));
    const todayMidnight = new Date(); todayMidnight.setHours(0,0,0,0);
    const diff = Math.round((surgMidnight.getTime() - todayMidnight.getTime()) / 86400000);
    if (diff < 0) return { label: 'Pasada', color: 'text-slate-400' };
    if (diff === 0) return { label: 'Hoy', color: 'text-red-600 font-bold' };
    if (diff === 1) return { label: 'Mañana', color: 'text-amber-600 font-bold' };
    return { label: `En ${diff} días`, color: 'text-slate-500' };
  };

  return (
    <div className="space-y-6">
      {fetchError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-sm">
          <AlertTriangle size={18} className="text-red-500 shrink-0" />
          <p className="text-red-700 font-medium flex-1">{fetchError}</p>
          <button onClick={fetchAll} className="text-xs font-bold text-red-600 underline hover:no-underline">
            Reintentar
          </button>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Gestión de Cirugías</h1>
          <p className="text-slate-500">{surgeries.length} cirugías registradas</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ data: null })}>
          <Plus size={18} />Nueva Cirugía
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative sm:max-w-[260px] w-full flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input className="input input-search text-sm w-full" placeholder="Buscar paciente, cirujano..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Calendar size={15} className="text-slate-400 shrink-0" />
          <input
            type="date"
            className="input text-sm w-[140px]"
            value={filterDateFrom}
            onChange={e => setFilterDateFrom(e.target.value)}
            title="Desde"
          />
          <span className="text-slate-400 text-sm font-medium">—</span>
          <input
            type="date"
            className="input text-sm w-[140px]"
            value={filterDateTo}
            onChange={e => setFilterDateTo(e.target.value)}
            title="Hasta"
          />
          {(filterDateFrom || filterDateTo) && (
            <button
              className="btn btn-secondary text-xs px-2.5 py-1.5 whitespace-nowrap"
              onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); }}
            >
              ✕
            </button>
          )}
        </div>
        <select className="input sm:max-w-[180px] w-full text-sm shrink-0" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {SURGERY_STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {loading ? <PageLoader /> : filtered.length === 0
        ? <EmptyState icon={Stethoscope} title="Sin cirugías registradas" description="Crea la primera cirugía con el botón superior"
            action={<button className="btn btn-primary" onClick={() => setModal({ data: null })}><Plus size={16} />Nueva Cirugía</button>} />
        : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Paciente','ARS','Procedimiento','Cirujano','Hospital','Fecha','Estado','Bandejas','Acciones'].map(h => (
                      <th key={h} className="px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(s => {
                    const { label, color } = getDaysLabel(s.surgery_date);
                    return (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-slate-900 whitespace-nowrap">{s.patient_name}</p>
                          {s.operating_room && <p className="text-xs text-slate-400">Qx: {s.operating_room}</p>}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md whitespace-nowrap uppercase">
                            {arsList.find(a => a.id === s.ars_id)?.name || 'Sin ARS'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-600 max-w-[220px]">
                          <div className="flex flex-wrap gap-1">
                            {(s.procedure_type || '').split(',').map(p => p.trim()).filter(Boolean).map(p => (
                              <span key={p} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium leading-tight" title={p}>
                                {p.length > 28 ? p.slice(0, 26) + '…' : p}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-700 whitespace-nowrap">
                          {s.surgeon?.full_name || <span className="text-slate-300 italic">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-700 whitespace-nowrap">
                          {s.hospital?.name || <span className="text-slate-300 italic">—</span>}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <p className="text-sm font-medium text-slate-900">{new Date(s.surgery_date).toLocaleDateString('es-ES')}</p>
                          <p className={cn('text-xs', color)}>{label}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusMenu surgery={s} onUpdate={handleStatusUpdate} />
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex gap-1 flex-wrap">
                            {(s.surgery_trays||[]).map(st => st.tray && (
                              <span key={st.tray.id} className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                                {st.tray.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => printService.generateDeliverySheet(s)}
                              title="Imprimir Hoja de Entrega"
                              className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-900 transition-colors"
                            >
                              <Printer size={15} />
                            </button>
                            <button
                               onClick={() => setConsumptionModal(s)}
                               disabled={s.status !== 'Completada'}
                               title={s.status === 'Completada' ? "Reportar Gasto Quirúrgico" : "Solo disponible al completar la cirugía"}
                               className={cn(
                                 "p-2 rounded-lg transition-colors",
                                 s.status === 'Completada'
                                   ? "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                                   : "text-slate-200 cursor-not-allowed"
                               )}
                             >
                               <ShoppingCart size={15} />
                             </button>
                             <button
                               onClick={() => handleGenerateActa(s)}
                               disabled={!s.surgery_consumption?.length}
                               title={s.surgery_consumption?.length ? "Generar Acta Quirúrgica (PDF)" : "Debes registrar consumos primero"}
                               className={cn(
                                 "p-2 rounded-lg transition-colors",
                                 s.surgery_consumption?.length
                                   ? "text-slate-400 hover:bg-orange-50 hover:text-orange-600"
                                   : "text-slate-200 cursor-not-allowed"
                               )}
                             >
                               <FileText size={15} />
                             </button>
                             <button onClick={() => setModal({ data: s })} className="p-2 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"><Pencil size={15} /></button>
                             <button onClick={() => setConfirm({ id: s.id, name: s.patient_name })} className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={15} /></button>
                           </div>
                         </td>
                       </tr>
                     );
                   })}
                 </tbody>
               </table>
             </div>
           </div>
         )}

       <Modal isOpen={!!modal} onClose={() => setModal(null)} title={modal?.data ? 'Editar Cirugía' : 'Nueva Cirugía'} size="lg">
         <SurgeryForm initial={modal?.data} surgeons={surgeons} hospitals={hospitals} arsList={arsList} procedureTypes={procedureTypes} onSave={handleSave} onCancel={() => setModal(null)} loading={saving} />
       </Modal>
       <Modal isOpen={!!consumptionModal} onClose={() => setConsumptionModal(null)} title={`Reportar Gasto: ${consumptionModal?.patient_name}`} size="md">
         {consumptionModal && <ConsumptionForm surgery={consumptionModal} onSave={handleConsumptionReport} onCancel={() => setConsumptionModal(null)} loading={saving} />}
       </Modal>
      <ConfirmDialog
        isOpen={!!confirm} onClose={() => setConfirm(null)} onConfirm={handleDelete}
        title="¿Eliminar cirugía?" message={`¿Estás seguro de eliminar la cirugía de "${confirm?.name}"?`}
      />
    </div>
  );
};
