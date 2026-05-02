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
  LogOut
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { supabase } from '../../lib/supabase';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Stethoscope, label: 'Cirugías', path: '/cirugias' },
  { icon: Package, label: 'Bandejas / Sets', path: '/bandejas' },
  { icon: Users, label: 'Directorio', path: '/directorio' },
  { icon: BarChart3, label: 'Reportes', path: '/reportes' },
  { icon: Settings, label: 'Configuración', path: '/configuracion' },
];

export const Sidebar = ({ className }) => {
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
        {navItems.map((item) => (
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
            CT
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">Casadig TI</p>
            <p className="text-[10px] text-slate-500 truncate">informatica@casadigrd.com</p>
          </div>
          <NavLink to="/configuracion" className="text-slate-400 hover:text-primary transition-colors p-1.5 hover:bg-white rounded-lg shadow-sm">
            <Settings size={18} />
          </NavLink>
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
