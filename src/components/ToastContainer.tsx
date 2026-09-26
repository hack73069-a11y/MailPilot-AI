import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Info,
  AlertTriangle,
  X,
  RotateCcw,
} from 'lucide-react';
import { toast, ToastItem } from '../services/toast.js';

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return toast.subscribe((updated) => {
      setToasts(updated);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3 sm:px-0"
    >
      {toasts.map((t) => {
        const isSuccess = t.type === 'success';
        const isError = t.type === 'error';
        const isWarning = t.type === 'warning';
        const isInfo = t.type === 'info';

        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto relative overflow-hidden rounded-2xl border shadow-xl backdrop-blur-md p-3.5 transition-all duration-300 ease-out animate-toast-slide-in flex items-start gap-3 ${
              isSuccess
                ? 'bg-white/95 dark:bg-slate-900/95 border-emerald-500/30 dark:border-emerald-500/30 text-slate-800 dark:text-slate-100 shadow-emerald-500/10'
                : isError
                ? 'bg-white/95 dark:bg-slate-900/95 border-rose-500/30 dark:border-rose-500/30 text-slate-800 dark:text-slate-100 shadow-rose-500/10'
                : isWarning
                ? 'bg-white/95 dark:bg-slate-900/95 border-amber-500/30 dark:border-amber-500/30 text-slate-800 dark:text-slate-100 shadow-amber-500/10'
                : 'bg-white/95 dark:bg-slate-900/95 border-indigo-500/30 dark:border-indigo-500/30 text-slate-800 dark:text-slate-100 shadow-indigo-500/10'
            }`}
          >
            {/* Type Icon */}
            <div className="shrink-0 mt-0.5">
              {isSuccess && (
                <div className="w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
              {isError && (
                <div className="w-6 h-6 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4" />
                </div>
              )}
              {isWarning && (
                <div className="w-6 h-6 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              )}
              {isInfo && (
                <div className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Info className="w-4 h-4" />
                </div>
              )}
            </div>

            {/* Message Body */}
            <div className="flex-1 min-w-0 pr-1">
              {t.title && (
                <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-tight mb-0.5">
                  {t.title}
                </h4>
              )}
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug break-words">
                {t.message}
              </p>

              {/* Optional Action / Undo Button */}
              {t.action && (
                <button
                  onClick={() => {
                    t.action?.onClick();
                    toast.dismiss(t.id);
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/80 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-300 font-bold text-[11px] transition-all active:scale-95 cursor-pointer border border-indigo-200/60 dark:border-indigo-800/60"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{t.action.label}</span>
                </button>
              )}
            </div>

            {/* Close Button */}
            <button
              onClick={() => toast.dismiss(t.id)}
              className="shrink-0 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* Subtle Progress Bar */}
            {t.duration > 0 && (
              <div
                className={`absolute bottom-0 left-0 right-0 h-0.5 opacity-60 origin-left animate-toast-progress ${
                  isSuccess
                    ? 'bg-emerald-500'
                    : isError
                    ? 'bg-rose-500'
                    : isWarning
                    ? 'bg-amber-500'
                    : 'bg-indigo-500'
                }`}
                style={{ animationDuration: `${t.duration}ms` }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
