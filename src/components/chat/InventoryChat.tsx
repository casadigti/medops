import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Package, Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import { supabase } from '../../lib/supabase';
import type { UserProfile } from '../../types/domain';

interface Message {
  id: number;
  role: 'user' | 'bot';
  text: string;
}

const ALLOWED_ROLES = ['Superadmin', 'Administrador', 'Editor', 'Técnico', 'Lector'];

interface Props {
  userProfile: Partial<UserProfile> | null;
}

export const InventoryChat: React.FC<Props> = ({ userProfile }) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, role: 'bot', text: '¡Hola! Soy el asistente de inventario. Pregúntame dónde está un ítem, por ejemplo:\n\n• tornillo 4.5mm\n• set ortopédico\n• TOR-45' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);

  // Only render for roles that have inventory access
  if (!userProfile || !ALLOWED_ROLES.includes(userProfile.role as string)) return null;

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const addMessage = (role: 'user' | 'bot', text: string) => {
    setMessages(prev => [...prev, { id: nextId.current++, role, text }]);
  };

  const handleSend = async () => {
    const q = input.trim();
    if (!q || loading) return;

    setInput('');
    addMessage('user', q);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('inventory-search', {
        body: { query: q },
      });

      if (error) throw error;
      addMessage('bot', data?.text || 'No se pudo procesar la búsqueda.');
    } catch (err) {
      addMessage('bot', `Error: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200',
          open ? 'bg-slate-700 hover:bg-slate-800' : 'bg-primary hover:bg-primary/90'
        )}
        title="Asistente de Inventario"
      >
        {open ? <X size={22} className="text-white" /> : <Package size={22} className="text-white" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[340px] max-h-[500px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="bg-primary px-4 py-3 flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <MessageCircle size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Asistente de Inventario</p>
              <p className="text-[10px] text-white/70">Busca ítems por nombre, SKU o código</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0" style={{ maxHeight: '320px' }}>
            {messages.map(msg => (
              <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'bot' && (
                  <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center mr-2 shrink-0 mt-0.5">
                    <Package size={12} className="text-primary" />
                  </div>
                )}
                <div className={cn(
                  'max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-primary text-white rounded-tr-sm'
                    : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                )}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center mr-2 shrink-0">
                  <Package size={12} className="text-primary" />
                </div>
                <div className="bg-slate-100 px-3 py-2 rounded-2xl rounded-tl-sm">
                  <Loader2 size={16} className="text-slate-400 animate-spin" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-slate-100 flex gap-2">
            <input
              ref={inputRef}
              className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
              placeholder="Ej: tornillo 4.5mm..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="w-9 h-9 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
