"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Promise-based confirmation dialog. Replaces window.confirm().
 *  Usage: `if (!(await confirm({ title: "Delete?", danger: true }))) return;` */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within <ConfirmProvider>");
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    setOpts(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpts(null);
  }, []);

  useEffect(() => {
    if (!opts) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
      else if (e.key === "Enter") close(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [opts, close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <div
          className="dialog-backdrop fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
          onClick={() => close(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="dialog-in w-full max-w-sm card shadow-pop p-6"
          >
            <p className="text-base font-semibold text-ink">{opts.title}</p>
            {opts.message && <p className="mt-2 text-sm text-muted leading-snug">{opts.message}</p>}
            <div className="mt-6 flex gap-3 justify-end">
              <button onClick={() => close(false)} className="btn-secondary">
                {opts.cancelText ?? "Cancel"}
              </button>
              <button
                autoFocus
                onClick={() => close(true)}
                className={opts.danger ? "btn-danger" : "btn-primary"}
              >
                {opts.confirmText ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
