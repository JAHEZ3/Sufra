import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';

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

@Entity({ name: 'orders', synchronize: false })
export class OrderRead {
  @PrimaryColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Index()
  @Column({ name: 'restaurant_id', type: 'uuid' })
  restaurantId: string;

  @Column({ type: 'enum', enum: OrderStatus, enumName: 'order_status' })
  status: OrderStatus;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  subtotal: string;

  @Column({ name: 'delivery_fee', type: 'numeric', precision: 8, scale: 2 })
  deliveryFee: string;

  @Column({ name: 'discount_amount', type: 'numeric', precision: 8, scale: 2 })
  discountAmount: string;

  @Column({ name: 'total_amount', type: 'numeric', precision: 10, scale: 2 })
  totalAmount: string;

  @Column({ name: 'payment_method', type: 'enum', enum: PaymentMethod, enumName: 'payment_method' })
  paymentMethod: PaymentMethod;

  @Column({ name: 'payment_status', type: 'enum', enum: PaymentStatus, enumName: 'payment_status' })
  paymentStatus: PaymentStatus;

  @Column({ name: 'delivered_at', type: 'timestamp', nullable: true })
  deliveredAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
