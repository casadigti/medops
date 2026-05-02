import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle2, Info, AlertTriangle, XCircle, Clock, Check } from 'lucide-react';
import { notificationService } from '../../services/notificationService';
import { cn } from '../../utils/cn';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export const NotificationPanel = ({ userId, isOpen, onClose }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!userId) return;

    const subscription = notificationService.subscribeToNotifications(userId, (newNotif) => {
      setNotifications(prev => [newNotif, ...prev]);
      // Play a subtle sound if desired
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);

  const loadNotifications = async () => {
    try {
      const data = await notificationService.getMyNotifications();
      setNotifications(data);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (error) {
      console.error('Error marking read:', error);
    }
  };

  const markAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Error marking all read:', error);
    }
  };

  const getTypeStyles = (type) => {
    switch (type) {
      case 'success': return { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50' };
      case 'warning': return { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50' };
      case 'error': return { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' };
      default: return { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50' };
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
      <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Bell className="text-primary" size={18} />
          <h3 className="font-bold text-slate-900 text-sm">Notificaciones</h3>
          {notifications.filter(n => !n.is_read).length > 0 && (
            <span className="px-2 py-0.5 bg-primary text-white text-[10px] font-black rounded-full animate-pulse">
              {notifications.filter(n => !n.is_read).length} NUEVAS
            </span>
          )}
        </div>
        <button 
          onClick={markAllRead}
          className="text-[10px] font-black text-primary hover:text-blue-700 uppercase tracking-widest"
        >
          Marcar todo como leído
        </button>
      </div>

      <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-400 font-medium">Buscando alertas...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Bell className="text-slate-200" size={32} />
            </div>
            <p className="text-sm font-bold text-slate-900">Todo al día</p>
            <p className="text-xs text-slate-400 mt-1">No tienes notificaciones pendientes.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {notifications.map((notif) => {
              const styles = getTypeStyles(notif.type);
              const Icon = styles.icon;
              
              return (
                <div 
                  key={notif.id}
                  onClick={() => markRead(notif.id)}
                  className={cn(
                    "p-4 flex gap-3 hover:bg-slate-50 transition-colors cursor-pointer relative",
                    !notif.is_read && "bg-blue-50/30"
                  )}
                >
                  {!notif.is_read && (
                    <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-full" />
                  )}
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", styles.bg)}>
                    <Icon className={styles.color} size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-0.5">
                      <h4 className={cn("text-sm truncate", notif.is_read ? "text-slate-600 font-medium" : "text-slate-900 font-bold")}>
                        {notif.title}
                      </h4>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 shrink-0 ml-2">
                        <Clock size={10} />
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: es })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                      {notif.message}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
        <button className="text-[11px] font-bold text-slate-500 hover:text-slate-900 transition-colors">
          Ver historial completo
        </button>
      </div>
    </div>
  );
};
