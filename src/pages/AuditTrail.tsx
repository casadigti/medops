import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Download, RefreshCw } from 'lucide-react';
import { auditService } from '../services/auditService';
import type { AuditLog } from '../types/domain';
import { useToast } from '../components/ui/Toast';
import { Spinner } from '../components/ui/Spinner';
import { cn } from '../utils/cn';

const PAGE_SIZE = 50;

const ENTITY_TYPES = [
  'surgery', 'implant', 'implant_lot', 'tray', 'user', 'organization',
  'hospital', 'surgeon', 'configuration', 'storage',
];

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('es-DO', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

function actionBadgeColor(action: string): string {
  const a = action.toLowerCase();
  if (a.includes('delete') || a.includes('eliminar')) return 'bg-red-100 text-red-700';
  if (a.includes('create') || a.includes('crear') || a.includes('insert')) return 'bg-green-100 text-green-700';
  if (a.includes('update') || a.includes('actualizar') || a.includes('edit')) return 'bg-blue-100 text-blue-700';
  if (a.includes('login') || a.includes('logout') || a.includes('auth')) return 'bg-purple-100 text-purple-700';
  return 'bg-slate-100 text-slate-700';
}

interface DetailsRowProps {
  details: Record<string, unknown>;
}

const DetailsRow: React.FC<DetailsRowProps> = ({ details }) => {
  const [open, setOpen] = useState(false);
  const keys = Object.keys(details);
  if (keys.length === 0) return <span className="text-slate-400 text-xs">—</span>;

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
      >
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {keys.length} campo{keys.length !== 1 ? 's' : ''}
      </button>
      {open && (
        <pre className="mt-2 text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-2 overflow-x-auto text-slate-700 max-w-xs">
          {JSON.stringify(details, null, 2)}
        </pre>
      )}
    </div>
  );
};

export const AuditTrail: React.FC = () => {
  const toast = useToast();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');

  // Applied filters (only update on search click or Enter)
  const [appliedFilters, setAppliedFilters] = useState({
    dateFrom: '', dateTo: '', action: '', entityType: '',
  });

  const load = useCallback(async (filters: typeof appliedFilters, p: number) => {
    setLoading(true);
    try {
      let query = supabaseQuery(filters, p);
      const { data, count } = await query;
      setLogs(data);
      setTotal(count);
    } catch (err) {
      toast.error('Error cargando historial de auditoría');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load(appliedFilters, page);
  }, [appliedFilters, page, load]);

  function applyFilters() {
    const next = { dateFrom, dateTo, action: actionFilter, entityType: entityTypeFilter };
    setPage(0);
    setAppliedFilters(next);
  }

  function clearFilters() {
    setDateFrom(''); setDateTo(''); setActionFilter(''); setEntityTypeFilter('');
    setPage(0);
    setAppliedFilters({ dateFrom: '', dateTo: '', action: '', entityType: '' });
  }

  function exportCSV() {
    if (logs.length === 0) return;
    const header = ['Fecha', 'Usuario', 'Acción', 'Entidad', 'ID Entidad', 'Detalles'];
    const rows = logs.map(l => [
      formatDate(l.created_at),
      l.user_email,
      l.action,
      l.entity_type,
      l.entity_id ?? '',
      JSON.stringify(l.details),
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_trail_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters = appliedFilters.dateFrom || appliedFilters.dateTo || appliedFilters.action || appliedFilters.entityType;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Shield size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Historial de Auditoría</h1>
            <p className="text-sm text-slate-500">
              {total > 0 ? `${total.toLocaleString('es-DO')} registros encontrados` : 'Cargando...'}
            </p>
          </div>
        </div>
        <button
          onClick={exportCSV}
          disabled={logs.length === 0}
          className="btn btn-secondary flex items-center gap-2 text-sm"
        >
          <Download size={16} />
          Exportar CSV
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Desde</label>
            <input
              type="date"
              className="input text-sm w-full"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyFilters()}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Hasta</label>
            <input
              type="date"
              className="input text-sm w-full"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyFilters()}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Acción</label>
            <input
              type="text"
              className="input text-sm w-full"
              placeholder="ej. create, delete, update..."
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyFilters()}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Tipo de entidad</label>
            <select
              className="input text-sm w-full"
              value={entityTypeFilter}
              onChange={e => setEntityTypeFilter(e.target.value)}
            >
              <option value="">Todos</option>
              {ENTITY_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={applyFilters} className="btn btn-primary flex items-center gap-2 text-sm">
            <Search size={15} />
            Buscar
          </button>
          {hasFilters && (
            <button onClick={clearFilters} className="btn btn-secondary text-sm flex items-center gap-2">
              <RefreshCw size={14} />
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Shield size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Sin registros</p>
            <p className="text-sm mt-1">{hasFilters ? 'Ningún evento coincide con los filtros.' : 'No hay eventos de auditoría aún.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Usuario</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Acción</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Entidad</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Detalles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 max-w-[180px] truncate" title={log.user_email}>
                      {log.user_email}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-semibold px-2 py-1 rounded-full', actionBadgeColor(log.action))}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-mono">
                        {log.entity_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs font-mono max-w-[120px] truncate" title={log.entity_id}>
                      {log.entity_id ? log.entity_id.slice(0, 8) + (log.entity_id.length > 8 ? '…' : '') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <DetailsRow details={log.details} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              Página {page + 1} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="btn btn-secondary text-sm flex items-center gap-1 disabled:opacity-40"
              >
                <ChevronLeft size={15} /> Anterior
              </button>
              <button
                disabled={page + 1 >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="btn btn-secondary text-sm flex items-center gap-1 disabled:opacity-40"
              >
                Siguiente <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Internal helper — wraps auditService + entity_type filter ────────────────

async function supabaseQuery(
  filters: { dateFrom: string; dateTo: string; action: string; entityType: string },
  page: number
): Promise<{ data: AuditLog[]; count: number }> {
  const result = await auditService.getFiltered({
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    action: filters.action || undefined,
    entityType: filters.entityType || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });
  return result;
}
