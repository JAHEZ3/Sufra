import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('system_settings')
export class SystemSettings {
  @PrimaryColumn({ type: 'int', default: 1 })
  id: number;

  @Column({ name: 'maintenance_mode', type: 'boolean', default: false })
  maintenanceMode: boolean;

  @Column({ name: 'allow_new_registrations', type: 'boolean', default: true })
  allowNewRegistrations: boolean;

  @Column({ name: 'allow_new_restaurants', type: 'boolean', default: true })
  allowNewRestaurants: boolean;

  @Column({ name: 'require_restaurant_approval', type: 'boolean', default: true })
  requireRestaurantApproval: boolean;

  @Column({ name: 'require_driver_approval', type: 'boolean', default: true })
  requireDriverApproval: boolean;

  @Column({ name: 'enable_ratings', type: 'boolean', default: true })
  enableRatings: boolean;

  @Column({ name: 'enable_reviews', type: 'boolean', default: true })
  enableReviews: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
