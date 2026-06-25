import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

@Entity({ name: 'order_items', synchronize: false })
export class OrderItemRead {
  @PrimaryColumn('uuid')
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
  unitPriceSnapshot: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ name: 'total_price', type: 'numeric', precision: 10, scale: 2 })
  totalPrice: string;
}
