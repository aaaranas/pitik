"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Transient messages.
 *
 * Deliberately small: a camera app should almost never need to tell you
 * anything. Toasts here are for confirmations you'd otherwise doubt ("saved to
 * this roll") and for failures with a next step. Anything that needs a decision
 * gets a real dialog instead.
 */

export type ToastTone = "neutral" | "success" | "error";

interface Toast {
  id: number;
  message: string;
  detail?: string;
  tone: ToastTone;
}

interface ToastValue {
  toast: (message: string, options?: { detail?: string; tone?: ToastTone }) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

const TONE_STYLES: Record<ToastTone, string> = {
  neutral: "bg-cream-50 text-cocoa-900",
  success: "bg-mint-tint text-mint-deep",
  error: "bg-blush-tint text-blush-deep",
};

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback<ToastValue["toast"]>((message, options) => {
    const id = nextId++;
    setToasts((current) => [
      // Cap the stack: a burst of failures shouldn't bury the viewfinder.
      ...current.slice(-2),
      { id, message, detail: options?.detail, tone: options?.tone ?? "neutral" },
    ]);
    setTimeout(
      () => setToasts((current) => current.filter((item) => item.id !== id)),
      options?.tone === "error" ? 6000 : 3200,
    );
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 z-[90] flex flex-col items-center gap-2 px-4"
        style={{ bottom: "calc(var(--safe-bottom) + 5.5rem)" }}
        role="status"
        aria-live="polite"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            className={cn(
              "animate-rise slab pointer-events-auto w-full max-w-sm border-2 border-cocoa-900 px-4 py-3",
              TONE_STYLES[item.tone],
            )}
          >
            <p className="text-sm font-medium">{item.message}</p>
            {item.detail ? (
              <p className="mt-0.5 text-xs text-cocoa-600">{item.detail}</p>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside <ToastProvider>.");
  return value;
}
