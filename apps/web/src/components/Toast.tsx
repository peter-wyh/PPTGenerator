import { create } from 'zustand';
import { useEffect, type ReactNode } from 'react';

/* ── Types ── */
type ToastType = 'success' | 'error' | 'info' | 'warning';
interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

/* ── Store ── */
let nextId = 1;
interface ToastStore {
  toasts: Toast[];
  add: (type: ToastType, message: string) => void;
  remove: (id: number) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (type, message) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3500);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/* ── Convenience functions (usable outside React components) ── */
export const toast = {
  success: (msg: string) => useToastStore.getState().add('success', msg),
  error: (msg: string) => useToastStore.getState().add('error', msg),
  info: (msg: string) => useToastStore.getState().add('info', msg),
  warning: (msg: string) => useToastStore.getState().add('warning', msg),
};

/* ── Container component (mount once in App) ── */
const STYLES: Record<ToastType, { bg: string; icon: ReactNode }> = {
  success: { bg: 'bg-green-600', icon: '✓' },
  error: { bg: 'bg-red-600', icon: '✕' },
  info: { bg: 'bg-blue-600', icon: 'ℹ' },
  warning: { bg: 'bg-amber-500', icon: '⚠' },
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[9999] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm text-white shadow-lg ${STYLES[t.type].bg}`}
          role="alert"
          aria-live="assertive"
          onClick={() => remove(t.id)}
        >
          <span className="font-bold">{STYLES[t.type].icon}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

/* ── useEscapeToClose hook ── */
export function useEscapeToClose(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);
}
