import * as React from "react";
import { cn } from "@/lib/utils";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || label?.replace(/\s+/g, "-").toLowerCase();
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground",
            "placeholder:text-muted-foreground resize-none",
            "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
            "transition-colors",
            error && "border-error focus:ring-error/30",
            className
          )}
          rows={3}
          {...props}
        />
        {error && <p className="text-xs text-error">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
