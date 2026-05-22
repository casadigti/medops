import React from 'react';
import { Clock, LogOut, RefreshCw } from 'lucide-react';

interface SessionTimeoutModalProps {
  secondsLeft: number;
  onExtend: () => void;
  onLogout: () => void;
}

export const SessionTimeoutModal: React.FC<SessionTimeoutModalProps> = ({
  secondsLeft,
  onExtend,
  onLogout,
}) => {
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = mins > 0
    ? `${mins}:${String(secs).padStart(2, '0')} min`
    : `${secs} seg`;

  // Porcentaje para el anillo circular (120 seg total)
  const pct = Math.min(secondsLeft / 120, 1);
  const circumference = 2 * Math.PI * 28;
  const dash = pct * circumference;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-amber-500 p-6 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-xl" />
          <div className="relative z-10">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 backdrop-blur-md ring-1 ring-white/30">
              <Clock size={28} className="text-white" />
            </div>
            <h2 className="text-xl font-bold">Sesión por expirar</h2>
            <p className="text-amber-100 text-xs mt-1">
              Por inactividad, serás desconectado automáticamente.
            </p>
          </div>
        </div>

        {/* Countdown */}
        <div className="p-6 flex flex-col items-center gap-5">
          <div className="relative w-20 h-20">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="#f1f5f9" strokeWidth="6" />
              <circle
                cx="32" cy="32" r="28"
                fill="none"
                stroke={secondsLeft <= 30 ? '#ef4444' : '#f59e0b'}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference}`}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-sm font-black ${secondsLeft <= 30 ? 'text-red-500' : 'text-amber-500'}`}>
                {timeStr}
              </span>
            </div>
          </div>

          <p className="text-sm text-slate-600 text-center">
            ¿Deseas continuar con tu sesión?
          </p>

          <div className="flex gap-3 w-full">
            <button
              onClick={onLogout}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
            >
              <LogOut size={15} /> Cerrar sesión
            </button>
            <button
              onClick={onExtend}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:bg-blue-700 transition-colors"
            >
              <RefreshCw size={15} /> Continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
