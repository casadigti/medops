import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getImpersonatedOrgId } from '../utils/impersonation';
import type { Surgery } from '../types/domain';

type SetSurgeries = React.Dispatch<React.SetStateAction<Surgery[]>>;
type ToastFn = { success: (msg: string) => void; info: (msg: string) => void };

/**
 * Subscribe to real-time changes on the surgeries table.
 * Handles INSERT / UPDATE / DELETE and patches local state in-place.
 * Unsubscribes automatically on unmount.
 */
export function useRealtimeSurgeries(
  setSurgeries: SetSurgeries,
  toast?: ToastFn,
) {
  // Keep a stable ref so the effect closure always sees current setter
  const setRef = useRef(setSurgeries);
  setRef.current = setSurgeries;

  useEffect(() => {
    const orgId = getImpersonatedOrgId();
    const filter = orgId ? `org_id=eq.${orgId}` : undefined;

    const channel = supabase
      .channel('realtime:surgeries')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'surgeries', filter },
        (payload) => {
          const { eventType, new: next, old } = payload;

          if (eventType === 'INSERT') {
            setRef.current(prev => [next as Surgery, ...prev]);
            toast?.info(`Nueva cirugía: ${(next as Surgery).patient_name}`);
          }

          if (eventType === 'UPDATE') {
            setRef.current(prev =>
              prev.map(s => (s.id === (next as Surgery).id ? { ...s, ...next as Surgery } : s)),
            );
            const prevSurgery = (old as Partial<Surgery>);
            const nextSurgery = (next as Surgery);
            if (prevSurgery.status && prevSurgery.status !== nextSurgery.status) {
              toast?.info(`${nextSurgery.patient_name}: ${prevSurgery.status} → ${nextSurgery.status}`);
            }
          }

          if (eventType === 'DELETE') {
            setRef.current(prev => prev.filter(s => s.id !== (old as Surgery).id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // intentional: subscribe once per mount
}
