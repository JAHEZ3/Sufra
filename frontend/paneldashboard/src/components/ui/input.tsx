import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, startIcon, endIcon, id, ...props }, ref) => {
    const inputId = id || label?.replace(/\s+/g, "-").toLowerCase();
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {startIcon && (
            <span className="absolute right-3 text-muted-foreground">{startIcon}</span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full h-10 rounded-lg border bg-white px-3 py-2 text-sm text-foreground",
              "placeholder:text-muted-foreground",
              "border-border focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
              "transition-colors",
              error && "border-error focus:ring-error/30",
              startIcon && "pr-10",
              endIcon && "pl-10",
              className
            )}
            {...props}
          />
          {endIcon && (
            <span className="absolute left-3 text-muted-foreground">{endIcon}</span>
          )}
        </div>
        {error && <p className="text-xs text-error">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
