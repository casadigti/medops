import React from 'react';
import { Sidebar } from './Sidebar';
import { Bell, Search, User } from 'lucide-react';

export const Layout = ({ children }) => {
  const [time, setTime] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen flex flex-col">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-40">
          <div className="flex-1 max-w-md">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Buscar cirugías, bandejas o médicos..." 
                className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-colors">
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-4 h-4 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                3
              </span>
            </button>
            <div className="h-8 w-px bg-slate-200 mx-2" />
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs text-slate-500 font-medium capitalize">
                  {time.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <p className="text-sm font-bold text-slate-900 uppercase">
                  {time.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-8 flex-1 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {children}
        </div>
      </main>
    </div>
  );
};
