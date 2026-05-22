import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';

// HIPAA / datos médicos sensibles: 15 min inactividad estándar.
const INACTIVITY_MS  = 15 * 60 * 1000; // 15 minutos
const WARNING_MS     =  2 * 60 * 1000; // avisar 2 min antes (a los 13 min)

const ACTIVITY_EVENTS = [
  'mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click',
] as const;

interface UseSessionTimeoutOptions {
  /** Llamada cuando el usuario confirma "seguir conectado". */
  onExtend?: () => void;
  /** Llamada justo antes del logout automático. */
  onTimeout?: () => void;
}

export function useSessionTimeout(options: UseSessionTimeoutOptions = {}) {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(WARNING_MS / 1000);

  const warnTimerRef    = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const logoutTimerRef  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const countdownRef    = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const clearAllTimers = useCallback(() => {
    clearTimeout(warnTimerRef.current);
    clearTimeout(logoutTimerRef.current);
    clearInterval(countdownRef.current);
  }, []);

  const doLogout = useCallback(async () => {
    clearAllTimers();
    setShowWarning(false);
    options.onTimeout?.();
    await supabase.auth.signOut();
  }, [clearAllTimers, options]);

  const startWarningCountdown = useCallback(() => {
    setSecondsLeft(WARNING_MS / 1000);
    setShowWarning(true);

    countdownRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    logoutTimerRef.current = setTimeout(doLogout, WARNING_MS);
  }, [doLogout]);

  const resetTimers = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);
    warnTimerRef.current = setTimeout(startWarningCountdown, INACTIVITY_MS - WARNING_MS);
  }, [clearAllTimers, startWarningCountdown]);

  // Extender sesión manualmente (botón "Seguir conectado")
  const extendSession = useCallback(() => {
    resetTimers();
    options.onExtend?.();
  }, [resetTimers, options]);

  useEffect(() => {
    const handler = () => {
      // Solo resetear si el modal NO está visible — mientras el usuario
      // no ha respondido la advertencia, no contabilizar actividad.
      if (!showWarning) resetTimers();
    };

    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, handler, { passive: true }));
    resetTimers(); // arrancar al montar

    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, handler));
      clearAllTimers();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWarning]);

  return { showWarning, secondsLeft, extendSession, doLogout };
}
