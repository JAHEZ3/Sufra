// ─── Queue names ──────────────────────────────────────────────────────────────
export const RECEIPT_QUEUE = 'receipt';
export const POS_FINALIZE_QUEUE = 'pos-finalize';
export const ONLINE_AUTO_READY_QUEUE = 'online-auto-ready';

// ─── Job names ────────────────────────────────────────────────────────────────
export const JOBS = {
  GENERATE_RECEIPT: 'generate-receipt',
  POS_FINALIZE: 'pos-finalize',
  ONLINE_AUTO_READY: 'online-auto-ready',
} as const;

// How long a closed POS bill stays in "preparing" before auto-flipping to "done".
export const PREPARING_AUTO_DONE_MS = 15 * 60 * 1000; // 15 minutes

// How long an online order stays in "preparing" before auto-flipping to
// READY_FOR_PICKUP. Matches the dashboard countdown rendered on the row.
export const ONLINE_PREPARING_AUTO_READY_MS = 15 * 60 * 1000; // 15 minutes
