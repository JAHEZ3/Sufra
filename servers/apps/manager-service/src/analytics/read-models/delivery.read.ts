import { Entity, PrimaryColumn, Column } from 'typeorm';

export enum DeliveryStatus {
  ASSIGNED = 'assigned',
  HEADING_TO_RESTAURANT = 'heading_to_restaurant',
  PICKED_UP = 'picked_up',
  HEADING_TO_CUSTOMER = 'heading_to_customer',
  DELIVERED = 'delivered',
  FAILED = 'failed',
}

@Entity({ name: 'deliveries', synchronize: false })
export class DeliveryRead {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Column({ name: 'agent_id', type: 'uuid' })
  agentId: string;

  @Column({ type: 'enum', enum: DeliveryStatus, enumName: 'delivery_status' })
  status: DeliveryStatus;

  @Column({ name: 'distance_km', type: 'numeric', precision: 6, scale: 2, nullable: true })
  distanceKm: string;

  @Column({ name: 'agent_earnings', type: 'numeric', precision: 8, scale: 2, nullable: true })
  agentEarnings: string;

  @Column({ name: 'delivered_at', type: 'timestamp', nullable: true })
  deliveredAt: Date;
}
