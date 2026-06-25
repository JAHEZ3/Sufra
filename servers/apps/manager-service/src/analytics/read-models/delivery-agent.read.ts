import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

export enum AgentStatus {
  PENDING_APPROVAL = 'pending_approval',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  OFFLINE = 'offline',
}

@Entity({ name: 'delivery_agents', synchronize: false })
export class DeliveryAgentRead {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'first_name', length: 80 })
  firstName: string;

  @Column({ name: 'last_name', length: 80 })
  lastName: string;

  @Column({ length: 100, nullable: true })
  city: string;

  @Column({ type: 'enum', enum: AgentStatus, enumName: 'agent_status' })
  status: AgentStatus;

  @Column({ type: 'numeric', precision: 3, scale: 2 })
  rating: string;

  @Column({ name: 'total_deliveries' })
  totalDeliveries: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
