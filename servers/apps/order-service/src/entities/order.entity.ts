import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  OneToMany,
  TableInheritance,
} from 'typeorm';
import { PaymentMethod, PaymentStatus } from './order-enums';
import { OrderItem } from './order-item.entity';
import { OrderStatusHistory } from './order-status-history.entity';

/**
 * Base order class — shared columns for every kind of order (online delivery,
 * local POS dine-in, local POS takeaway). The `kind` discriminator column
 * lets TypeORM resolve each row to the right child class (OnlineOrder /
 * LocalOrder). Kind-specific columns live on the child entities; they exist
 * in the same physical `orders` table but are only populated for the relevant
 * child.
 */
@Entity('orders')
@TableInheritance({ column: { type: 'varchar', name: 'kind', length: 20 } })
// Prevents duplicate orders from the same customer using the same idempotency key
@Index(['customerId', 'idempotencyKey'], { unique: true, where: '"idempotency_key" IS NOT NULL' })
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_number', length: 20, unique: true })
  orderNumber: string;

  // Client-supplied UUID — enables safe retries without double-orders
  @Column({ name: 'idempotency_key', type: 'uuid', nullable: true })
  idempotencyKey: string | null;

  // Nullable: walk-in POS orders may have no registered customer
  @Index()
  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId: string | null;

  @Index()
  @Column({ name: 'restaurant_id', type: 'uuid' })
  restaurantId: string;

  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId: string;

  @Column({ name: 'restaurant_name_snapshot', length: 200, nullable: true })
  restaurantNameSnapshot: string;

  @Column({ name: 'customer_name_snapshot', length: 200, nullable: true })
  customerNameSnapshot: string;

  @Column({ name: 'customer_phone_snapshot', length: 50, nullable: true })
  customerPhoneSnapshot: string;

  @Column({ name: 'receipt_key', type: 'text', nullable: true })
  receiptKey: string;

  @Column({ name: 'payment_proof_key', type: 'text', nullable: true })
  paymentProofKey: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ name: 'discount_amount', type: 'numeric', precision: 8, scale: 2, default: 0.00 })
  discountAmount: number;

  @Column({ name: 'total_amount', type: 'numeric', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ name: 'payment_method', type: 'enum', enum: PaymentMethod, enumName: 'payment_method' })
  paymentMethod: PaymentMethod;

  @Index()
  @Column({ name: 'payment_status', type: 'enum', enum: PaymentStatus, enumName: 'payment_status', default: PaymentStatus.UNPAID })
  paymentStatus: PaymentStatus;

  @Column({ name: 'promo_code_id', type: 'uuid', nullable: true })
  promoCodeId: string;

  @Column({ name: 'customer_notes', type: 'text', nullable: true })
  customerNotes: string;

  @Column({ name: 'is_locked', default: false })
  isLocked: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Discriminator value: 'online' or 'local'. Set automatically by TypeORM
  // based on which child class was used to save the row.
  @Column({ length: 20 })
  kind: string;

  @OneToMany(() => OrderItem, (item) => item.order)
  items: OrderItem[];

  @OneToMany(() => OrderStatusHistory, (h) => h.order)
  statusHistory: OrderStatusHistory[];
}
