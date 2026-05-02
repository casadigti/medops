import React from 'react';
import { Settings, User, Building2, Palette, Shield, Mail, Save, Image as ImageIcon } from 'lucide-react';
import { cn } from '../utils/cn';

const SectionHeader = ({ title, description }) => (
  <div className="mb-6">
    <h3 className="text-lg font-bold text-slate-900">{title}</h3>
    <p className="text-sm text-slate-500">{description}</p>
  </div>
);

const ConfigCard = ({ children, className }) => (
  <div className={cn("bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden", className)}>
    <div className="p-6">{children}</div>
  </div>
);

export const Configuracion = () => {
  const [activeTab, setActiveTab] = React.useState('identity');

  const tabs = [
    { id: 'identity', label: 'Identidad Corporativa', icon: Building2 },
    { id: 'users', label: 'Usuarios y Roles', icon: Shield },
    { id: 'system', label: 'Sistema y Alertas', icon: Settings },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Configuración</h1>
          <p className="text-slate-500">Gestiona las preferencias y la identidad de tu plataforma</p>
        </div>
        <button className="btn btn-primary flex items-center gap-2">
          <Save size={18} /> Guardar Cambios
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar de navegación interna */}
        <aside className="lg:w-64 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                activeTab === tab.id 
                  ? "bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]" 
                  : "text-slate-500 hover:bg-slate-100"
              )}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </aside>

        {/* Contenido principal */}
        <div className="flex-1">
          {activeTab === 'identity' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <ConfigCard>
                <SectionHeader 
                  title="Branding General" 
                  description="Personaliza cómo se ve tu plataforma ante los usuarios." 
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1 block">Nombre de la Organización</label>
                      <input type="text" className="input" placeholder="Ej: Medical Core Dominicana" defaultValue="MedOps Dominicana" />
                    </div>
                    <div>
                      <label className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1 block">Eslogan / Subtítulo</label>
                      <input type="text" className="input" placeholder="Gestión Médica Especializada" defaultValue="Gestión Médica Especializada" />
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-6 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group">
                    <div className="w-16 h-16 bg-white rounded-xl shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <ImageIcon className="text-slate-400" size={32} />
                    </div>
                    <p className="text-sm font-bold text-slate-900">Subir Logotipo</p>
                    <p className="text-[10px] text-slate-400">PNG o SVG (Max. 2MB)</p>
                  </div>
                </div>
              </ConfigCard>

              <ConfigCard>
                <SectionHeader 
                  title="Paleta de Colores" 
                  description="Define los colores principales de la interfaz." 
                />
                <div className="flex flex-wrap gap-4">
                  {[
                    { label: 'Color Primario', color: '#1e40af' },
                    { label: 'Color Secundario', color: '#64748b' },
                    { label: 'Acento', color: '#0ea5e9' }
                  ].map((c) => (
                    <div key={c.label} className="flex-1 min-w-[200px] p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="text-xs font-bold text-slate-600 mb-3">{c.label}</p>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg shadow-inner" style={{ backgroundColor: c.color }} />
                        <code className="text-sm font-mono text-slate-500 uppercase">{c.color}</code>
                      </div>
                    </div>
                  ))}
                </div>
              </ConfigCard>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <ConfigCard className="p-0">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                  <SectionHeader 
                    title="Usuarios del Sistema" 
                    description="Administra quién tiene acceso y qué permisos posee." 
                  />
                  <button className="btn btn-primary btn-sm flex items-center gap-2">
                    <User size={16} /> Nuevo Usuario
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Usuario</th>
                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Rol</th>
                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                        <th className="px-6 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {[
                        { name: 'Admin MedOps', email: 'admin@medops.do', role: 'Superadmin', status: 'Activo' },
                        { name: 'Soporte Técnico', email: 'soporte@casadigti.com', role: 'Administrador', status: 'Activo' },
                        { name: 'Operaciones', email: 'ops@medops.do', role: 'Editor', status: 'Inactivo' },
                      ].map((u) => (
                        <tr key={u.email} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-900">{u.name}</p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-[11px] font-bold uppercase">{u.role}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className={cn("w-2 h-2 rounded-full", u.status === 'Activo' ? "bg-green-500" : "bg-slate-300")} />
                              <span className="font-medium text-slate-700">{u.status}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button className="text-primary font-bold hover:underline">Editar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ConfigCard>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <ConfigCard>
                <SectionHeader 
                  title="Conectividad de Email" 
                  description="Configuración de notificaciones automáticas vía Resend." 
                />
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1 block">Resend API Key</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="password" 
                        className="input pl-10" 
                        defaultValue="re_xxxxxxxxxxxxxxxxxxxxxx" 
                        readOnly
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400 italic">La clave está encriptada y se gestiona a través de Supabase Secrets por seguridad.</p>
                  </div>
                </div>
              </ConfigCard>

              <ConfigCard className="border-danger/20 bg-danger/[0.02]">
                <SectionHeader 
                  title="Zona de Peligro" 
                  description="Acciones irreversibles sobre el sistema." 
                />
                <button className="btn bg-white border-danger text-danger hover:bg-danger hover:text-white transition-all font-bold">
                  Reiniciar Base de Datos
                </button>
              </ConfigCard>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
