import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ClearConfirmModalProps {
  isOpen: boolean;
  pageNumber: number;
  strokeCount: number;
  onConfirm: () => void;
  onClose: () => void;
}

export const ClearConfirmModal: React.FC<ClearConfirmModalProps> = ({
  isOpen,
  pageNumber,
  strokeCount,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-[#0D1527] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 text-slate-100 flex flex-col gap-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clear-modal-title"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 id="clear-modal-title" className="text-base font-semibold text-white">
                Clear Page {pageNumber}?
              </h3>
              <p className="text-xs text-slate-400">This action will erase all drawings on this page.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 text-xs text-slate-300">
          <p>
            You are about to remove <span className="font-semibold text-white">{strokeCount}</span> object
            {strokeCount !== 1 ? 's' : ''} on Page {pageNumber}. You can still undo this immediately using{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[11px] text-cyan-300">
              Ctrl+Z
            </kbd>
            .
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-lg transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Page</span>
          </button>
        </div>
      </div>
    </div>
  );
};
