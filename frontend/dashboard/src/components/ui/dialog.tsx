"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
}

export function DialogContent({ children, className, title, description }: DialogContentProps) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-fade-in-up" />
      <RadixDialog.Content
        // Opt out of Radix's auto-linked description when none is provided,
        // otherwise it warns about a missing aria-describedby target.
        {...(description ? {} : { "aria-describedby": undefined })}
        className={cn(
          "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
          "bg-white rounded-2xl shadow-lg z-50 w-full max-w-lg max-h-[90vh] overflow-y-auto",
          "animate-scale-in p-6",
          className
        )}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            {title && (
              <RadixDialog.Title className="text-lg font-bold text-foreground">
                {title}
              </RadixDialog.Title>
            )}
            {description && (
              <RadixDialog.Description className="text-sm text-muted-foreground mt-1">
                {description}
              </RadixDialog.Description>
            )}
          </div>
          <RadixDialog.Close className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </RadixDialog.Close>
        </div>
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
