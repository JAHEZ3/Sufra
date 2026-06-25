import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum RestaurantRequestStatus {
  PENDING  = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('restaurant_requests')
export class RestaurantRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'restaurant_id', type: 'uuid' })
  restaurantId: string; // FK → restaurants.id

  // TODO: Replace local file paths with S3/Cloudflare R2 signed URLs.
  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl: string;

  @Column({ name: 'owner_id_picture_url', type: 'text', nullable: true })
  ownerIdPictureUrl: string;

  @Column({
    type: 'enum',
    enum: RestaurantRequestStatus,
    enumName: 'restaurant_request_status',
    default: RestaurantRequestStatus.PENDING,
  })
  status: RestaurantRequestStatus;

  @CreateDateColumn({ name: 'submitted_at' })
  submittedAt: Date;

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt: Date;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string; // managerId from JWT

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string;
}
