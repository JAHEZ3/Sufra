"use client";

import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Compact form: 1234 → "1.2K", 1_500_000 → "1.5M". */
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const formatCompact = (n: number, decimals: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(decimals) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(decimals) + "K";
  return n.toFixed(decimals);
};

export function CountUp({
  value,
  duration = 1400,
  decimals = 0,
  prefix = "",
  suffix = "",
  compact = false,
  className,
  style,
}: CountUpProps) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(t);
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  const formatted = compact
    ? formatCompact(display, decimals)
    : new Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(display);

  return (
    <span className={className} style={style}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
