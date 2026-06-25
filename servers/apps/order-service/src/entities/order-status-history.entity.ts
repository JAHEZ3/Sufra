import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { OrderStatus } from './order-enums';
import { Order } from './order.entity';

@Entity('order_status_history')
@Index(['createdAt'])
export class OrderStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, (o) => o.statusHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ type: 'enum', enum: OrderStatus, enumName: 'order_status' })
  status: OrderStatus;

  @Column({ name: 'changed_by_user_id', type: 'uuid', nullable: true })
  changedByUserId: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
