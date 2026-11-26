import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);

let nextToastId = 0;
const alwaysToast = () => true;

const TOAST_ICONS = { success: '✓', error: '✕', warning: '!', info: 'i' };

/** Renders a stack of short-lived action toasts (spec §8: toast notifications for actions). */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((prev) => prev.filter((toast) => toast.id !== id)), []);

  const addToast = useCallback((message, type = 'success', duration = 4200) => {
    const id = ++nextToastId;
    setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
    setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-label="Action notifications">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
            <span className="toast-icon" aria-hidden="true">{TOAST_ICONS[toast.type] ?? TOAST_ICONS.info}</span>
            <span className="toast-msg">{toast.message}</span>
            <button type="button" className="toast-close" onClick={() => dismiss(toast.id)} aria-label="Dismiss notification">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

/**
 * Drop-in replacement for `useState('')` used for success notices.
 * Setting a non-empty message keeps the inline notice and also raises a toast.
 * `shouldToast` lets noisy messages (e.g. autosave) stay inline only.
 */
export function useNoticeState(shouldToast = alwaysToast) {
  const addToast = useToast();
  const [notice, setNoticeValue] = useState('');
  const setNotice = useCallback((message) => {
    setNoticeValue(message);
    if (message && shouldToast(message)) addToast(message, 'success');
  }, [addToast, shouldToast]);
  return [notice, setNotice];
}
