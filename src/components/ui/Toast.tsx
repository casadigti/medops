import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, Component } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '../../utils/cn';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
  type?: ToastType;
  message: string;
  duration?: number;
}

interface ToastFn {
  (opts: ToastOptions): string;
  success: (msg: string, opts?: Partial<ToastOptions>) => string;
  error:   (msg: string, opts?: Partial<ToastOptions>) => string;
  warning: (msg: string, opts?: Partial<ToastOptions>) => string;
  info:    (msg: string, opts?: Partial<ToastOptions>) => string;
}

const ToastContext = createContext<ToastFn | null>(null);

export const useToast = (): ToastFn => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
};

const ICONS = {
  success: { icon: CheckCircle2, color: 'text-emerald-500', bar: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-100' },
  error:   { icon: XCircle,      color: 'text-red-500',     bar: 'bg-red-500',     bg: 'bg-red-50 border-red-100' },
  warning: { icon: AlertTriangle, color: 'text-amber-500',  bar: 'bg-amber-500',   bg: 'bg-amber-50 border-amber-100' },
  info:    { icon: Info,          color: 'text-blue-500',   bar: 'bg-blue-500',    bg: 'bg-blue-50 border-blue-100' },
};

interface ToastItemProps {
  id: string;
  type?: ToastType;
  message: string;
  duration?: number;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ id, type = 'info', message, onDismiss, duration = 4000 }) => {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const cfg = ICONS[type] || ICONS.info;
  const Icon = cfg.icon;

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const step = 50;
    const decrement = (step / duration) * 100;
    const interval = setInterval(() => {
      setProgress(p => {
        if (p <= 0) { clearInterval(interval); return 0; }
        return p - decrement;
      });
    }, step);
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(id), 300);
    }, duration);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, []);

  return (
    <div
      className={cn(
        'relative flex items-start gap-3 w-full max-w-sm px-4 py-3 rounded-2xl border shadow-xl',
        'transition-all duration-300 ease-out overflow-hidden',
        cfg.bg,
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
      )}
    >
      <Icon size={20} className={cn('shrink-0 mt-0.5', cfg.color)} />
      <p className="text-sm font-semibold text-slate-800 flex-1 leading-snug">{message}</p>
      <button
        onClick={() => { setVisible(false); setTimeout(() => onDismiss(id), 300); }}
        className="text-slate-400 hover:text-slate-700 transition-colors shrink-0"
      >
        <X size={15} />
      </button>
      <div
        className={cn('absolute bottom-0 left-0 h-0.5 transition-all ease-linear', cfg.bar)}
        style={{ width: `${progress}%`, transitionDuration: '50ms' }}
      />
    </div>
  );
};

interface ToastEntry extends ToastOptions {
  id: string;
}

class ToastErrorBoundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(t => t.filter(toast => toast.id !== id));
  }, []);

  const toast = useMemo<ToastFn>(() => {
    const add = ({ type = 'info', message, duration }: ToastOptions): string => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts(t => [...t, { id, type, message, duration }]);
      return id;
    };
    const fn = add as ToastFn;
    fn.success = (msg, opts) => add({ type: 'success', message: msg, ...opts });
    fn.error   = (msg, opts) => add({ type: 'error',   message: msg, ...opts });
    fn.warning = (msg, opts) => add({ type: 'warning', message: msg, ...opts });
    fn.info    = (msg, opts) => add({ type: 'info',    message: msg, ...opts });
    return fn;
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastErrorBoundary>
        <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 items-end pointer-events-none">
          {toasts.map(t => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItem {...t} onDismiss={dismiss} />
            </div>
          ))}
        </div>
      </ToastErrorBoundary>
    </ToastContext.Provider>
  );
};
