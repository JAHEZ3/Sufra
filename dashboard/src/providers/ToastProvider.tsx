"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import * as Toast from "@radix-ui/react-toast";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextValue {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

// Clean white toasts with a colored accent (dot + bottom bar) per type.
const TYPE_ACCENT: Record<ToastType, string> = {
  success: "bg-primary",
  error:   "bg-red-600",
  info:    "bg-[#2a6fdb]",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((type: ToastType, title: string, description?: string) => {
    setToasts((prev) => [...prev, { id: nextId++, type, title, description }]);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const ctx: ToastContextValue = {
    success: (t, d) => push("success", t, d),
    error:   (t, d) => push("error", t, d),
    info:    (t, d) => push("info", t, d),
  };

  return (
    <ToastContext.Provider value={ctx}>
      <Toast.Provider swipeDirection="right">
        {children}

        {toasts.map((t) => (
          <Toast.Root
            key={t.id}
            open
            dir="rtl"
            onOpenChange={(open) => { if (!open) remove(t.id); }}
            duration={4000}
            className="relative overflow-hidden rounded-xl border border-border bg-white shadow-xl p-4 pb-5 flex flex-col gap-1 data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-right-full data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]"
          >
            <div className="flex items-start gap-2 pl-5">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TYPE_ACCENT[t.type]}`} />
              <div className="min-w-0">
                <Toast.Title className="text-sm font-bold text-foreground">{t.title}</Toast.Title>
                {t.description && (
                  <Toast.Description className="text-xs text-muted-foreground mt-0.5">{t.description}</Toast.Description>
                )}
              </div>
            </div>
            <Toast.Close className="absolute top-2 left-2 text-muted-foreground hover:text-foreground text-xs">✕</Toast.Close>
            {/* Colored accent bar at the bottom */}
            <span className={`absolute bottom-0 inset-x-0 h-1 ${TYPE_ACCENT[t.type]}`} />
          </Toast.Root>
        ))}

        <Toast.Viewport className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 w-[360px] max-w-[calc(100vw-3rem)]" />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
