import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[#e6f2ec] text-[#1f8a5b]",
        outline: "border border-[#1f8a5b] text-[#1f8a5b] bg-transparent",
        secondary: "bg-gray-100 text-gray-700",
        success: "bg-green-50 text-green-700",
        destructive: "bg-red-50 text-red-600",
        white: "bg-white/20 text-white border border-white/30",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
