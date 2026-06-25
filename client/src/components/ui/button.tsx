import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f8a5b] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-[#1f8a5b] text-white shadow-[0_4px_16px_rgba(31,138,91,0.35)] hover:bg-[#176f49] hover:shadow-[0_6px_20px_rgba(31,138,91,0.45)] active:scale-[0.98]",
        outline:
          "border-2 border-[#1f8a5b] text-[#1f8a5b] bg-transparent hover:bg-[#e6f2ec] active:scale-[0.98]",
        ghost:
          "text-[#1f8a5b] hover:bg-[#e6f2ec] active:scale-[0.98]",
        secondary:
          "bg-white text-[#1f8a5b] shadow-md hover:shadow-lg hover:bg-[#e6f2ec] active:scale-[0.98]",
        destructive:
          "bg-red-500 text-white hover:bg-red-600 active:scale-[0.98]",
        dark:
          "bg-[#16201b] text-white hover:bg-[#16201a] active:scale-[0.98]",
      },
      size: {
        default: "h-11 px-6 py-2 text-sm",
        sm: "h-9 px-4 text-xs rounded-lg",
        lg: "h-13 px-8 text-base rounded-2xl",
        xl: "h-14 px-10 text-lg rounded-2xl",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
