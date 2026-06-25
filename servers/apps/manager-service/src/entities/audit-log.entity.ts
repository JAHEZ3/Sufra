import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('audit_logs')
@Index(['createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId: string;

  @Index()
  @Column({ length: 100 })
  action: string;

  @Index(['targetType', 'targetId'])
  @Column({ name: 'target_type', length: 50, nullable: true })
  targetType: string;

  @Column({ name: 'target_id', type: 'uuid', nullable: true })
  targetId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
