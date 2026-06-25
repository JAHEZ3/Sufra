import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('fees_settings')
export class FeesSettings {
  @PrimaryColumn({ type: 'int', default: 1 })
  id: number;

  @Column({
    name: 'restaurant_commission',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 15,
  })
  restaurantCommission: number;

  @Column({
    name: 'delivery_fee_base',
    type: 'numeric',
    precision: 8,
    scale: 2,
    default: 5,
  })
  deliveryFeeBase: number;

  @Column({
    name: 'delivery_fee_per_km',
    type: 'numeric',
    precision: 8,
    scale: 2,
    default: 2,
  })
  deliveryFeePerKm: number;

  @Column({
    name: 'min_order_amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 20,
  })
  minOrderAmount: number;

  @Column({
    name: 'tax_rate',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 15,
  })
  taxRate: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
