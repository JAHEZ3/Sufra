import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type SupportTicketSubject =
  | 'general'
  | 'technical'
  | 'billing'
  | 'partnership'
  | 'order_issue'
  | 'restaurant_join'
  | 'driver_join'
  | 'complaint'
  | 'other';

export type SupportTicketPriority = 'low' | 'normal' | 'high' | 'critical';

export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

/** Where the ticket originated. `contact_form` is the public website form. */
export type SupportTicketSource = 'manager' | 'contact_form';

@Entity('support_tickets')
@Index(['createdAt'])
export class SupportTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'submitted_by_user_id', type: 'uuid', nullable: true })
  submittedByUserId: string | null;

  @Column({ name: 'submitted_by_email', length: 255, nullable: true })
  submittedByEmail: string | null;

  @Column({ name: 'submitted_by_name', length: 200, nullable: true })
  submittedByName: string | null;

  @Column({ name: 'submitted_by_phone', length: 30, nullable: true })
  submittedByPhone: string | null;

  @Index()
  @Column({ length: 16, default: 'manager' })
  source: SupportTicketSource;

  @Column({ length: 32, default: 'general' })
  subject: SupportTicketSubject;

  @Column({ length: 16, default: 'normal' })
  priority: SupportTicketPriority;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Index()
  @Column({ length: 16, default: 'open' })
  status: SupportTicketStatus;

  @Column({ name: 'resolution_note', type: 'text', nullable: true })
  resolutionNote: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
