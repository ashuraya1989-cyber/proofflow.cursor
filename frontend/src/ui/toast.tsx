import React, { createContext, useContext, useMemo, useState } from "react";

type Toast = { id: string; title: string; body?: string };

type ToastCtx = {
  push: (t: Omit<Toast, "id"> & { ttlMs?: number }) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const api = useMemo<ToastCtx>(
    () => ({
      push: ({ title, body, ttlMs = 3600 }) => {
        const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        setToasts((t) => [{ id, title, body }, ...t].slice(0, 5));
        window.setTimeout(() => {
          setToasts((t) => t.filter((x) => x.id !== id));
        }, ttlMs);
      }
    }),
    []
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pf-toast-stack" aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => (
          <div key={t.id} className="pf-toast">
            <div className="pf-toast__title">{t.title}</div>
            {t.body ? <div className="pf-toast__body">{t.body}</div> : null}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

