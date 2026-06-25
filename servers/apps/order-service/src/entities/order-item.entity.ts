import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { Order } from './order.entity';
import { OrderItemOption } from './order-item-option.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Index()
  @Column({ name: 'meal_id', type: 'uuid' })
  mealId: string;

  @Column({ name: 'meal_name_snapshot', length: 200 })
  mealNameSnapshot: string;

  @Column({ name: 'unit_price_snapshot', type: 'numeric', precision: 8, scale: 2 })
  unitPriceSnapshot: number;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ name: 'total_price', type: 'numeric', precision: 10, scale: 2 })
  totalPrice: number;

  @Column({ name: 'special_instructions', type: 'text', nullable: true })
  specialInstructions: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @OneToMany(() => OrderItemOption, (opt) => opt.orderItem)
  options: OrderItemOption[];
}
