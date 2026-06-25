import type { ReactNode } from "react";
import { StatusGuard } from "@/providers/StatusGuard";

export default function StatusLayout({ children }: { children: ReactNode }) {
  return (
    <StatusGuard>
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6" dir="rtl">
        {children}
      </div>
    </StatusGuard>
  );
}
