// Web Audio sound effects for the dashboard — synthesized, no asset files.
// A single persistent AudioContext is reused and resumed on play; browsers
// suspend a fresh context created long after the last gesture, so reuse +
// unlock-on-gesture is what makes delayed sounds (e.g. a socket-pushed new
// order) actually ring.

let audioCtx: AudioContext | null = null;

export function getAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") void audioCtx.resume().catch(() => {});
  return audioCtx;
}

type Wave = OscillatorType;
function tone(ctx: AudioContext, freq: number, start: number, dur: number, peak: number, type: Wave) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  o.connect(g);
  g.connect(ctx.destination);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.start(start);
  o.stop(start + dur);
}

/** Two-tone "ding-dong" — new order / status change alert. */
export function bell() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, 988, now, 0.65, 0.3, "sine");
  tone(ctx, 784, now + 0.18, 0.65, 0.3, "sine");
}

/** Crisp single high beep — like a checkout barcode scanner (item added). */
export function scannerBeep() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "square";
  o.frequency.value = 2600;
  o.connect(g);
  g.connect(ctx.destination);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.16, now + 0.004); // fast attack
  g.gain.setValueAtTime(0.16, now + 0.07);                // flat top
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.11); // quick cut
  o.start(now);
  o.stop(now + 0.12);
}

/** Bright rising arpeggio — payment / order success (Apple-Pay-style). */
export function successChime() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const notes = [659.25, 830.61, 1046.5]; // E5 · G#5 · C6 — major, rising
  notes.forEach((f, i) => tone(ctx, f, now + i * 0.085, 0.35, 0.3, "triangle"));
}

/** Attach once: unlocks the audio context on the first user gesture. */
export function installAudioUnlock(): () => void {
  if (typeof window === "undefined") return () => {};
  const unlock = () => {
    getAudioCtx();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
  return () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
}
