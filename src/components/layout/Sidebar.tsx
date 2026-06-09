import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Stethoscope, Package, Users, BarChart3, Settings,
  LogOut, Wrench, CalendarDays, Shield, Box, ShoppingCart, History, Building2, Warehouse, ClipboardList, ClipboardCheck, FileText,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { supabase } from '../../lib/supabase';
import type { UserProfile, NavItem } from '../../types/domain';

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard',        path: '/',                  roles: ['Superadmin', 'Administrador', 'Técnico', 'Editor', 'Lector'] },
  { icon: LayoutDashboard, label: 'Mi Portal',        path: '/mis-solicitudes',   roles: ['Cirujano'] },
  { icon: CalendarDays,    label: 'Calendario',        path: '/calendario',        roles: ['Superadmin', 'Administrador', 'Técnico', 'Cirujano', 'Editor', 'Lector'] },
  { icon: Stethoscope,     label: 'Cirugías',          path: '/cirugias',          roles: ['Superadmin', 'Administrador', 'Técnico', 'Cirujano', 'Editor', 'Lector'] },
  { icon: FileText,        label: 'Solicitudes',        path: '/solicitudes-admin', roles: ['Superadmin', 'Administrador', 'Editor'] },
  { icon: ClipboardCheck,  label: 'Prep. Bandejas',    path: '/preparacion',       roles: ['Superadmin', 'Administrador', 'Técnico', 'Editor'] },
  { icon: Package,         label: 'Bandejas / Sets',   path: '/bandejas',          roles: ['Superadmin', 'Administrador', 'Técnico', 'Editor'] },
  { icon: Box,             label: 'Inventario',         path: '/inventario',        roles: ['Superadmin', 'Administrador', 'Técnico', 'Editor'], showStockAlert: true },
  { icon: ShoppingCart,    label: 'Reporte de Gasto',  path: '/reporte-reposicion',roles: ['Superadmin', 'Administrador', 'Técnico', 'Editor'] },
  { icon: History,         label: 'Reporte Lotes',     path: '/reporte-lotes',     roles: ['Superadmin', 'Administrador', 'Técnico', 'Editor'] },
  { icon: Warehouse,       label: 'Mapa de Almacén',   path: '/almacen',            roles: ['Superadmin', 'Administrador', 'Técnico', 'Editor', 'Lector'] },
  { icon: Wrench,          label: 'Mantenimiento',     path: '/mantenimiento',     roles: ['Superadmin', 'Administrador', 'Técnico', 'Editor'] },
  { icon: Users,           label: 'Directorio',        path: '/directorio',        roles: ['Superadmin', 'Administrador', 'Técnico', 'Editor', 'Lector'] },
  { icon: BarChart3,       label: 'Reportes',          path: '/reportes',          roles: ['Superadmin', 'Administrador'] },
  { icon: ClipboardList,   label: 'Auditoría',          path: '/auditoria',         roles: ['Superadmin', 'Administrador'] },
  { icon: Settings,        label: 'Configuración',     path: '/configuracion',     roles: ['Superadmin', 'Administrador'] },
  { icon: Building2,       label: 'Organizaciones',    path: '/organizaciones',    roles: [], platformOnly: true },
  { icon: Shield,          label: 'Portal Cirujano',   path: '/mis-solicitudes',   roles: ['Superadmin', 'Administrador'], isPreview: true },
];

interface SidebarProps {
  className?: string;
  role?: string;
  profile?: Partial<UserProfile> | null;
  lowStockCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ className, role, profile, lowStockCount = 0 }) => {
  const filteredNavItems = navItems.filter(item => {
    if (item.platformOnly) return !!profile?.is_platform_admin;
    if (!role) return item.roles.some(r => r !== 'Cirujano');
    return item.roles.includes(role);
  });

  const getInitials = (name?: string | null): string => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <aside className={cn('w-64 h-screen bg-white border-r border-slate-200 flex-col fixed left-0 top-0 z-50 hidden lg:flex', className)}>
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

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {filteredNavItems.map((item, index) => {
          const prevItem = filteredNavItems[index - 1];
          const showSeparator = item.isPreview && prevItem && !prevItem.isPreview;
          return (
            <React.Fragment key={`${item.path}-${item.label}`}>
              {showSeparator && (
                <div className="pt-2 pb-1">
                  <div className="border-t border-slate-100 mb-2" />
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-4">Vista Previa</p>
                </div>
              )}
              <NavLink
                to={item.path}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group',
                  item.isPreview
                    ? isActive ? 'bg-violet-600 text-white shadow-md shadow-violet-200' : 'text-violet-600 hover:bg-violet-50 hover:text-violet-700'
                    : isActive ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-slate-600 hover:bg-slate-50 hover:text-primary'
                )}
              >
                <item.icon size={20} className="transition-transform group-hover:scale-110 opacity-80 group-hover:opacity-100" />
                <span className="font-medium">{item.label}</span>
                {item.showStockAlert && lowStockCount > 0 && (
                  <span className="ml-auto min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1.5 animate-pulse ring-2 ring-white">
                    {lowStockCount}
                  </span>
                )}
                {item.isPreview && (
                  <span className="ml-auto text-[9px] font-bold bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full">ADMIN</span>
                )}
              </NavLink>
            </React.Fragment>
          );
        })}
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
              if (confirm('¿Deseas cerrar sesión?')) {
                await supabase.auth.signOut();
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
