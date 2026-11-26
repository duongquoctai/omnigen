"use client";

import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { createContext, type ReactNode, useCallback, useContext, useState } from "react";

import { IconButton } from "@/shared/ui";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  readonly id: string;
  readonly type: ToastType;
  readonly message: string;
}

interface ToastContextValue {
  readonly toasts: ReadonlyArray<ToastItem>;
  readonly addToast: (type: ToastType, message: string) => void;
  readonly removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [toasts, setToasts] = useState<ReadonlyArray<ToastItem>>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = `toast_${String(Date.now())}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {toasts.length > 0 ? (
        <div
          aria-live="polite"
          className="pointer-events-none fixed right-4 bottom-4 z-50 flex max-w-sm flex-col gap-2"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs shadow-xl backdrop-blur-md ${
                toast.type === "error"
                  ? "border-rose-500/40 bg-rose-950/90 text-rose-100"
                  : toast.type === "success"
                    ? "border-emerald-500/40 bg-emerald-950/90 text-emerald-100"
                    : "border-white/15 bg-zinc-900/90 text-zinc-100"
              }`}
            >
              {toast.type === "error" ? (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              ) : toast.type === "success" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
              )}
              <span className="flex-1 leading-relaxed">{toast.message}</span>
              <IconButton
                size="sm"
                variant="ghost"
                aria-label="Đóng thông báo"
                onPress={() => {
                  removeToast(toast.id);
                }}
              >
                <X className="h-3.5 w-3.5" />
              </IconButton>
            </div>
          ))}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
