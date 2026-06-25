import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:  "bg-primary/10 text-primary",
        success:  "bg-success-light text-green-800",
        warning:  "bg-warning-light text-amber-800",
        error:    "bg-error-light text-red-800",
        info:     "bg-info-light text-blue-800",
        muted:    "bg-muted text-muted-foreground",
        outline:  "border border-border text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
