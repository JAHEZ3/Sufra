import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn("bg-white rounded-xl border border-border shadow-sm", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: CardProps) {
  return (
    <div className={cn("p-5 border-b border-border", className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: CardProps) {
  return (
    <h3 className={cn("text-base font-bold text-foreground", className)}>
      {children}
    </h3>
  );
}

export function CardContent({ children, className }: CardProps) {
  return (
    <div className={cn("p-5", className)}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className }: CardProps) {
  return (
    <div className={cn("px-5 py-4 border-t border-border", className)}>
      {children}
    </div>
  );
}
