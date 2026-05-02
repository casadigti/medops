import React, { useEffect } from 'react';
import { Settings, User, Building2, Palette, Shield, Mail, Save, Image as ImageIcon, Bell, Edit2, Check, X, Upload, Lock, Trash2 } from 'lucide-react';
import { cn } from '../utils/cn';
import { configService } from '../services/configService';
import { Modal } from '../components/ui/Modal';

const UserForm = ({ onSave, onCancel, loading }) => {
  const [form, setForm] = React.useState({
    full_name: '', email: '', password: '', role: 'Editor', is_active: true, must_change_password: true
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  
  const submit = e => { e.preventDefault(); onSave(form); };
  
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre Completo *</label>
        <input required className="input" value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Ej: Dr. Juan Pérez" />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Correo Electrónico *</label>
        <input required type="email" className="input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="correo@ejemplo.com" />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Contraseña Temporal *</label>
        <input required type="text" className="input" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Ej: temporal123" />
        <p className="text-[10px] text-slate-400 mt-1">El usuario deberá cambiarla obligatoriamente al iniciar sesión.</p>
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Rol en el Sistema</label>
        <select className="input" value={form.role} onChange={e => set('role', e.target.value)}>
          <option value="Superadmin">Superadmin</option>
          <option value="Administrador">Administrador</option>
          <option value="Editor">Editor</option>
          <option value="Lector">Lector</option>
        </select>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={loading} className="btn btn-primary flex-1">
          {loading ? 'Guardando...' : 'Crear Usuario'}
        </button>
      </div>
    </form>
  );
};

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
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('identity');
  const [orgName, setOrgName] = React.useState('Casadig TI');
  const [primaryColor, setPrimaryColor] = React.useState('#1e40af');
  const [logoPreview, setLogoPreview] = React.useState(null);
  const [editingUser, setEditingUser] = React.useState(null);
  const [users, setUsers] = React.useState([]);
  const [isUserModalOpen, setIsUserModalOpen] = React.useState(false);
  const [isCreatingUser, setIsCreatingUser] = React.useState(false);

  const fetchUsers = async () => {
    try {
      const dbUsers = await configService.getUsers();
      if (dbUsers) {
        setUsers(dbUsers.map(u => ({
          id: u.id,
          name: u.full_name,
          email: u.email,
          role: u.role,
          status: u.is_active ? 'Activo' : 'Inactivo',
          password: '••••••••',
          isTemporal: u.must_change_password
        })));
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const settings = await configService.getSettings();
        if (settings) {
          setOrgName(settings.name || '');
          setPrimaryColor(settings.primary_color || '#1e40af');
          setLogoPreview(settings.logo_url);
        }
        await fetchUsers();
      } catch (error) {
        console.error('Error cargando configuración:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const handleCreateUser = async (data) => {
    setIsCreatingUser(true);
    try {
      await configService.createUser(data);
      await fetchUsers();
      setIsUserModalOpen(false);
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Error al crear el usuario. Revisa la consola.');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleUpdateUser = async (user) => {
    try {
      await configService.updateUser(user.id, {
        full_name: user.name,
        email: user.email,
        role: user.role,
        is_active: user.status === 'Activo',
        must_change_password: user.isTemporal
      });
      setEditingUser(null);
      await fetchUsers(); // Recargar datos limpios
    } catch (error) {
      console.error('Error actualizando usuario:', error);
      alert('Error al actualizar el usuario.');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (confirm('¿Estás seguro de que deseas eliminar este usuario de forma permanente?')) {
      try {
        await configService.deleteUser(userId);
        await fetchUsers();
      } catch (error) {
        console.error('Error eliminando usuario:', error);
        alert('Error al eliminar el usuario.');
      }
    }
  };

  const fileInputRef = React.useRef(null);

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      
      // 1. Guardar Identidad Corporativa
      const orgPromise = configService.updateSettings({
        name: orgName,
        primary_color: primaryColor,
        logo_url: logoPreview
      });

      // 2. Guardar Cambios en Usuarios (solo los que se editaron o todos para asegurar consistencia)
      const userPromises = users.map(u => 
        configService.updateUser(u.id, {
          full_name: u.name,
          email: u.email,
          role: u.role,
          is_active: u.status === 'Activo',
          must_change_password: u.isTemporal
        })
      );

      await Promise.all([orgPromise, ...userPromises]);
      
      setEditingUser(null);
      alert('¡Configuración guardada correctamente en la base de datos!');
    } catch (error) {
      console.error('Error al guardar:', error);
      alert('Error al sincronizar con la base de datos. Revisa la consola.');
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'identity', label: 'Identidad Corporativa', icon: Building2 },
    { id: 'users', label: 'Usuarios y Roles', icon: Shield },
    { id: 'security', label: 'Mi Seguridad', icon: Shield },
    { id: 'system', label: 'Sistema y Alertas', icon: Settings },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Configuración</h1>
          <p className="text-slate-500">Gestiona las preferencias y la identidad de tu plataforma</p>
        </div>
        <button className="btn btn-primary flex items-center gap-2 shadow-lg shadow-primary/30" onClick={handleSave}>
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
                  
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-6 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group overflow-hidden relative"
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleLogoUpload} 
                    />
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo Preview" className="max-h-24 object-contain mb-2 animate-in fade-in zoom-in-95" />
                    ) : (
                      <div className="w-16 h-16 bg-white rounded-xl shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform text-slate-400">
                        <ImageIcon size={32} />
                      </div>
                    )}
                    <p className="text-sm font-bold text-slate-900">{logoPreview ? 'Cambiar Logotipo' : 'Subir Logotipo'}</p>
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
                  <button className="btn btn-primary btn-sm flex items-center gap-2" onClick={() => setIsUserModalOpen(true)}>
                    <User size={16} /> Nuevo Usuario
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-16">Avatar</th>
                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Usuario / Email</th>
                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Contraseña</th>
                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Rol</th>
                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Estado</th>
                        <th className="px-6 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-400 border border-slate-200">
                              {u.name.substring(0, 2).toUpperCase()}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {editingUser === u.id ? (
                              <div className="space-y-1">
                                <input 
                                  className="input py-1 text-sm h-8" 
                                  defaultValue={u.name} 
                                  onChange={(e) => {
                                    setUsers(users.map(user => user.id === u.id ? {...user, name: e.target.value} : user));
                                  }}
                                  autoFocus
                                />
                                <input 
                                  className="input py-0.5 text-[11px] h-6 bg-slate-50 border-slate-100" 
                                  defaultValue={u.email} 
                                  onChange={(e) => {
                                    setUsers(users.map(user => user.id === u.id ? {...user, email: e.target.value} : user));
                                  }}
                                />
                              </div>
                            ) : (
                              <>
                                <p className="font-bold text-slate-900">{u.name}</p>
                                <p className="text-xs text-slate-500">{u.email}</p>
                              </>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {editingUser === u.id ? (
                              <div className="flex flex-col items-center gap-1">
                                <input 
                                  type="password"
                                  className="input py-1 text-xs h-8 w-24 mx-auto text-center" 
                                  placeholder="Nueva clave"
                                  onChange={(e) => {
                                    setUsers(users.map(user => user.id === u.id ? {...user, password: e.target.value} : user));
                                  }}
                                />
                                <label className="flex items-center gap-1 cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    checked={u.isTemporal} 
                                    onChange={(e) => {
                                      setUsers(users.map(user => user.id === u.id ? {...user, isTemporal: e.target.checked} : user));
                                    }}
                                    className="w-3 h-3 accent-primary"
                                  />
                                  <span className="text-[10px] text-slate-500 font-bold uppercase">Temporal</span>
                                </label>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-slate-300 font-mono tracking-tighter">{u.password}</span>
                                {u.isTemporal && (
                                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-black uppercase">Temporal</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {editingUser === u.id ? (
                              <select 
                                className="input py-1 text-xs h-8 w-32 mx-auto" 
                                defaultValue={u.role}
                                onChange={(e) => {
                                  setUsers(users.map(user => user.id === u.id ? {...user, role: e.target.value} : user));
                                }}
                              >
                                <option value="Superadmin">Superadmin</option>
                                <option value="Administrador">Administrador</option>
                                <option value="Editor">Editor</option>
                                <option value="Lector">Lector</option>
                              </select>
                            ) : (
                              <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-[11px] font-bold uppercase">{u.role}</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {editingUser === u.id ? (
                                <button 
                                  onClick={() => {
                                    const nextStatus = u.status === 'Activo' ? 'Inactivo' : 'Activo';
                                    setUsers(users.map(user => user.id === u.id ? {...user, status: nextStatus} : user));
                                  }}
                                  className={cn(
                                    "px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all",
                                    u.status === 'Activo' ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                                  )}
                                >
                                  {u.status}
                                </button>
                              ) : (
                                <>
                                  <div className={cn("w-2 h-2 rounded-full", u.status === 'Activo' ? "bg-green-500" : "bg-slate-300")} />
                                  <span className="font-medium text-slate-700">{u.status}</span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {editingUser === u.id ? (
                              <div className="flex items-center justify-end gap-3">
                                <button 
                                  onClick={() => handleDeleteUser(u.id)}
                                  className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                  title="Eliminar usuario"
                                >
                                  <Trash2 size={16} />
                                </button>
                                <button 
                                  onClick={() => handleUpdateUser(u)}
                                  className="text-white bg-primary px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-primary-600 shadow-sm transition-colors"
                                >
                                  Guardar
                                </button>
                                <button 
                                  onClick={() => setEditingUser(null)}
                                  className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => setEditingUser(u.id)}
                                className="text-primary font-bold hover:underline"
                              >
                                Editar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ConfigCard>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <ConfigCard>
                <SectionHeader 
                  title="Cambiar Contraseña" 
                  description="Actualiza tus credenciales de acceso para mantener tu cuenta segura." 
                />
                
                {/* Alerta de Contraseña Temporal (Simulada para el usuario actual) */}
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex gap-3 items-start animate-pulse">
                  <Shield className="text-amber-600 shrink-0" size={20} />
                  <div>
                    <p className="text-sm font-bold text-amber-900">Tu contraseña es temporal</p>
                    <p className="text-xs text-amber-700">Por seguridad, debes cambiar tu contraseña inicial por una definitiva para seguir operando en el sistema.</p>
                  </div>
                </div>

                <div className="max-w-md space-y-4">
                  <div>
                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1 block">Contraseña Actual</label>
                    <input type="password" placeholder="••••••••" className="input" />
                  </div>
                  <div>
                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1 block">Nueva Contraseña</label>
                    <input type="password" placeholder="Mínimo 8 caracteres" className="input" />
                  </div>
                  <div>
                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1 block">Confirmar Nueva Contraseña</label>
                    <input type="password" placeholder="Repite la nueva contraseña" className="input" />
                  </div>
                  <button className="btn btn-primary w-full shadow-lg shadow-primary/20 mt-4">
                    Actualizar Credenciales
                  </button>
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

      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title="Nuevo Usuario">
        <UserForm onSave={handleCreateUser} onCancel={() => setIsUserModalOpen(false)} loading={isCreatingUser} />
      </Modal>
    </div>
  );
};
