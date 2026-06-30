import { ChildEntity, Column, Index } from 'typeorm';
import { Order } from './order.entity';
import { LocalOrderStatus, LocalServiceType, OrderKind } from './order-enums';

/**
 * In-restaurant POS order. Bills opened by staff at the counter or for a
 * dine-in table. Has its own minimal status flow (open → closed / voided)
 * separate from the delivery lifecycle, and tracks the cashier and split
 * payments.
 */
@ChildEntity(OrderKind.LOCAL)
export class LocalOrder extends Order {
  @Index()
  @Column({
    name: 'local_status',
    type: 'enum',
    enum: LocalOrderStatus,
    enumName: 'local_order_status',
    default: LocalOrderStatus.OPEN,
  })
  localStatus: LocalOrderStatus;

  @Column({
    name: 'service_type',
    type: 'enum',
    enum: LocalServiceType,
    enumName: 'local_service_type',
    nullable: true,
  })
  serviceType: LocalServiceType;

  @Column({ name: 'table_number', length: 20, nullable: true })
  tableNumber: string;

  // Links to restaurant_tables.id when this bill was opened via a QR scan
  // or a staff-side table picker. Nullable: free-text tableNumber still works
  // for ad-hoc tables that aren't in the registry.
  @Index()
  @Column({ name: 'table_id', type: 'uuid', nullable: true })
  tableId: string | null;

  // Set the moment the bill is closed and the order enters PREPARING. The
  // POS dashboard uses this to render a 15-minute countdown.
  @Column({ name: 'preparing_started_at', type: 'timestamp', nullable: true })
  preparingStartedAt: Date | null;

  // The staff user who opened/owns this bill. Replaces the previous overload
  // of customer_id and gives the audit trail a clear answer to "who rang it".
  @Index()
  @Column({ name: 'cashier_user_id', type: 'uuid', nullable: true })
  cashierUserId: string;

  // [{ id, amount, method, paidAt, reference?, payerName? }] — supports
  // split-bill payment. `id` is a uuid so individual splits can be edited
  // (reference/payerName/paidAt) after they're recorded. Older splits
  // without an id are tolerated by the service layer.
  @Column({ name: 'payment_splits', type: 'jsonb', nullable: true })
  paymentSplits: Array<{
    id?: string;
    amount: number;
    method: string;
    paidAt: string;
    reference?: string;
    payerName?: string;
  }>;

  // True once this bill's ingredients have been deducted from inventory
  // (set when the bill is closed → DONE). Cleared when the bill is re-opened
  // and the stock is returned. Guards against double-deduction on re-close.
  @Column({ name: 'inventory_applied', type: 'boolean', default: false })
  inventoryApplied: boolean;
}
