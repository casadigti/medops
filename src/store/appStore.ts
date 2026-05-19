import { create } from 'zustand';
import type { Surgery, Tray } from '../types/domain';

interface SurgeryAlert extends Surgery {
  alertType: 'critical' | 'urgent';
  msg: string;
}

interface AppState {
  surgeries: Surgery[];
  trays: Tray[];
  alerts: SurgeryAlert[];
  isLoading: boolean;
  setSurgeries: (surgeries: Surgery[]) => void;
  setTrays: (trays: Tray[]) => void;
  setAlerts: (alerts: SurgeryAlert[]) => void;
  setLoading: (isLoading: boolean) => void;
  checkAlerts: (surgeries: Surgery[]) => void;
}

export const useAppStore = create<AppState>((set) => ({
  surgeries: [],
  trays: [],
  alerts: [],
  isLoading: false,

  setSurgeries: (surgeries) => set({ surgeries }),
  setTrays: (trays) => set({ trays }),
  setAlerts: (alerts) => set({ alerts }),
  setLoading: (isLoading) => set({ isLoading }),

  checkAlerts: (surgeries) => {
    const today = new Date();
    const activeAlerts = surgeries
      .filter(s => s.status === 'Programada')
      .map(s => {
        const surgeryDate = new Date(s.surgery_date);
        const diffDays = Math.ceil((surgeryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 1) return { ...s, alertType: 'critical' as const, msg: 'Cirugía mañana - Sin preparar' };
        if (diffDays <= 2) return { ...s, alertType: 'urgent' as const, msg: 'Preparar en 24h' };
        return null;
      })
      .filter((x): x is SurgeryAlert => x !== null);

    set({ alerts: activeAlerts });
  },
}));
