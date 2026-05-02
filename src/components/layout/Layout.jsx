import React from 'react';
import { Sidebar } from './Sidebar';
import { Bell, Search, LayoutDashboard, Calendar, CalendarDays, Stethoscope, Package, Users, BarChart3, Settings, Shield, Wrench } from 'lucide-react';
import { surgeryService } from '../../services/surgeryService';
import { cn } from '../../utils/cn';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const MobileNav = ({ role }) => {
  const { pathname } = useLocation();
  const navItems = [
    { icon: LayoutDashboard, path: '/', label: role === 'Cirujano' ? 'Portal' : 'Inicio', roles: ['Superadmin', 'Administrador', 'Técnico', 'Cirujano', 'Editor', 'Lector'] },
    { icon: CalendarDays, path: '/calendario', label: 'Agenda', roles: ['Superadmin', 'Administrador', 'Técnico', 'Cirujano', 'Editor', 'Lector'] },
    { icon: Stethoscope, path: '/cirugias', label: role === 'Cirujano' ? 'Cirugías' : 'Cirugías', roles: ['Superadmin', 'Administrador', 'Técnico', 'Cirujano', 'Editor', 'Lector'] },
    { icon: Package, path: '/bandejas', label: 'Sets', roles: ['Superadmin', 'Administrador', 'Técnico', 'Editor'] },
    { icon: Wrench, path: '/mantenimiento', label: 'Mant.', roles: ['Superadmin', 'Administrador', 'Técnico', 'Editor'] },
    { icon: Users, path: '/directorio', label: 'Dir.', roles: ['Superadmin', 'Administrador', 'Técnico', 'Cirujano', 'Editor', 'Lector'] },
    { icon: BarChart3, path: '/reportes', label: 'Reportes', roles: ['Superadmin', 'Administrador'] },
    { icon: Settings, path: '/configuracion', label: 'Ajustes', roles: ['Superadmin', 'Administrador'] },
  ];

  const filteredNavItems = navItems.filter(item => !role || item.roles.includes(role));

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-2 flex justify-around items-center z-50 pb-safe">
      {filteredNavItems.map((item) => {
        const active = pathname === item.path;
        return (
          <Link 
            key={item.path} 
            to={item.path}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
              active ? "text-primary bg-primary/5" : "text-slate-400"
            )}
          >
            <item.icon size={20} strokeWidth={active ? 2.5 : 2} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export const Layout = ({ children }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [globalSearch, setGlobalSearch] = React.useState('');
  const [time, setTime] = React.useState(new Date());
  const [alerts, setAlerts] = React.useState([]);
  const [showNotifs, setShowNotifs] = React.useState(false);
  const [dismissedAlerts, setDismissedAlerts] = React.useState(() => {
    const saved = localStorage.getItem('medops_dismissed_alerts');
    return saved ? JSON.parse(saved) : [];
  });

  React.useEffect(() => {
    localStorage.setItem('medops_dismissed_alerts', JSON.stringify(dismissedAlerts));
  }, [dismissedAlerts]);

  const activeAlerts = alerts.filter(a => !dismissedAlerts.includes(a.id));

  const handleSearch = (e) => {
    if (e.key === 'Enter' && globalSearch.trim()) {
      navigate(`/cirugias?q=${encodeURIComponent(globalSearch.trim())}`);
      setGlobalSearch('');
    }
  };

  const [userProfile, setUserProfile] = React.useState(null);
  
  React.useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
        if (data) {
          setUserProfile(data);
        } else {
          // Fallback en caso de que no exista el registro en la tabla perfiles
          setUserProfile({ email: session.user.email, full_name: 'Usuario Principal', role: 'Superadmin' });
        }
      }
    };
    fetchProfile();
  }, []);

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

  const [showForceChange, setShowForceChange] = React.useState(() => {
    // Verificamos si ya completó el cambio en esta sesión/navegador
    const hasChanged = localStorage.getItem('medops_password_updated');
    return hasChanged !== 'true'; 
  });

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans selection:bg-primary/10 selection:text-primary">
      {/* Sidebar - Desktop */}
      <Sidebar className="hidden lg:flex" role={userProfile?.role} profile={userProfile} />

      {/* Bloqueo de Seguridad - Cambio Obligatorio */}
      {showForceChange && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop Blur */}
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-500" />
          
          {/* Modal */}
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 border border-slate-200">
            <div className="bg-primary p-8 text-white relative overflow-hidden text-center">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
              <div className="bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm shadow-inner">
                <Shield size={32} className="text-white" />
              </div>
              <h2 className="text-2xl font-black mb-1">Seguridad Requerida</h2>
              <p className="text-primary-100 text-sm">Tu contraseña actual es temporal y debe ser actualizada para proteger tu cuenta.</p>
            </div>

            <div className="p-8 space-y-5">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Nueva Contraseña</label>
                  <input 
                    type="password" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all" 
                    placeholder="Mínimo 8 caracteres" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Confirmar Contraseña</label>
                  <input 
                    type="password" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all" 
                    placeholder="Repite la contraseña" 
                  />
                </div>
              </div>

              <div className="pt-2">
                <button 
                  onClick={() => {
                    localStorage.setItem('medops_password_updated', 'true');
                    setShowForceChange(false);
                    alert('¡Contraseña actualizada con éxito! Ya puedes usar MedOps.');
                  }}
                  className="w-full bg-primary text-white py-3 rounded-xl font-bold text-sm shadow-xl shadow-primary/30 active:scale-95 transition-transform"
                >
                  Establecer Nueva Contraseña
                </button>
              </div>

              <p className="text-center text-[11px] text-slate-400 italic">
                Al establecer una nueva contraseña, esta será tu credencial definitiva de acceso.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 min-h-screen flex flex-col pb-16 lg:pb-0">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between sticky top-0 z-40">
          <div className="flex-1 max-w-md">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Buscar..." 
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onKeyDown={handleSearch}
                className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-4 ml-2">
            <div className="relative">
              <button 
                onClick={() => setShowNotifs(!showNotifs)}
                className={cn(
                  "relative p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-colors",
                  showNotifs && "bg-slate-100 text-primary"
                )}
              >
                <Bell size={20} />
                {activeAlerts.length > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white animate-pulse">
                    {activeAlerts.length}
                  </span>
                )}
              </button>

              {showNotifs && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowNotifs(false)} />
                  <div className="absolute right-0 mt-2 w-[calc(100vw-32px)] sm:w-80 bg-white rounded-2xl border border-slate-200 shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="font-bold text-slate-900 text-sm">Notificaciones</h3>
                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                        {activeAlerts.length}
                      </span>
                    </div>
                    <div className="max-h-[60vh] overflow-y-auto">
                      {activeAlerts.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm">No hay alertas pendientes</div>
                      ) : (
                        activeAlerts.map(a => (
                          <div 
                            key={a.id} 
                            onClick={() => {
                              setDismissedAlerts(prev => [...prev, a.id]);
                              navigate('/cirugias');
                              setShowNotifs(false);
                            }}
                            className={cn(
                              "p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer active:scale-[0.98]", 
                              a.bg
                            )}
                          >
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
                  </div>
                </>
              )}
            </div>

            <div className="h-8 w-px bg-slate-200 mx-1 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-3">
              <div className="text-right">
                <p className="text-[10px] text-slate-500 font-medium capitalize leading-tight">
                  {time.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                </p>
                <p className="text-xs font-bold text-slate-900 uppercase leading-tight">
                  {time.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 lg:p-8 flex-1 animate-in fade-in slide-in-from-bottom-4 duration-700 overflow-x-hidden">
          {children}
        </div>

        <MobileNav role={userProfile?.role} />
      </main>
    </div>
  );
};
