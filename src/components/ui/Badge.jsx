import React from 'react';
import { STATUS_COLORS } from '../../data/catalogo';
import { cn } from '../../utils/cn';

export const StatusBadge = ({ status }) => {
  const colors = STATUS_COLORS[status] || { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' };
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', colors.bg, colors.text)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', colors.dot)} />
      {status}
    </span>
  );
};

export const AlertBadge = ({ type }) => {
  const map = {
    critical: 'bg-red-500 text-white',
    urgent:   'bg-amber-500 text-white',
    info:     'bg-blue-500 text-white',
  };
  const labels = { critical: 'CRÍTICO', urgent: 'URGENTE', info: 'INFO' };
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider', map[type])}>
      {labels[type]}
    </span>
  );
};
