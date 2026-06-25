import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('delivery_settings')
export class DeliverySettings {
  @PrimaryColumn({ type: 'int', default: 1 })
  id: number;

  @Column({ name: 'max_delivery_radius', type: 'int', default: 15 })
  maxDeliveryRadius: number;

  @Column({ name: 'estimated_time_min', type: 'int', default: 20 })
  estimatedTimeMin: number;

  @Column({ name: 'estimated_time_max', type: 'int', default: 45 })
  estimatedTimeMax: number;

  @Column({ name: 'allow_scheduled_orders', type: 'boolean', default: true })
  allowScheduledOrders: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
