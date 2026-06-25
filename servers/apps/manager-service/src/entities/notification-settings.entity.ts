import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('notification_settings')
export class NotificationSettings {
  @PrimaryColumn({ type: 'int', default: 1 })
  id: number;

  @Column({ name: 'enable_email_notifications', type: 'boolean', default: true })
  enableEmailNotifications: boolean;

  @Column({ name: 'enable_sms_notifications', type: 'boolean', default: true })
  enableSmsNotifications: boolean;

  @Column({ name: 'enable_push_notifications', type: 'boolean', default: true })
  enablePushNotifications: boolean;

  @Column({ name: 'order_updates_enabled', type: 'boolean', default: true })
  orderUpdatesEnabled: boolean;

  @Column({ name: 'marketing_enabled', type: 'boolean', default: false })
  marketingEnabled: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
