"use client";

import * as Toast from "@radix-ui/react-toast";
import { createContext, useContext, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle, XCircle, AlertCircle, X } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (type: ToastType, title: string, description?: string) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((type: ToastType, title: string, description?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, title, description }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const value: ToastContextValue = {
    toast: addToast,
    success: (t, d) => addToast("success", t, d),
    error: (t, d) => addToast("error", t, d),
    warning: (t, d) => addToast("warning", t, d),
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-success" />,
    error:   <XCircle    className="w-5 h-5 text-error"   />,
    warning: <AlertCircle className="w-5 h-5 text-warning" />,
    info:    <AlertCircle className="w-5 h-5 text-info"    />,
  };

  const borders: Record<ToastType, string> = {
    success: "border-r-4 border-success",
    error:   "border-r-4 border-error",
    warning: "border-r-4 border-warning",
    info:    "border-r-4 border-info",
  };

  return (
    <ToastContext.Provider value={value}>
      <Toast.Provider swipeDirection="left">
        {children}
        {toasts.map((t) => (
          <Toast.Root
            key={t.id}
            open
            className={cn(
              "bg-white rounded-xl shadow-lg p-4 flex gap-3 items-start w-80 animate-slide-in",
              borders[t.type]
            )}
          >
            <span className="mt-0.5 shrink-0">{icons[t.type]}</span>
            <div className="flex-1 min-w-0">
              <Toast.Title className="font-semibold text-foreground text-sm">{t.title}</Toast.Title>
              {t.description && (
                <Toast.Description className="text-muted-foreground text-xs mt-0.5">
                  {t.description}
                </Toast.Description>
              )}
            </div>
            <Toast.Close asChild>
              <button className="text-muted-foreground hover:text-foreground shrink-0">
                <X className="w-4 h-4" />
              </button>
            </Toast.Close>
          </Toast.Root>
        ))}
        <Toast.Viewport className="fixed bottom-6 left-6 z-[100] flex flex-col gap-2" />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
