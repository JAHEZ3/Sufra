import { SufraLogo } from "@/components/ui/sufra-logo";

export function LoadingScreen({ message = "جارٍ التحميل..." }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-10 bg-background">
      {/* Animated Sufra brand lockup (compact) */}
      <SufraLogo variant="onLight" scale={0.6} />

      <div className="flex flex-col items-center gap-3">
        {/* Progress bar: fills left → right 0% → 100% */}
        <div dir="ltr" className="h-1 w-48 overflow-hidden rounded-full bg-primary-light">
          <span className="block h-full animate-loading-fill rounded-full bg-primary" />
        </div>

        <span className="text-sm text-muted-foreground">{message}</span>
      </div>
    </div>
  );
}
