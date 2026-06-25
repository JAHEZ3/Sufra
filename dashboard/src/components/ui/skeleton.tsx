import { cn } from "@/lib/utils";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, style, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-gradient-to-r from-muted via-border to-muted bg-[length:200%_100%]",
        className
      )}
      style={{ animation: "shimmer 1.5s ease-in-out infinite", ...style }}
      {...props}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-border p-5 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}
