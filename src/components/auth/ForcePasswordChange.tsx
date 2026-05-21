import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Shield, Eye, EyeOff, Lock, CheckCircle2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { UserProfile } from '../../types/domain';

interface ForcePasswordChangeProps {
  user: UserProfile;
  onPasswordChanged: () => void;
}

const AlertCircle: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

// SECURITY F-07: strong password policy. The app handles sensitive
// medical data, so a 6-char minimum is insufficient.
const PASSWORD_MIN_LENGTH = 12;

interface PasswordChecks {
  length: boolean;
  upper: boolean;
  lower: boolean;
  digit: boolean;
  special: boolean;
}

function checkPassword(pwd: string): PasswordChecks {
  return {
    length: pwd.length >= PASSWORD_MIN_LENGTH,
    upper: /[A-Z]/.test(pwd),
    lower: /[a-z]/.test(pwd),
    digit: /\d/.test(pwd),
    special: /[^A-Za-z0-9]/.test(pwd),
  };
}

function isPasswordValid(checks: PasswordChecks): boolean {
  return checks.length && checks.upper && checks.lower && checks.digit && checks.special;
}

export const ForcePasswordChange: React.FC<ForcePasswordChangeProps> = ({ user, onPasswordChanged }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checks = checkPassword(password);
  const passwordValid = isPasswordValid(checks);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isPasswordValid(checkPassword(password))) {
      setError(`La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres e incluir mayúscula, minúscula, número y carácter especial.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) throw authError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('id', user.id);
      if (profileError) throw profileError;

      onPasswordChanged();
    } catch (err) {
      setError((err as Error).message || 'Error al actualizar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="bg-primary p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-md ring-1 ring-white/30">
              <Shield size={32} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold">Actualiza tu Seguridad</h2>
            <p className="text-blue-100 text-sm mt-2">Como medida de seguridad, debes cambiar tu contraseña temporal antes de continuar.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs font-medium flex items-center gap-2">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Nueva Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  required
                  type={showPass ? 'text' : 'password'}
                  className="w-full pl-10 pr-12 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none transition-all text-sm"
                  placeholder="Mín. 12 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Confirmar Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  required
                  type={showPass ? 'text' : 'password'}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none transition-all text-sm"
                  placeholder="Repite tu contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Requisitos</h4>
            {([
              [checks.length, `Mínimo ${PASSWORD_MIN_LENGTH} caracteres`],
              [checks.upper, 'Una letra mayúscula'],
              [checks.lower, 'Una letra minúscula'],
              [checks.digit, 'Un número'],
              [checks.special, 'Un carácter especial'],
              [!!password && password === confirmPassword, 'Las contraseñas coinciden'],
            ] as Array<[boolean, string]>).map(([ok, label]) => (
              <div key={label} className="flex items-center gap-2 text-xs font-medium">
                <CheckCircle2 size={14} className={ok ? 'text-green-500' : 'text-slate-300'} />
                <span className={ok ? 'text-slate-700' : 'text-slate-400'}>{label}</span>
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading || !passwordValid || password !== confirmPassword}
            className="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 hover:bg-blue-700 hover:shadow-primary/30 active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Actualizando...
              </div>
            ) : 'Establecer Contraseña Definitiva'}
          </button>
        </form>
      </div>
    </div>
  );
};
