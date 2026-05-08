import React, { useEffect } from 'react';
import { Settings, User, Building2, Palette, Shield, Mail, Save, Image as ImageIcon, Bell, Edit2, Check, X, Upload, Lock, Trash2, Plus } from 'lucide-react';
import { cn } from '../utils/cn';
import { configService } from '../services/configService';
import { Modal } from '../components/ui/Modal';
import { supabase } from '../lib/supabase';
import { arsService } from '../services/arsService';
import { auditService } from '../services/auditService';
import { useToast } from '../components/ui/Toast';

const UserForm = ({ onSave, onCancel, loading, initialData }) => {
  const [form, setForm] = React.useState({
    full_name: initialData?.name || '', 
    email: initialData?.email || '', 
    password: '', 
    role: initialData?.role || 'Editor', 
    is_active: initialData?.status === 'Activo', 
    must_change_password: initialData?.isTemporal ?? true
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  
  const submit = e => { 
    e.preventDefault(); 
    if (initialData) {
      onSave({ ...initialData, ...form });
    } else {
      onSave(form); 
    }
  };
  
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
      {!initialData && (
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Contraseña Temporal *</label>
          <input required type="text" className="input" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Ej: temporal123" />
          <p className="text-[10px] text-slate-400 mt-1">El usuario deberá cambiarla obligatoriamente al iniciar sesión.</p>
        </div>
      )}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Rol en el Sistema</label>
        <select className="input" value={form.role} onChange={e => set('role', e.target.value)}>
          <option value="Superadmin">Superadmin</option>
          <option value="Administrador">Administrador</option>
          <option value="Editor">Editor</option>
          <option value="Técnico">Técnico (Almacén)</option>
          <option value="Cirujano">Cirujano (Doctor)</option>
          <option value="Lector">Lector</option>
        </select>
      </div>
      <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl">
        <input 
          type="checkbox" 
          id="is_active"
          className="w-4 h-4 text-primary rounded border-slate-300" 
          checked={form.is_active} 
          onChange={e => set('is_active', e.target.checked)} 
        />
        <label htmlFor="is_active" className="text-sm font-bold text-slate-700 cursor-pointer">Usuario Activo</label>
      </div>
      {initialData && (
        <div className="p-3 border border-amber-100 bg-amber-50 rounded-xl">
          <label className="block text-[10px] font-black text-amber-600 uppercase mb-2">Reset de Seguridad</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              className="input bg-white text-xs" 
              placeholder="Nueva temporal (opcional)" 
              value={form.password} 
              onChange={e => set('password', e.target.value)} 
            />
          </div>
          <p className="text-[10px] text-amber-700 mt-1">Si escribes una contraseña, se forzará el cambio al entrar.</p>
        </div>
      )}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={loading} className="btn btn-primary flex-1">
          {loading ? 'Guardando...' : initialData ? 'Guardar Cambios' : 'Crear Usuario'}
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

export const Configuracion = ({ userProfile: profile }) => {
  const toast = useToast();
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('identity');
  const [orgName, setOrgName] = React.useState('Casadig TI');
  const [primaryColor, setPrimaryColor] = React.useState('#1e40af');
  const [logoPreview, setLogoPreview] = React.useState(null);
  const [editingUser, setEditingUser] = React.useState(null);
  const [users, setUsers] = React.useState([]);
  const [isUserModalOpen, setIsUserModalOpen] = React.useState(false);
  const [isCreatingUser, setIsCreatingUser] = React.useState(false);
  const [arsList, setArsList] = React.useState([]);
  const [newArsName, setNewArsName] = React.useState('');
  const [editingArsId, setEditingArsId] = React.useState(null);
  const [editingArsName, setEditingArsName] = React.useState('');
  const [isArsLoading, setIsArsLoading] = React.useState(false);
  const [logs, setLogs] = React.useState([]);
  const [isLogsLoading, setIsLogsLoading] = React.useState(false);

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

  const fetchArs = async () => {
    try {
      const data = await arsService.getAll();
      setArsList(data || []);
    } catch (error) {
      console.error('Error fetching ARS:', error);
    }
  };

  const fetchLogs = async () => {
    if (profile?.role !== 'Superadmin') return;
    try {
      setIsLogsLoading(true);
      const data = await auditService.getAll();
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setIsLogsLoading(false);
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
        await Promise.all([fetchUsers(), fetchArs(), fetchLogs()]);
      } catch (error) {
        console.error('Error cargando configuración:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
    
    // Set default tab based on role
    if (profile?.role === 'Cirujano') {
      setActiveTab('security');
    }
  }, [profile]);

  const handleCreateUser = async (data) => {
    setIsCreatingUser(true);
    try {
      await configService.createUser(data);
      await fetchUsers();
      setIsUserModalOpen(false);
      toast.success('Usuario creado correctamente.');
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Error al crear el usuario: ' + (error.message || 'Error desconocido'));
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleUpdateUser = async (user) => {
    try {
      const updates = {
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
      };

      // Si se definió una nueva contraseña, incluirla en la llamada a la Edge Function
      if (user.password && user.password.trim() !== '') {
        updates.password = user.password.trim();
        updates.must_change_password = true;
      }

      await configService.updateUser(user.id, updates);
      setEditingUser(null);
      await fetchUsers();
      toast.success('Usuario actualizado correctamente.');
    } catch (error) {
      console.error('Error actualizando usuario:', error);
      toast.error('Error al actualizar: ' + (error.message || 'Error desconocido'));
    }
  };

  const handleDeleteUser = async (userId) => {
    if (confirm('¿Estás seguro de que deseas eliminar este usuario de forma permanente?')) {
      try {
        await configService.deleteUser(userId);
        await fetchUsers();
        toast.success('Usuario eliminado.');
      } catch (error) {
        console.error('Error eliminando usuario:', error);
        toast.error('Error al eliminar el usuario: ' + (error.message || ''));
      }
    }
  };

  const handleAddArs = async (e) => {
    e.preventDefault();
    if (!newArsName.trim()) return;
    setIsArsLoading(true);
    try {
      await arsService.create(newArsName.trim());
      setNewArsName('');
      await fetchArs();
      toast.success('ARS agregada correctamente.');
    } catch (error) {
      toast.error('Error al agregar ARS: ' + error.message);
    } finally {
      setIsArsLoading(false);
    }
  };

  const handleDeleteArs = async (id) => {
    if (!confirm('¿Eliminar esta aseguradora?')) return;
    try {
      await arsService.delete(id);
      await fetchArs();
      toast.success('Aseguradora eliminada.');
    } catch (error) {
      toast.error('Error al eliminar: ' + error.message);
    }
  };

  const handleUpdateArs = async (id) => {
    if (!editingArsName.trim()) return;
    try {
      await arsService.update(id, { name: editingArsName.trim() });
      setEditingArsId(null);
      await fetchArs();
      toast.success('Aseguradora actualizada.');
    } catch (error) {
      toast.error('Error al actualizar: ' + error.message);
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
      await configService.updateSettings({
        name: orgName,
        primary_color: primaryColor,
        logo_url: logoPreview
      });
      toast.success('¡Configuración guardada correctamente!');
    } catch (error) {
      console.error('Error al guardar:', error);
      toast.error('Error al guardar configuración.');
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'identity', label: 'Identidad Corporativa', icon: Building2, roles: ['Superadmin', 'Administrador'] },
    { id: 'users', label: 'Usuarios y Roles', icon: Shield, roles: ['Superadmin', 'Administrador'] },
    { id: 'ars', label: 'Catálogo ARS', icon: Palette, roles: ['Superadmin', 'Administrador'] },
    { id: 'logs', label: 'Logs del Sistema', icon: Bell, roles: ['Superadmin'] },
    { id: 'security', label: 'Mi Seguridad', icon: Shield, roles: ['Superadmin', 'Administrador', 'Cirujano', 'Editor', 'Técnico', 'Lector'] },
    { id: 'system', label: 'Sistema y Alertas', icon: Settings, roles: ['Superadmin', 'Administrador'] },
  ];

  const filteredTabs = tabs.filter(t => !t.roles || t.roles.includes(profile?.role));

  // Password Change State
  const [passForm, setPassForm] = React.useState({ new: '', confirm: '' });
  const [passLoading, setPassLoading] = React.useState(false);

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (passForm.new !== passForm.confirm) { toast.error('Las contraseñas no coinciden'); return; }
    if (passForm.new.length < 6) { toast.warning('La contraseña debe tener al menos 6 caracteres'); return; }

    setPassLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passForm.new });
      if (error) throw error;
      
      await supabase.from('profiles').update({ must_change_password: false }).eq('id', profile.id);
      
      setPassForm({ new: '', confirm: '' });
      toast.success('Contraseña actualizada correctamente.');
    } catch (err) {
      toast.error(err.message || 'Error al actualizar contraseña');
    } finally {
      setPassLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Configuración</h1>
          <p className="text-slate-500">Gestiona las preferencias y la identidad de tu plataforma</p>
        </div>
        {filteredTabs.some(t => t.id === 'identity') && (
          <button className="btn btn-primary flex items-center gap-2 shadow-lg shadow-primary/30" onClick={handleSave}>
            <Save size={18} /> Guardar Cambios
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="lg:w-64 space-y-1">
          {filteredTabs.map((tab) => (
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

        <div className="flex-1">
          {activeTab === 'identity' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <ConfigCard>
                <SectionHeader title="Branding General" description="Personaliza cómo se ve tu plataforma ante los usuarios." />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1 block">Nombre de la Organización</label>
                      <input type="text" className="input" value={orgName} onChange={e => setOrgName(e.target.value)} />
                    </div>
                  </div>
                  <div onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-6 bg-slate-50 hover:bg-slate-100 cursor-pointer group relative">
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" className="max-h-24 object-contain mb-2" />
                    ) : (
                      <div className="w-16 h-16 bg-white rounded-xl shadow-sm flex items-center justify-center mb-3 text-slate-400"><ImageIcon size={32} /></div>
                    )}
                    <p className="text-sm font-bold text-slate-900">Subir Logotipo</p>
                  </div>
                </div>
              </ConfigCard>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <ConfigCard className="p-0">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                  <SectionHeader title="Usuarios del Sistema" description="Administra quién tiene acceso y qué permisos posee." />
                  <button className="btn btn-primary btn-sm flex items-center gap-2" onClick={() => setIsUserModalOpen(true)}><User size={16} /> Nuevo Usuario</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Usuario / Email</th>
                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Rol</th>
                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Estado</th>
                        <th className="px-6 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-900">{u.name}</p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-[11px] font-bold uppercase">{u.role}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className={cn("w-2 h-2 rounded-full", u.status === 'Activo' ? "bg-green-500" : "bg-slate-300")} />
                              <span className="font-medium text-slate-700">{u.status}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end items-center gap-3">
                              <button onClick={() => setEditingUser(u)} className="text-primary font-bold hover:underline">Editar</button>
                              <button onClick={() => handleDeleteUser(u.id)} className="text-slate-300 hover:text-danger transition-colors">
                                <Trash2 size={16} />
                              </button>
                            </div>
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
                <SectionHeader title="Cambiar Contraseña" description="Actualiza tus credenciales de acceso para mantener tu cuenta segura." />
                {profile?.must_change_password && (
                  <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex gap-3 items-start animate-pulse">
                    <Shield className="text-amber-600 shrink-0" size={20} />
                    <div>
                      <p className="text-sm font-bold text-amber-900">Tu contraseña es temporal</p>
                      <p className="text-xs text-amber-700">Debes cambiar tu contraseña por una definitiva.</p>
                    </div>
                  </div>
                )}
                <form onSubmit={handlePasswordUpdate} className="max-w-md space-y-4">
                  <div>
                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1 block">Nueva Contraseña</label>
                    <input required type="password" placeholder="Mínimo 6 caracteres" className="input" value={passForm.new} onChange={(e) => setPassForm(p => ({ ...p, new: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1 block">Confirmar Contraseña</label>
                    <input required type="password" placeholder="Repite la contraseña" className="input" value={passForm.confirm} onChange={(e) => setPassForm(p => ({ ...p, confirm: e.target.value }))} />
                  </div>
                  <button type="submit" disabled={passLoading} className="btn btn-primary w-full mt-4">{passLoading ? 'Actualizando...' : 'Actualizar Credenciales'}</button>
                </form>
              </ConfigCard>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <ConfigCard>
                <SectionHeader title="Zona de Peligro" description="Acciones irreversibles sobre el sistema." />
                <button className="btn bg-white border-danger text-danger hover:bg-danger hover:text-white transition-all font-bold">Reiniciar Base de Datos</button>
              </ConfigCard>
            </div>
          )}

          {activeTab === 'ars' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <ConfigCard>
                <SectionHeader title="Gestión de Aseguradoras (ARS)" description="Administra las compañías de seguros que aparecen en el formulario de cirugías." />
                
                <form onSubmit={handleAddArs} className="flex gap-2 mb-6">
                  <input 
                    type="text" 
                    placeholder="Nombre de la ARS (ej: ARS Humano)" 
                    className="input flex-1"
                    value={newArsName}
                    onChange={e => setNewArsName(e.target.value)}
                    required
                  />
                  <button type="submit" disabled={isArsLoading} className="btn btn-primary">
                    <Plus size={18} /> Agregar
                  </button>
                </form>

                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Aseguradora</th>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {arsList.map(ars => (
                        <tr key={ars.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-bold text-slate-700">
                            {editingArsId === ars.id ? (
                              <input 
                                className="input h-8 text-sm" 
                                value={editingArsName} 
                                onChange={e => setEditingArsName(e.target.value)}
                                autoFocus
                              />
                            ) : (
                              ars.name
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              {editingArsId === ars.id ? (
                                <>
                                  <button onClick={() => handleUpdateArs(ars.id)} className="text-green-600 hover:bg-green-50 p-1 rounded-md transition-all">
                                    <Check size={16} />
                                  </button>
                                  <button onClick={() => setEditingArsId(null)} className="text-slate-400 hover:bg-slate-100 p-1 rounded-md transition-all">
                                    <X size={16} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => { setEditingArsId(ars.id); setEditingArsName(ars.name); }} className="text-slate-300 hover:text-primary transition-all">
                                    <Edit2 size={16} />
                                  </button>
                                  <button onClick={() => handleDeleteArs(ars.id)} className="text-slate-300 hover:text-danger transition-all">
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {arsList.length === 0 && (
                        <tr>
                          <td colSpan="2" className="px-4 py-8 text-center text-slate-400 italic">No hay aseguradoras registradas.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </ConfigCard>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <ConfigCard className="p-0 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <SectionHeader 
                    title="Historial de Auditoría" 
                    description="Registro detallado de acciones críticas realizadas en la plataforma." 
                  />
                  <button onClick={fetchLogs} className="btn btn-secondary btn-sm flex items-center gap-2">
                    Actualizar
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha / Hora</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Usuario</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Acción</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Detalles</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {isLogsLoading ? (
                        <tr><td colSpan="4" className="px-6 py-12 text-center text-slate-400 italic">Cargando historial...</td></tr>
                      ) : logs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <p className="text-sm font-medium text-slate-900">
                              {new Date(log.created_at).toLocaleDateString('es-ES')}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {new Date(log.created_at).toLocaleTimeString('es-ES')}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-bold text-slate-700">{log.user_email}</p>
                            <p className="text-[10px] text-slate-400 font-mono uppercase">{log.entity_type}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "text-[10px] font-black px-2 py-1 rounded-md uppercase",
                              log.action.includes('CREATE') ? "bg-green-50 text-green-700" :
                              log.action.includes('UPDATE') ? "bg-blue-50 text-blue-700" :
                              log.action.includes('DELETE') ? "bg-red-50 text-red-700" :
                              "bg-slate-100 text-slate-600"
                            )}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                            <div className="max-w-[300px] truncate" title={JSON.stringify(log.details)}>
                              {JSON.stringify(log.details)}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!isLogsLoading && logs.length === 0 && (
                        <tr><td colSpan="4" className="px-6 py-12 text-center text-slate-400 italic">No hay registros de actividad aún.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </ConfigCard>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title="Nuevo Usuario">
        <UserForm onSave={handleCreateUser} onCancel={() => setIsUserModalOpen(false)} loading={isCreatingUser} />
      </Modal>

      <Modal isOpen={!!editingUser} onClose={() => setEditingUser(null)} title="Editar Usuario">
        <UserForm 
          initialData={editingUser}
          onSave={handleUpdateUser} 
          onCancel={() => setEditingUser(null)} 
          loading={isCreatingUser} 
        />
      </Modal>
    </div>
  );
};
