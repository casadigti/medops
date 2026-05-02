import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Stethoscope, 
  Package, 
  Users, 
  BarChart3, 
  Settings,
  Bell,
  LogOut,
  Wrench
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { supabase } from '../../lib/supabase';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', roles: ['Superadmin', 'Administrador', 'Técnico', 'Cirujano', 'Editor', 'Lector'] },
  { icon: Stethoscope, label: 'Cirugías', path: '/cirugias', roles: ['Superadmin', 'Administrador', 'Técnico', 'Cirujano', 'Editor', 'Lector'] },
  { icon: Package, label: 'Bandejas / Sets', path: '/bandejas', roles: ['Superadmin', 'Administrador', 'Técnico', 'Editor'] },
  { icon: Wrench, label: 'Mantenimiento', path: '/mantenimiento', roles: ['Superadmin', 'Administrador', 'Técnico', 'Editor'] },
  { icon: Users, label: 'Directorio', path: '/directorio', roles: ['Superadmin', 'Administrador', 'Técnico', 'Cirujano', 'Editor', 'Lector'] },
  { icon: BarChart3, label: 'Reportes', path: '/reportes', roles: ['Superadmin', 'Administrador'] },
  { icon: Settings, label: 'Configuración', path: '/configuracion', roles: ['Superadmin', 'Administrador'] },
];

export const Sidebar = ({ className, role, profile }) => {
  const filteredNavItems = navItems.filter(item => !role || item.roles.includes(role));

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <aside className={cn("w-64 h-screen bg-white border-r border-slate-200 flex-col fixed left-0 top-0 z-50 hidden lg:flex", className)}>
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <Stethoscope size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">MedOps</h1>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Gestión Médica</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {filteredNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
              isActive 
                ? "bg-primary text-white shadow-md shadow-primary/20" 
                : "text-slate-600 hover:bg-slate-50 hover:text-primary"
            )}
          >
            <item.icon size={20} className={cn(
              "transition-transform group-hover:scale-110",
              "opacity-80 group-hover:opacity-100"
            )} />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 mt-auto border-t border-slate-100">
        <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold shadow-sm">
            {getInitials(profile?.full_name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate" title={profile?.full_name}>{profile?.full_name || 'Cargando...'}</p>
            <p className="text-[10px] text-slate-500 truncate" title={profile?.email}>{profile?.email || '...'}</p>
          </div>
          {(role === 'Superadmin' || role === 'Administrador') && (
            <NavLink to="/configuracion" className="text-slate-400 hover:text-primary transition-colors p-1.5 hover:bg-white rounded-lg shadow-sm">
              <Settings size={18} />
            </NavLink>
          )}
          <button 
            onClick={async () => {
              if(confirm('¿Deseas cerrar sesión?')) {
                await supabase.auth.signOut();
                // El useEffect de App.jsx detectará el cambio y redirigirá al login automáticamente
              }
            }}
            className="text-slate-400 hover:text-danger transition-colors p-1.5 hover:bg-white rounded-lg shadow-sm"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
};
