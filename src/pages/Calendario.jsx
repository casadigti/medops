import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { surgeryService } from '../services/surgeryService';
import { surgeonService } from '../services/surgeonService';
import { Calendar, Stethoscope, AlertCircle, Loader2, Filter, User } from 'lucide-react';
import { cn } from '../utils/cn';
import { useToast } from '../components/ui/Toast';

export const Calendario = ({ userProfile }) => {
  const toast = useToast();
  const [surgeries, setSurgeries] = useState([]);
  const [surgeons, setSurgeons] = useState([]);
  const [selectedSurgeonId, setSelectedSurgeonId] = useState('all');
  const [loading, setLoading] = useState(true);

  const isSurgeon = userProfile?.role === 'Cirujano';
  const mySurgeonId = userProfile?.surgeon_id;

  useEffect(() => {
    if (userProfile) {
      fetchSurgeries();
      fetchSurgeons();
    }
  }, [userProfile]);

  const fetchSurgeons = async () => {
    try {
      const data = await surgeonService.getAll();
      setSurgeons(data || []);
    } catch (error) {
      console.error('Error fetching surgeons:', error);
    }
  };

  const fetchSurgeries = async () => {
    try {
      setLoading(true);
      // If surgeon, filter data fetching at service level
      const data = await surgeryService.getAll(isSurgeon ? mySurgeonId : null);
      setSurgeries(data);
    } catch (error) {
      console.error('Error fetching surgeries:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completada': return '#10b981'; // green-500
      case 'En preparación': return '#3b82f6'; // blue-500
      case 'Pendiente': return '#f59e0b'; // amber-500
      default: return '#64748b'; // slate-500
    }
  };

  const handleEventDrop = async (info) => {
    // Cuando sueltas el evento en una nueva fecha/hora
    const surgeryId = info.event.id;
    
    // Obtener la nueva fecha calculada por el calendario
    // FullCalendar entrega una fecha en base a la zona horaria local.
    // La pasamos a formato ISO para guardarla en la DB.
    const newDateStr = info.event.start.toISOString();

    if (!confirm(`¿Estás seguro de mover la cirugía de ${info.event.title} al ${info.event.start.toLocaleDateString()}?`)) {
      info.revert();
      return;
    }

    try {
      await surgeryService.updateDate(surgeryId, newDateStr);
      fetchSurgeries();
    } catch (error) {
      console.error('Error actualizando fecha:', error);
      toast.error('Error al mover la cirugía. Verifique su conexión.');
      info.revert();
    }
  };

  const events = surgeries
    .filter(s => selectedSurgeonId === 'all' || s.surgeon_id === selectedSurgeonId)
    .map(s => {
      const color = getStatusColor(s.status);
      const isHighlighted = selectedSurgeonId !== 'all' && s.surgeon_id === selectedSurgeonId;
      
      return {
        id: s.id,
        title: `${s.patient_name} - ${s.surgeon?.full_name || 'Sin Asignar'}`,
        start: s.surgery_date,
        display: 'block',
        textColor: '#ffffff',
        backgroundColor: color,
        borderColor: isHighlighted ? '#ffffff' : color,
        classNames: isHighlighted ? ['ring-2 ring-primary ring-offset-1 z-10'] : [],
        extendedProps: {
          status: s.status,
          procedure: s.procedure_type,
          hospital: s.hospital?.name
        }
      };
    });

  const renderEventContent = (eventInfo) => {
    return (
      <div className="p-0.5 overflow-hidden text-xs leading-tight">
        <div className="font-bold truncate">{eventInfo.event.title}</div>
        <div className="opacity-80 truncate text-[10px]">{eventInfo.event.extendedProps.procedure}</div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Calendar className="text-primary" size={32} />
            Calendario Interactivo
          </h1>
          <p className="text-slate-500">Visualiza, organiza y reprograma cirugías con Drag & Drop</p>
        </div>

        {!isSurgeon && (
          <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
            <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
              <User size={18} />
            </div>
            <select 
              value={selectedSurgeonId}
              onChange={(e) => setSelectedSurgeonId(e.target.value)}
              className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0 outline-none pr-8 cursor-pointer"
            >
              <option value="all">Todos los Cirujanos</option>
              {surgeons.map(s => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-2 sm:p-6">
        {loading ? (
          <div className="h-[600px] flex items-center justify-center">
            <Loader2 className="animate-spin text-primary" size={48} />
          </div>
        ) : (
          <div className="h-[700px] calendar-wrapper">
            <FullCalendar
              plugins={[ dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin ]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
              }}
              locale="es"
              buttonText={{
                today: 'Hoy',
                month: 'Mes',
                week: 'Semana',
                day: 'Día',
                list: 'Agenda'
              }}
              events={events}
              editable={!isSurgeon} // Habilita Drag & Drop solo para admins
              droppable={!isSurgeon}
              eventDrop={handleEventDrop}
              eventContent={renderEventContent}
              height="100%"
              dayMaxEvents={true} // Si hay muchos en un día, muestra un "más"
            />
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 items-center px-4 py-3 bg-white rounded-xl shadow-sm border border-slate-200">
        <span className="text-sm font-bold text-slate-700">Estado:</span>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500"></div><span className="text-xs text-slate-600">Pendiente</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500"></div><span className="text-xs text-slate-600">En preparación</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500"></div><span className="text-xs text-slate-600">Completada</span></div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .calendar-wrapper .fc-theme-standard td, .calendar-wrapper .fc-theme-standard th {
          border-color: #e2e8f0;
        }
        .calendar-wrapper .fc-col-header-cell {
          background-color: #f8fafc;
          padding: 8px 0;
        }
        .calendar-wrapper .fc-col-header-cell-cushion {
          color: #475569;
          font-weight: 700;
          text-transform: capitalize;
        }
        .calendar-wrapper .fc-daygrid-day-number {
          color: #1e293b;
          font-weight: 600;
          padding: 8px;
        }
        .calendar-wrapper .fc-button-primary {
          background-color: #1e40af;
          border-color: #1e40af;
          border-radius: 8px;
          text-transform: capitalize;
          font-weight: 600;
        }
        .calendar-wrapper .fc-button-primary:hover {
          background-color: #1e3a8a;
          border-color: #1e3a8a;
        }
        .calendar-wrapper .fc-button-active {
          background-color: #172554 !important;
          border-color: #172554 !important;
        }
        .calendar-wrapper .fc-event {
          border-radius: 4px;
          border: none;
          padding: 1px 2px;
          transition: transform 0.1s;
        }
        .calendar-wrapper .fc-event:hover {
          transform: scale(1.02);
          cursor: grab;
        }
        .calendar-wrapper .fc-event-dragging {
          cursor: grabbing !important;
          opacity: 0.8;
          box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
        }
      `}} />
    </div>
  );
};
