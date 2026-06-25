"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { SufraMark } from "@/components/ui/sufra-logo";

// Shared selling points shown on the hero of both login & register — POS-focused
// (Sufra is POS-only; no delivery/shipping).
const FEATURES = [
  "إدارة الطلبات والطاولات لحظياً",
  "نقطة بيع وطباعة فواتير فورية",
  "تقارير وتحليلات يومية لإيراداتك",
  "قوائم QR ذكية لعملائك",
];

/** Faint flowing contour lines in the brand green. */
function FlowLines() {
  return (
    <svg
      className="absolute inset-y-0 left-0 h-full w-[70%] pointer-events-none"
      viewBox="0 0 800 600"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <ellipse
          key={i}
          cx={180}
          cy={300}
          rx={70 + i * 78}
          ry={55 + i * 60}
          fill="none"
          stroke="#1f8a5b"
          strokeWidth="1"
          opacity={0.06}
        />
      ))}
    </svg>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: ReactNode;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div
      className="relative min-h-screen overflow-hidden"
      dir="rtl"
      // Soft wash of the brand green (main color at low opacity).
      style={{ background: "linear-gradient(135deg,rgba(31,138,91,0.10) 0%,rgba(31,138,91,0.04) 45%,rgba(31,138,91,0.10) 100%)" }}
    >
      <FlowLines />

      {/* Brand logo — fixed at the page top-right corner */}
      <div className="group absolute top-5 right-6 z-20 flex cursor-default items-center gap-2.5 lg:top-7 lg:right-10">
        <SufraMark size={40} />
        <div className="flex flex-col items-start">
          <span className="text-2xl font-black text-[#1f8a5b]" style={{ fontFamily: "'Reem Kufi', sans-serif" }}>
            سفرة
          </span>
          {/* Animated underline: grows left → right on hover, brand green at low opacity */}
          <span className="mt-1 h-0.5 w-full origin-left scale-x-0 rounded-full bg-primary/50 transition-transform duration-300 ease-out group-hover:scale-x-100" />
        </div>
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center gap-12 px-6 py-10 lg:flex-row lg:gap-16 lg:px-10">
        {/* Hero (right on desktop) */}
        <div className="hidden flex-1 flex-col lg:flex">
          <h1 className="text-[2.9rem] font-black leading-[1.25] text-[#16201b]">{title}</h1>
          <p className="mt-5 max-w-md text-[17px] leading-loose text-muted-foreground">{subtitle}</p>

          {/* Feature checklist — identical on login & register */}
          <ul className="mt-8 space-y-3.5">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary shadow-sm shadow-primary/30">
                  <Check className="h-4 w-4 text-white" strokeWidth={3} />
                </span>
                <span className="text-[17px] font-bold text-[#16201b]">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Form card (left on desktop) */}
        <div className="w-full max-w-md">
          <div className="rounded-3xl border border-border bg-white p-7 shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
