import { Entity, PrimaryGeneratedColumn, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { OrderItem } from './order-item.entity';

@Entity('order_item_options')
export class OrderItemOption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'order_item_id', type: 'uuid' })
  orderItemId: string;

  @ManyToOne(() => OrderItem, (item) => item.options, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_item_id' })
  orderItem: OrderItem;

  @Column({ name: 'option_id', type: 'uuid' })
  optionId: string;

  @Column({ name: 'option_name_snapshot', length: 100 })
  optionNameSnapshot: string;

  @Column({ name: 'extra_price_snapshot', type: 'numeric', precision: 8, scale: 2, default: 0.00 })
  extraPriceSnapshot: number;
}
