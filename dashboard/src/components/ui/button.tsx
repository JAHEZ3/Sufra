import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default:   "bg-primary text-white hover:bg-primary-hover shadow-sm",
        outline:   "border border-border bg-white text-foreground hover:bg-muted",
        ghost:     "text-foreground hover:bg-muted",
        danger:    "bg-error text-white hover:bg-red-600",
        success:   "bg-success text-white hover:bg-green-600",
        secondary: "bg-muted text-foreground hover:bg-border",
        link:      "text-primary underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        sm:   "h-8  px-3  text-xs",
        md:   "h-10 px-4  text-sm",
        lg:   "h-11 px-6  text-base",
        icon: "h-9  w-9   text-sm",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        {children}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
