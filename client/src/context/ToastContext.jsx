import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/ui/Icon.jsx';

const ToastContext = createContext(null);
const TONES = {
  success: ['bg-emerald-50 text-emerald-900 ring-emerald-200', 'check'],
  error: ['bg-red-50 text-red-900 ring-red-200', 'alert'],
  info: ['bg-navy-50 text-navy-900 ring-navy-200', 'info'],
};

/** useToast() -> { success(msg), error(msg), info(msg) }. Messages auto-dismiss and are announced to screen readers. */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);
  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((tone, message) => {
    seq.current += 1;
    const id = seq.current;
    setToasts((t) => [...t.slice(-3), { id, tone, message }]);
    setTimeout(() => dismiss(id), tone === 'error' ? 8000 : 5000);
  }, [dismiss]);
  const api = useMemo(() => ({ success: (m) => push('success', m), error: (m) => push('error', m), info: (m) => push('info', m) }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col items-center gap-2 p-4 sm:items-end" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => {
          const [cls, icon] = TONES[t.tone];
          return (
            <div key={t.id} role={t.tone === 'error' ? 'alert' : 'status'} className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl px-4 py-3 text-sm shadow-lift ring-1 ${cls} animate-fade-up`}>
              <Icon name={icon} className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="flex-1">{t.message}</p>
              <button type="button" onClick={() => dismiss(t.id)} className="-m-1 rounded p-1 opacity-70 hover:opacity-100" aria-label="Dismiss message"><Icon name="x" className="h-4 w-4" /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
