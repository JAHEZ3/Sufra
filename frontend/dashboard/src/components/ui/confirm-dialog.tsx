"use client";

import { useEffect, useState, useCallback } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ConfirmOptions {
  message: string;
  title?: string;
  confirmText?: string;
  cancelText?: string;
  /** Red confirm button for destructive actions (default true). */
  danger?: boolean;
}

type Pending = { opts: ConfirmOptions; resolve: (ok: boolean) => void };

// Module-level opener wired up by <ConfirmDialogHost/>. Lets any call site
// (even outside React) request a confirmation imperatively.
let opener: ((opts: ConfirmOptions) => Promise<boolean>) | null = null;

/**
 * Professional replacement for window.confirm(). Returns a promise that
 * resolves true (confirmed) / false (cancelled). Falls back to the native
 * confirm only if the host isn't mounted.
 */
export function confirmDialog(opts: ConfirmOptions | string): Promise<boolean> {
  const o = typeof opts === "string" ? { message: opts } : opts;
  if (opener) return opener(o);
  if (typeof window !== "undefined") return Promise.resolve(window.confirm(o.message));
  return Promise.resolve(false);
}

export function ConfirmDialogHost() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    opener = (opts) => new Promise<boolean>((resolve) => setPending({ opts, resolve }));
    return () => {
      opener = null;
    };
  }, []);

  const close = useCallback(
    (ok: boolean) => {
      pending?.resolve(ok);
      setPending(null);
    },
    [pending],
  );

  const o = pending?.opts;
  const danger = o?.danger ?? true;

  return (
    <RadixDialog.Root open={!!pending} onOpenChange={(open) => { if (!open) close(false); }}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm animate-fade-in-up" />
        <RadixDialog.Content
          dir="rtl"
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-[60] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-lg animate-scale-in"
        >
          <div className="flex flex-col items-center text-center gap-3">
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-full ${
                danger ? "bg-error-light text-error" : "bg-primary-light text-primary"
              }`}
            >
              <AlertTriangle className="h-6 w-6" />
            </span>
            <RadixDialog.Title className="text-lg font-bold text-foreground">
              {o?.title ?? "تأكيد"}
            </RadixDialog.Title>
            <p className="text-sm text-muted-foreground leading-relaxed">{o?.message}</p>
          </div>

          <div className="mt-6 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => close(false)}>
              {o?.cancelText ?? "إلغاء"}
            </Button>
            <Button
              variant={danger ? "danger" : "default"}
              className="flex-1"
              onClick={() => close(true)}
            >
              {o?.confirmText ?? "تأكيد"}
            </Button>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
