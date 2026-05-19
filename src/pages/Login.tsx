import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, Lock, Mail, ChevronRight, ShieldAlert } from 'lucide-react';
import { cn } from '../utils/cn';
import { supabase } from '../lib/supabase';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate('/');
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      setErrorMsg('Credenciales inválidas. Por favor, verifica tu correo y contraseña.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-[10%] -right-[5%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-[60%] -left-[10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="w-20 h-20 bg-primary text-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-primary/30 rotate-3 hover:rotate-0 transition-transform">
            <Stethoscope size={40} />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">MedOps</h1>
          <p className="text-slate-500 font-medium">Sistema Integral de Gestión Quirúrgica</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 animate-in zoom-in-95 duration-500 delay-150 fill-mode-both">
          <form onSubmit={handleLogin} className="space-y-5">
            {errorMsg && (
              <div className="p-3 bg-red-50 text-red-600 text-sm font-semibold rounded-xl border border-red-100 flex items-center gap-2 animate-in fade-in zoom-in-95">
                <ShieldAlert size={16} />
                {errorMsg}
              </div>
            )}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Correo Electrónico</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-primary/20 focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:text-slate-400"
                  placeholder="usuario@hospital.com"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contraseña</label>
                <a href="#" className="text-[10px] font-bold text-primary hover:text-primary-600 transition-colors">¿Olvidaste tu contraseña?</a>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-primary/20 focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:text-slate-400"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isLoading}
                className={cn(
                  'w-full bg-primary text-white py-3.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-primary/20 transition-all',
                  isLoading ? 'opacity-70 cursor-wait' : 'hover:-translate-y-1 hover:shadow-primary/40 active:translate-y-0'
                )}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Iniciar Sesión <ChevronRight size={18} /></>
                )}
              </button>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <div className="flex items-center justify-center gap-2 text-slate-400 text-xs font-medium">
              <ShieldAlert size={14} />
              <span>Acceso restringido para personal autorizado</span>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-8 font-medium">
          &copy; {new Date().getFullYear()} Casadig TI. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
};
