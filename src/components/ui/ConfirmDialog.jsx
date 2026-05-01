import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

export const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Eliminar', danger = true }) => (
  <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
    <div className="flex flex-col items-center text-center gap-4">
      <div className={`w-14 h-14 rounded-full flex items-center justify-center ${danger ? 'bg-red-100' : 'bg-amber-100'}`}>
        <AlertTriangle size={28} className={danger ? 'text-red-500' : 'text-amber-500'} />
      </div>
      <p className="text-slate-600">{message}</p>
      <div className="flex gap-3 w-full pt-2">
        <button onClick={onClose} className="btn btn-secondary flex-1">Cancelar</button>
        <button onClick={onConfirm} className={`btn flex-1 text-white ${danger ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'}`}>
          {confirmLabel}
        </button>
      </div>
    </div>
  </Modal>
);
