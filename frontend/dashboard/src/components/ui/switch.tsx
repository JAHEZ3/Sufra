"use client";

import * as RadixSwitch from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

interface SwitchProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export function Switch({ checked, onCheckedChange, disabled, label, className }: SwitchProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <RadixSwitch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          "relative h-6 w-11 rounded-full transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          "disabled:opacity-50 disabled:pointer-events-none",
          checked ? "bg-primary" : "bg-border"
        )}
      >
        <RadixSwitch.Thumb
          className={cn(
            "block h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </RadixSwitch.Root>
      {label && <span className="text-sm font-medium text-foreground">{label}</span>}
    </div>
  );
}
