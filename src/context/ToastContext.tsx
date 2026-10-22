import React, { createContext, useCallback, useContext, useRef, useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastItem extends ToastInput {
  id: number;
}

interface ToastContextValue {
  notify: (toast: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toastStyles: Record<ToastVariant, { icon: React.ReactNode; accent: string }> = {
  success: {
    icon: <CheckCircle2 className="h-5 w-5" />,
    accent: 'border-emerald-400/30 text-emerald-300 bg-emerald-400/10',
  },
  error: {
    icon: <XCircle className="h-5 w-5" />,
    accent: 'border-rose-400/30 text-rose-300 bg-rose-400/10',
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5" />,
    accent: 'border-amber-400/30 text-amber-200 bg-amber-400/10',
  },
  info: {
    icon: <Info className="h-5 w-5" />,
    accent: 'border-sky-400/30 text-sky-200 bg-sky-400/10',
  },
};

const ToastCard: React.FC<{ toast: ToastItem; onDismiss: (id: number) => void }> = ({ toast, onDismiss }) => {
  const variant = toast.variant || 'info';

  useEffect(() => {
    const timeout = window.setTimeout(() => onDismiss(toast.id), toast.duration ?? 4200);
    return () => window.clearTimeout(timeout);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className="toast-enter pointer-events-auto flex w-full items-start gap-3 rounded-2xl border border-white/10 bg-[#151922]/95 p-4 text-white shadow-2xl shadow-black/30 backdrop-blur-xl"
    >
      <div className={`mt-0.5 shrink-0 rounded-xl border p-2 ${toastStyles[variant].accent}`}>
        {toastStyles[variant].icon}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-bold leading-5">{toast.title}</p>
        {toast.description && (
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 rounded-lg p-1 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts(current => current.filter(toast => toast.id !== id));
  }, []);

  const notify = useCallback((input: ToastInput) => {
    const id = nextId.current++;
    setToasts(current => [...current, { ...input, id }].slice(-3));
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div
        className="pointer-events-none fixed right-4 top-20 z-[100] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
        aria-live="polite"
        aria-relevant="additions removals"
      >
        {toasts.map(toast => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
