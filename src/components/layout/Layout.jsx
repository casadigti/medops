import { Sidebar } from './Sidebar';
import { Bell, Search, User } from 'lucide-react';
import { surgeryService } from '../../services/surgeryService';
import { cn } from '../../utils/cn';
import { useNavigate } from 'react-router-dom';

export const Layout = ({ children }) => {
  const navigate = useNavigate();
  const [globalSearch, setGlobalSearch] = React.useState('');
  const [time, setTime] = React.useState(new Date());
  const [alerts, setAlerts] = React.useState([]);
  const [showNotifs, setShowNotifs] = React.useState(false);

  const handleSearch = (e) => {
    if (e.key === 'Enter' && globalSearch.trim()) {
      navigate(`/cirugias?q=${encodeURIComponent(globalSearch.trim())}`);
      setGlobalSearch('');
    }
  };

  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000);
    
    // Fetch alerts for notifications
    surgeryService.getAll().then(data => {
      const now = new Date();
      const activeAlerts = data
        .filter(s => s.status === 'Pendiente')
        .map(s => {
          const diff = Math.ceil((new Date(s.surgery_date) - now) / 86400000);
          if (diff <= 1) return { ...s, type: 'CRÍTICO', color: 'text-red-600', bg: 'bg-red-50' };
          if (diff <= 2) return { ...s, type: 'URGENTE', color: 'text-amber-600', bg: 'bg-amber-50' };
          return null;
        }).filter(Boolean);
      setAlerts(activeAlerts);
    });

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen flex flex-col">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-40">
          <div className="flex-1 max-w-md">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Buscar pacientes o procedimientos..." 
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onKeyDown={handleSearch}
                className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setShowNotifs(!showNotifs)}
                className={cn(
                  "relative p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-colors",
                  showNotifs && "bg-slate-100 text-primary"
                )}
              >
                <Bell size={20} />
                {alerts.length > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white animate-pulse">
                    {alerts.length}
                  </span>
                )}
              </button>

              {showNotifs && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowNotifs(false)} />
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="font-bold text-slate-900">Notificaciones</h3>
                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                        {alerts.length} NUEVAS
                      </span>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {alerts.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm">No hay alertas pendientes</div>
                      ) : (
                        alerts.map(a => (
                          <div key={a.id} className={cn("p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer", a.bg)}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={cn("text-[9px] font-black uppercase tracking-tighter", a.color)}>{a.type}</span>
                              <span className="text-[10px] text-slate-400 ml-auto">{new Date(a.surgery_date).toLocaleDateString()}</span>
                            </div>
                            <p className="text-sm font-bold text-slate-900">{a.patient_name}</p>
                            <p className="text-xs text-slate-500 truncate">{a.procedure_type}</p>
                          </div>
                        ))
                      )}
                    </div>
                    <button className="w-full py-3 text-xs font-bold text-primary hover:bg-slate-50 border-t border-slate-100 transition-colors">
                      Ver todas las cirugías
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="h-8 w-px bg-slate-200 mx-2" />
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs text-slate-500 font-medium capitalize">
                  {time.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <p className="text-sm font-bold text-slate-900 uppercase">
                  {time.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-8 flex-1 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {children}
        </div>
      </main>
    </div>
  );
};
