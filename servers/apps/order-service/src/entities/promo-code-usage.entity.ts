import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, Unique } from 'typeorm';

@Entity('promo_code_usages')
@Unique(['promoCodeId', 'customerId', 'orderId'])
export class PromoCodeUsage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'promo_code_id', type: 'uuid' })
  promoCodeId: string;

  @Index()
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Column({ name: 'discount_amount', type: 'numeric', precision: 8, scale: 2 })
  discountAmount: number;

  @CreateDateColumn({ name: 'used_at' })
  usedAt: Date;
}
