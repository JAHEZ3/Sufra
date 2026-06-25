export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PREPARING = 'preparing',
  READY_FOR_PICKUP = 'ready_for_pickup',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum PaymentMethod {
  CASH_ON_DELIVERY = 'cash_on_delivery',
  CARD = 'card',
  ONLINE = 'online',
}

export enum PaymentStatus {
  UNPAID = 'unpaid',
  PAID = 'paid',
  REFUNDED = 'refunded',
}

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

export enum OrderKind {
  ONLINE = 'online',
  LOCAL = 'local',
}

/**
 * Tracks whether a delivery agent has accepted/declined an assignment.
 *
 *  - `none`     : no driver attached to the order yet (default).
 *  - `pending`  : customer picked a driver via the self-pick flow — driver
 *                 hasn't seen the order yet; they get accept/reject buttons.
 *  - `accepted` : driver tapped accept (or a manager/owner assigned them
 *                 directly, which is treated as auto-accepted).
 *  - `rejected` : driver declined. The order's `deliveryAgentId` is cleared
 *                 and acceptance reset to `none` so the customer can pick
 *                 again. `rejected` is a transient state surfaced only in
 *                 the broadcast event payload, not persisted long-term.
 */
export enum DeliveryAcceptance {
  NONE = 'none',
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

export enum LocalServiceType {
  DINE_IN = 'dine_in',
  TAKEAWAY = 'takeaway',
}

export enum LocalOrderStatus {
  // Customer submitted via QR scan and is waiting for staff to accept/reject.
  // No kitchen activity yet; bill is read-only until accepted.
  PENDING = 'pending',
  // Staff are still ringing up items / collecting payment (legacy bills
  // created before PREPARING-on-create; new flow skips OPEN).
  OPEN = 'open',
  // Live state: kitchen is preparing, cashier can edit items and discounts,
  // 15-minute countdown is visible. Closes manually to DONE when paid.
  PREPARING = 'preparing',
  // Bill closed and paid — terminal state. Reached only via explicit cashier
  // action; the timer no longer auto-finalizes.
  DONE = 'done',
  // Cancelled / rejected before fulfilment.
  VOIDED = 'voided',
}
