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

  const filteredNavItems = navItems.filter(item => {
    if (!role) return item.roles.some(r => r !== 'Cirujano');
    return item.roles.includes(role);
  });

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-2 flex justify-around items-center z-50 pb-safe">
      {filteredNavItems.map((item) => {
        const active = pathname === item.path;
        return (
          <Link 
            key={`${item.path}-${item.label}`}
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

import { NotificationPanel } from './NotificationPanel';
import { notificationService } from '../../services/notificationService';

export const Layout = ({ children, userProfile }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [globalSearch, setGlobalSearch] = React.useState('');
  const [time, setTime] = React.useState(new Date());
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [showNotifs, setShowNotifs] = React.useState(false);

  React.useEffect(() => {
    if (!userProfile?.id) return;

    // Load initial unread count
    notificationService.getMyNotifications().then(data => {
      setUnreadCount(data.filter(n => !n.is_read).length);
    });

    // Subscribe to new notifications to update badge
    const subscription = notificationService.subscribeToNotifications(userProfile.id, () => {
      setUnreadCount(prev => prev + 1);
    });

    return () => subscription.unsubscribe();
  }, [userProfile?.id]);

  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleSearch = (e) => {
    if (e.key === 'Enter' && globalSearch.trim()) {
      navigate(`/cirugias?q=${encodeURIComponent(globalSearch.trim())}`);
      setGlobalSearch('');
    }
  };

  const role = userProfile?.role;

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans selection:bg-primary/10 selection:text-primary">
      {/* Sidebar - Desktop */}
      <Sidebar className="hidden lg:flex" role={userProfile?.role} profile={userProfile} />

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
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifs && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowNotifs(false)} />
                  <NotificationPanel 
                    userId={userProfile?.id} 
                    isOpen={showNotifs} 
                    onClose={() => setShowNotifs(false)} 
                  />
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
