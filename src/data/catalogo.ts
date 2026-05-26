export const PROCEDURE_TYPES: string[] = [
  'Artroplastia total de rodilla',
  'Artroplastia total de cadera',
  'Artroplastia de hombro',
  'Artroscopia de rodilla',
  'Artroscopia de hombro',
  'Fijación de fractura de fémur (clavo endomedular)',
  'Fijación de fractura de tibia (clavo endomedular)',
  'Fijación de fractura de húmero (placa)',
  'Fijación de fractura de radio / cúbito',
  'Fijación de fractura de tobillo',
  'Cirugía de columna (fusión / laminectomía)',
  'Fijación de fractura de cadera (DHS / clavo)',
  'Osteotomía correctiva',
];

export const SURGERY_STATUSES: string[] = [
  'Pendiente',
  'En preparación',
  'Lista',
  'En tránsito',
  'Entregada',
  'Completada',
  'Suspendida',
  'Cancelada',
  'Facturada',
];

export const TRAY_STATUSES: string[] = [
  'Disponible',
  'En preparación',
  'En uso',
  'En limpieza',
  'En reparación',
];

export const SPECIALTIES: string[] = [
  'Ortopedia General',
  'Cirugía de Rodilla',
  'Cirugía de Cadera',
  'Cirugía de Hombro',
  'Cirugía de Columna',
  'Trauma y Ortopedia',
];

interface StatusStyle {
  bg: string;
  text: string;
  dot: string;
}

export const STATUS_COLORS: Record<string, StatusStyle> = {
  'Pendiente':      { bg: 'bg-slate-100',  text: 'text-slate-700',  dot: 'bg-slate-400'  },
  'En preparación': { bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500'   },
  'Lista':          { bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500'  },
  'En tránsito':    { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  'Entregada':      { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
  'Completada':     { bg: 'bg-teal-100',   text: 'text-teal-700',   dot: 'bg-teal-500'   },
  'Suspendida':     { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
  'Cancelada':      { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500'    },
  'Facturada':      { bg: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-500' },
  'Disponible':     { bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500'  },
  'En uso':         { bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500'   },
  'En limpieza':    { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  'En reparación':  { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500'    },
};

export const MAX_STERILIZATIONS = 200;
