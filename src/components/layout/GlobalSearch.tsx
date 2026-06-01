import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Stethoscope, Package, Box, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { cn } from '../../utils/cn';

interface Result {
  id: string;
  label: string;
  sub: string;
  path: string;
  type: 'surgery' | 'implant' | 'tray';
}

const ICONS = { surgery: Stethoscope, implant: Package, tray: Box };
const LABELS = { surgery: 'Cirugías', implant: 'Implantes', tray: 'Bandejas' };

export const GlobalSearch: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const p = `%${q}%`;
      const [{ data: surgeries }, { data: implants }, { data: trays }] = await Promise.all([
        supabase.from('surgeries')
          .select('id, patient_name, status, surgery_date')
          .ilike('patient_name', p).limit(3),
        supabase.from('implants')
          .select('id, name, sku')
          .or(`name.ilike.${p},sku.ilike.${p}`).limit(3),
        supabase.from('trays')
          .select('id, name, code, status')
          .or(`name.ilike.${p},code.ilike.${p}`).limit(3),
      ]);
      const mapped: Result[] = [
        ...(surgeries ?? []).map(s => ({
          id: s.id, type: 'surgery' as const,
          label: s.patient_name,
          sub: `${s.status} · ${new Date(s.surgery_date).toLocaleDateString('es-ES')}`,
          path: '/cirugias',
        })),
        ...(implants ?? []).map(i => ({
          id: i.id, type: 'implant' as const,
          label: i.name, sub: i.sku, path: '/inventario',
        })),
        ...(trays ?? []).map(t => ({
          id: t.id, type: 'tray' as const,
          label: t.name, sub: `${t.code ?? ''} · ${t.status}`, path: '/bandejas',
        })),
      ];
      setResults(mapped);
      setOpen(mapped.length > 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(query), 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!dropRef.current?.contains(e.target as Node)) { setOpen(false); setFocused(-1); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const go = (r: Result) => { navigate(`${r.path}?q=${encodeURIComponent(r.label)}`); setQuery(''); setOpen(false); setFocused(-1); };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); setQuery(''); inputRef.current?.blur(); return; }
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)); }
    if (e.key === 'Enter' && focused >= 0) go(results[focused]);
  };

  const grouped = (['surgery', 'implant', 'tray'] as const)
    .map(type => ({ type, items: results.filter(r => r.type === type) }))
    .filter(g => g.items.length > 0);

  return (
    <div ref={dropRef} className="relative flex-1 max-w-md">
      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
        <input
          ref={inputRef}
          type="text"
          placeholder="Buscar paciente, implante, bandeja…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          onKeyDown={handleKey}
          className="w-full pl-10 pr-8 py-2 bg-slate-100 border-transparent rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all"
        />
        {query && (
          <button onClick={() => { setQuery(''); setOpen(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        )}
      </div>

      {open && (
        <div data-testid="global-search-dropdown" className="absolute top-full mt-2 left-0 right-0 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 max-h-96 overflow-y-auto">
          {loading && <div className="px-4 py-3 text-sm text-slate-400">Buscando…</div>}
          {!loading && grouped.map(({ type, items }) => {
            const Icon = ICONS[type];
            return (
              <div key={type}>
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                  <Icon size={12} className="text-slate-400" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{LABELS[type]}</span>
                </div>
                {items.map(r => (
                  <button key={r.id} onClick={() => go(r)}
                    className={cn(
                      'w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0',
                      focused === results.indexOf(r) && 'bg-primary/5'
                    )}>
                    <p className="text-sm font-semibold text-slate-800">{r.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{r.sub}</p>
                  </button>
                ))}
              </div>
            );
          })}
          {!loading && results.length === 0 && query.length >= 2 && (
            <div className="px-4 py-6 text-center text-slate-400 text-sm">Sin resultados para "{query}"</div>
          )}
        </div>
      )}
    </div>
  );
};
