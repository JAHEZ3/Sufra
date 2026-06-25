import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity({ name: 'order_ratings', synchronize: false })
export class OrderRatingRead {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Index()
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column({ name: 'food_rating', type: 'smallint' })
  foodRating: number;

  @Column({ name: 'delivery_rating', type: 'smallint' })
  deliveryRating: number;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
