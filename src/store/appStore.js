import { create } from 'zustand';

export const useAppStore = create((set) => ({
  surgeries: [],
  trays: [],
  alerts: [],
  isLoading: false,
  
  setSurgeries: (surgeries) => set({ surgeries }),
  setTrays: (trays) => set({ trays }),
  setAlerts: (alerts) => set({ alerts }),
  setLoading: (isLoading) => set({ isLoading }),
  
  // Logic for alert engine
  checkAlerts: (surgeries) => {
    const today = new Date();
    const activeAlerts = surgeries
      .filter(s => s.status === 'Pendiente')
      .map(s => {
        const surgeryDate = new Date(s.surgery_date);
        const diffDays = Math.ceil((surgeryDate - today) / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 1) return { ...s, alertType: 'critical', msg: 'Cirugía mañana - Sin preparar' };
        if (diffDays <= 2) return { ...s, alertType: 'urgent', msg: 'Preparar en 24h' };
        return null;
      })
      .filter(Boolean);
    
    set({ alerts: activeAlerts });
  }
}));
