"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Static Sufra mark — the green tile + QR plate, no animation. For sidebar /
 * header / favicon spots where a compact brand icon is needed.
 */
export function SufraMark({
  size = 48,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.27,
        background: "#1f8a5b",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 62 62" fill="none">
        <circle cx="31" cy="31" r="29" fill="none" stroke="#fff" strokeWidth="3" />
        <rect x="15" y="15" width="14" height="14" rx="4" fill="none" stroke="#fff" strokeWidth="2.6" />
        <rect x="19.5" y="19.5" width="5" height="5" rx="1.2" fill="#fff" />
        <rect x="33" y="15" width="14" height="14" rx="4" fill="none" stroke="#fff" strokeWidth="2.6" />
        <rect x="37.5" y="19.5" width="5" height="5" rx="1.2" fill="#fff" />
        <rect x="15" y="33" width="14" height="14" rx="4" fill="none" stroke="#fff" strokeWidth="2.6" />
        <rect x="19.5" y="37.5" width="5" height="5" rx="1.2" fill="#fff" />
        <rect x="34" y="34" width="4" height="4" rx="1" fill="#fff" />
        <rect x="40" y="34" width="4" height="4" rx="1" fill="#fff" />
        <rect x="34" y="40" width="4" height="4" rx="1" fill="#fff" />
        <rect x="40" y="40" width="4" height="4" rx="1" fill="#bfe6d4" />
      </svg>
    </div>
  );
}

/**
 * Sufra animated brand mark — ported from the Claude Design sheet
 * ("00 · Animated build"). The ring draws in, the QR squares pop, then the
 * "Sufra / سفرة" wordmark rises. Click to replay.
 *
 * variant: "onLight" (dark wordmark, for light surfaces) | "onDark" (white wordmark).
 */
export function SufraLogo({
  variant = "onLight",
  clickToReplay = true,
  scale = 1,
  animated = true,
}: {
  variant?: "onLight" | "onDark";
  clickToReplay?: boolean;
  scale?: number;
  animated?: boolean;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const animsRef = useRef<Animation[]>([]);

  const runAnim = useCallback(() => {
    const root = stageRef.current;
    if (!root) return;

    animsRef.current.forEach((a) => {
      try {
        a.cancel();
      } catch {
        /* already gone */
      }
    });
    const anims: Animation[] = [];

    const ring = root.querySelector(".ring");
    if (ring) {
      anims.push(
        ring.animate(
          [{ strokeDashoffset: 184 }, { strokeDashoffset: 0 }],
          { duration: 900, easing: "cubic-bezier(.65,0,.35,1)", fill: "forwards" },
        ),
      );
    }

    const dirs: [number, number][] = [
      [6, 6],
      [-6, 6],
      [6, -6],
      [-6, -6],
    ];
    root.querySelectorAll(".qr").forEach((q, i) => {
      const [tx, ty] = dirs[i] ?? [0, 0];
      anims.push(
        q.animate(
          [
            { opacity: 0, transform: `scale(0) translate(${tx}px,${ty}px)` },
            { opacity: 1, transform: "scale(1.18) translate(0,0)", offset: 0.6 },
            { opacity: 1, transform: "scale(1) translate(0,0)" },
          ],
          {
            duration: 550,
            delay: 550 + i * 130,
            easing: "cubic-bezier(.34,1.56,.64,1)",
            fill: "both",
          },
        ),
      );
    });

    const bar = root.querySelector(".bar");
    if (bar) {
      anims.push(
        bar.animate([{ width: "0px" }, { width: "46px" }], {
          duration: 500,
          delay: 1150,
          easing: "ease",
          fill: "forwards",
        }),
      );
    }

    const rise = (el: Element | null, delay: number) => {
      if (!el) return;
      anims.push(
        el.animate(
          [
            { opacity: 0, transform: "translateY(14px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 600, delay, easing: "cubic-bezier(.2,.7,.3,1)", fill: "both" },
        ),
      );
    };
    rise(root.querySelector(".wm"), 1050);
    rise(root.querySelector(".wm2"), 1220);

    animsRef.current = anims;
  }, []);

  useEffect(() => {
    if (!animated) return;
    const id = requestAnimationFrame(runAnim);
    const anims = animsRef;
    return () => {
      cancelAnimationFrame(id);
      anims.current.forEach((a) => {
        try {
          a.cancel();
        } catch {
          /* already gone */
        }
      });
    };
  }, [runAnim, animated]);

  // Initial states: hidden when animating in, fully shown when static.
  const ringOffset = animated ? 184 : 0;
  const qrOpacity = animated ? 0 : 1;
  const wmOpacity = animated ? 0 : 1;
  const wm2Opacity = animated ? 0 : 1;
  const barWidth = animated ? 0 : 46;
  const canReplay = animated && clickToReplay;

  const wordColor = variant === "onDark" ? "#ffffff" : "#16201a";
  const arabicColor = variant === "onDark" ? "#8fb9a4" : "#1f8a5b";

  return (
    <div
      ref={stageRef}
      onClick={canReplay ? runAnim : undefined}
      className="suf-logo"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 30,
        cursor: canReplay ? "pointer" : "default",
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: "center",
      }}
    >
      <div
        className="suf-tile"
        style={{
          width: 104,
          height: 104,
          borderRadius: 26,
          background: "#1f8a5b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width="64" height="64" viewBox="0 0 62 62" fill="none">
          <circle
            className="ring"
            cx="31"
            cy="31"
            r="29"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="184"
            strokeDashoffset={ringOffset}
          />
          <g className="qr" style={{ opacity: qrOpacity }}>
            <rect x="15" y="15" width="14" height="14" rx="4" fill="none" stroke="#fff" strokeWidth="2.6" />
            <rect x="19.5" y="19.5" width="5" height="5" rx="1.2" fill="#fff" />
          </g>
          <g className="qr" style={{ opacity: qrOpacity }}>
            <rect x="33" y="15" width="14" height="14" rx="4" fill="none" stroke="#fff" strokeWidth="2.6" />
            <rect x="37.5" y="19.5" width="5" height="5" rx="1.2" fill="#fff" />
          </g>
          <g className="qr" style={{ opacity: qrOpacity }}>
            <rect x="15" y="33" width="14" height="14" rx="4" fill="none" stroke="#fff" strokeWidth="2.6" />
            <rect x="19.5" y="37.5" width="5" height="5" rx="1.2" fill="#fff" />
          </g>
          <g className="qr" style={{ opacity: qrOpacity }}>
            <rect x="34" y="34" width="4" height="4" rx="1" fill="#fff" />
            <rect x="40" y="34" width="4" height="4" rx="1" fill="#fff" />
            <rect x="34" y="40" width="4" height="4" rx="1" fill="#fff" />
            <rect x="40" y="40" width="4" height="4" rx="1" fill="#bfe6d4" />
          </g>
        </svg>
      </div>

      <div style={{ lineHeight: 1 }}>
        <div
          className="wm"
          style={{ fontSize: 56, fontWeight: 700, color: wordColor, letterSpacing: "-.02em", opacity: wmOpacity }}
        >
          Sufra
        </div>
        <div
          className="bar"
          style={{ height: 3, background: "#1f8a5b", borderRadius: 2, margin: "14px 0 12px", width: barWidth }}
        />
        <div
          className="wm2"
          style={{ fontFamily: "'Reem Kufi',sans-serif", fontSize: 38, fontWeight: 600, color: arabicColor, opacity: wm2Opacity }}
        >
          سفرة
        </div>
      </div>
    </div>
  );
}
