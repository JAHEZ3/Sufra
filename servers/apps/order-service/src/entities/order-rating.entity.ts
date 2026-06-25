import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('order_ratings')
export class OrderRating {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid', unique: true })
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
