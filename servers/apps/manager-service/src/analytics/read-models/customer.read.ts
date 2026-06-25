import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'customers', synchronize: false })
export class CustomerRead {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'first_name', length: 80, nullable: true })
  firstName: string | null;

  @Column({ name: 'last_name', length: 80, nullable: true })
  lastName: string | null;

  @Column({ name: 'profile_completed' })
  profileCompleted: boolean;

  @Column({ name: 'wallet_balance', type: 'numeric', precision: 10, scale: 2 })
  walletBalance: string;

  @Column({ name: 'location_lat', type: 'numeric', precision: 9, scale: 6, nullable: true })
  locationLat: string | null;

  @Column({ name: 'location_lng', type: 'numeric', precision: 9, scale: 6, nullable: true })
  locationLng: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
