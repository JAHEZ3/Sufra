import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';
import { PaymentMethod } from './order.read';

@Entity({ name: 'order_transactions', synchronize: false })
export class OrderTransactionRead {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'restaurant_id', type: 'uuid' })
  restaurantId: string;

  @Column({ type: 'enum', enum: PaymentMethod, enumName: 'payment_method' })
  type: PaymentMethod;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  amount: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
