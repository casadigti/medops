import React from 'react';

export const Dashboard = () => {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Panel Principal</h1>
          <p className="text-slate-500 font-medium">Bienvenido de nuevo, Jose Luis.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn btn-secondary">Exportar Datos</button>
          <button className="btn btn-primary">+ Nueva Cirugía</button>
        </div>
      </div>

      {/* Métricas Superiores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Cirugías del Mes', value: '42', color: 'bg-primary' },
          { label: 'Esta Semana', value: '12', color: 'bg-accent' },
          { label: 'Pendientes Preparar', value: '8', color: 'bg-warning' },
          { label: 'Entregadas Hoy', value: '5', color: 'bg-success' }
        ].map((m, i) => (
          <div key={i} className="card group">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{m.label}</p>
            <div className="mt-2 flex items-end justify-between">
              <h3 className="text-3xl font-bold text-slate-900">{m.value}</h3>
              <div className={`w-2 h-8 rounded-full ${m.color} opacity-20 group-hover:opacity-100 transition-opacity`} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Alertas Críticas */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-xl font-bold text-slate-900">Alertas Críticas</h2>
          <div className="space-y-3">
            {[
              { patient: 'Juan Pérez', time: 'Mañana, 08:00 AM', status: 'critical', msg: 'Bandeja sin preparar' },
              { patient: 'Maria Garcia', time: 'Hoy, 02:30 PM', status: 'urgent', msg: 'En tránsito - Retraso' }
            ].map((a, i) => (
              <div key={i} className={cn(
                "p-4 rounded-2xl border flex flex-col gap-2",
                a.status === 'critical' ? "bg-red-50 border-red-100" : "bg-amber-50 border-amber-100"
              )}>
                <div className="flex justify-between items-start">
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    a.status === 'critical' ? "bg-red-500 text-white" : "bg-amber-500 text-white"
                  )}>
                    {a.status === 'critical' ? 'Crítico' : 'Urgente'}
                  </span>
                  <span className="text-xs font-medium text-slate-500">{a.time}</span>
                </div>
                <div>
                  <p className="font-bold text-slate-900">{a.patient}</p>
                  <p className="text-sm text-slate-600 font-medium">{a.msg}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Próximas Cirugías */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-bold text-slate-900">Próximas Cirugías</h2>
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Paciente</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Procedimiento</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[1, 2, 3].map(i => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900">Paciente {i}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">Artroplastia de Rodilla</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                        En preparación
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-500">08:00 AM</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// Simple CN helper inside for now or import it
import { cn } from '../utils/cn';
