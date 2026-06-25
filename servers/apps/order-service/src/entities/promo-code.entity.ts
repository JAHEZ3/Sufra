import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import { DiscountType } from './order-enums';

@Entity('promo_codes')
export class PromoCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ length: 50, unique: true })
  code: string;

  @Column({ name: 'discount_type', type: 'enum', enum: DiscountType, enumName: 'discount_type' })
  discountType: DiscountType;

  @Column({ name: 'discount_value', type: 'numeric', precision: 8, scale: 2 })
  discountValue: number;

  @Column({ name: 'max_discount_cap', type: 'numeric', precision: 8, scale: 2, nullable: true })
  maxDiscountCap: number;

  @Column({ name: 'min_order_amount', type: 'numeric', precision: 8, scale: 2, default: 0.00 })
  minOrderAmount: number;

  @Column({ name: 'usage_limit', nullable: true })
  usageLimit: number;

  @Column({ name: 'usage_count', default: 0 })
  usageCount: number;

  @Column({ name: 'per_user_limit', default: 1 })
  perUserLimit: number;

  @Index()
  @Column({ name: 'restaurant_id', type: 'uuid', nullable: true })
  restaurantId: string;

  @Column({ name: 'valid_from', type: 'timestamp', nullable: true })
  validFrom: Date;

  @Index()
  @Column({ name: 'valid_until', type: 'timestamp', nullable: true })
  validUntil: Date;
}
