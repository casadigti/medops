import React, { useState, useEffect } from 'react';
import type { Tray, MaintenanceLog } from '../types/domain';
import { trayService } from '../services/trayService';
import { StatusBadge } from '../components/ui/Badge';
import { PageLoader } from '../components/ui/Spinner';
import { Wrench, ShieldAlert, CheckCircle2, History, X, Search } from 'lucide-react';
import { cn } from '../utils/cn';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/Toast';

export const Mantenimiento: React.FC = () => {
  const toast = useToast();
  const [trays, setTrays] = useState<Tray[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [selectedTray, setSelectedTray] = useState<Tray | null>(null);
  const [historyLogs, setHistoryLogs] = useState<MaintenanceLog[]>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    action: 'Reparación General',
    notes: ''
  });

  const MAX_USES = 200;

  const fetchData = async () => {
    try {
      const data = await trayService.getAll();
      setTrays(data.sort((a, b) => (b as any).sterilization_count - (a as any).sterilization_count));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenMaintenance = (tray: Tray) => {
    setSelectedTray(tray);
    setForm({ action: 'Reparación General', notes: '' });
    setActiveModal('maintenance');
  };

  const handleOpenHistory = async (tray: Tray) => {
    setSelectedTray(tray);
    setActiveModal('history');
    try {
      const logs = await trayService.getMaintenanceLogs(tray.id);
      setHistoryLogs(logs || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTray) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email || 'Sistema';

      await trayService.logMaintenance(selectedTray.id, form.action, form.notes, userEmail);
      await trayService.update(selectedTray.id, { status: 'En reparación' });

      setActiveModal(null);
      fetchData();
      toast.success('Mantenimiento registrado correctamente.');
    } catch (err) {
      console.error(err);
      toast.error('Error al registrar mantenimiento.');
    } finally {
      setSaving(false);
    }
  };

  const handleReintegrate = async (tray: Tray) => {
    if(window.confirm(`¿Estás seguro de reintegrar el set ${tray.name} y reiniciar su contador de usos?`)) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userEmail = session?.user?.email || 'Sistema';

        await trayService.logMaintenance(tray.id, 'Reintegración', 'Set listo para uso. Contador reiniciado.', userEmail);
        await trayService.update(tray.id, { status: 'Disponible', sterilization_count: 0 } as any);
        fetchData();
      } catch(err) {
        console.error(err);
      }
    }
  };

  const filteredTrays = trays.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.code ?? '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Wrench className="text-primary" /> Mantenimiento de Sets
          </h1>
          <p className="text-slate-500 text-sm mt-1">Control de esterilización y reparaciones.</p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por código o nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Set / Bandeja</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Estado Actual</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Desgaste (Usos)</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTrays.map((tray) => {
                const isCritical = (tray as any).sterilization_count >= MAX_USES;
                const isWarning = (tray as any).sterilization_count >= MAX_USES * 0.8;
                const progressPercentage = Math.min(((tray as any).sterilization_count / MAX_USES) * 100, 100);

                return (
                  <tr key={tray.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                          tray.status === 'En reparación' ? "bg-amber-100 text-amber-600" : "bg-primary/10 text-primary"
                        )}>
                          <Wrench size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{tray.name}</p>
                          <p className="text-[11px] font-mono text-slate-500 bg-slate-100 inline-block px-1.5 rounded mt-0.5">{tray.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={tray.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-full max-w-[200px]">
                        <div className="flex justify-between items-end mb-1">
                          <span className={cn(
                            "text-xs font-bold",
                            isCritical ? "text-danger" : isWarning ? "text-amber-500" : "text-slate-600"
                          )}>
                            {(tray as any).sterilization_count} / {MAX_USES}
                          </span>
                          {isCritical && <ShieldAlert size={14} className="text-danger animate-pulse" />}
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full transition-all duration-500",
                              isCritical ? "bg-danger" : isWarning ? "bg-amber-400" : "bg-primary"
                            )}
                            style={{ width: `${progressPercentage}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenHistory(tray)}
                          className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors tooltip-trigger"
                          title="Ver Historial"
                        >
                          <History size={18} />
                        </button>

                        {tray.status === 'En reparación' ? (
                          <button
                            onClick={() => handleReintegrate(tray)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-colors"
                          >
                            <CheckCircle2 size={14} /> Reintegrar
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenMaintenance(tray)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg text-xs font-bold transition-colors"
                          >
                            <Wrench size={14} /> Mantenimiento
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredTrays.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                    No se encontraron bandejas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {activeModal === 'maintenance' && selectedTray && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setActiveModal(null)} />
          <div className="relative bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Registrar Mantenimiento</h3>
                <p className="text-xs text-slate-500 mt-0.5">Set: {selectedTray.name}</p>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-full">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitMaintenance} className="p-6 space-y-4">
              <div className="bg-amber-50 text-amber-800 p-4 rounded-xl text-sm mb-4 border border-amber-100">
                Al guardar, la bandeja pasará al estado <strong>"En reparación"</strong> y no podrá ser asignada a nuevas cirugías temporalmente.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Acción Realizada / Requerida</label>
                <select
                  value={form.action}
                  onChange={e => setForm({...form, action: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  required
                >
                  <option value="Reparación General">Reparación General</option>
                  <option value="Afilado de Instrumental">Afilado de Instrumental</option>
                  <option value="Reemplazo de Pieza">Reemplazo de Pieza</option>
                  <option value="Limpieza Profunda">Limpieza Profunda</option>
                  <option value="Inspección Preventiva">Inspección Preventiva</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notas Adicionales</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({...form, notes: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all min-h-[100px] resize-none"
                  placeholder="Detalles sobre las piezas dañadas o acciones..."
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 px-4 py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 text-white bg-amber-500 hover:bg-amber-600 rounded-xl font-bold text-sm shadow-md shadow-amber-500/20 active:scale-[0.98] transition-all flex justify-center items-center"
                >
                  {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Confirmar Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeModal === 'history' && selectedTray && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setActiveModal(null)} />
          <div className="relative bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2"><History size={20} className="text-primary"/> Historial de Mantenimiento</h3>
                <p className="text-xs text-slate-500 mt-0.5">Set: {selectedTray.name} ({selectedTray.code})</p>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-full">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {historyLogs.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <ShieldAlert size={24} className="text-slate-300" />
                  </div>
                  <p className="text-slate-500 text-sm font-medium">No hay registros de mantenimiento.</p>
                </div>
              ) : (
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                  {historyLogs.map((log) => (
                    <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-slate-100 text-slate-500 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
                        {log.action === 'Reintegración' ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Wrench size={16} />}
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl border border-slate-100 bg-white shadow-sm transition-all hover:border-slate-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className={cn(
                            "text-xs font-bold uppercase tracking-wider",
                            log.action === 'Reintegración' ? "text-emerald-600" : "text-amber-600"
                          )}>
                            {log.action}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(log.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {log.notes && <p className="text-sm text-slate-600 mb-2">{log.notes}</p>}
                        <div className="text-[10px] text-slate-400 font-medium">
                          Registrado por: {log.performed_by}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
