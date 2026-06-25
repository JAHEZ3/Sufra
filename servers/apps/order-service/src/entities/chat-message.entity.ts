import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum ChatSenderRole {
  CUSTOMER = 'customer',
  RESTAURANT = 'restaurant',
  DELIVERY = 'delivery',
  MANAGER = 'manager',
}

@Entity('chat_messages')
@Index(['orderId', 'createdAt'])
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Index()
  @Column({ name: 'sender_id', type: 'uuid' })
  senderId: string;

  @Column({
    name: 'sender_role',
    type: 'enum',
    enum: ChatSenderRole,
    enumName: 'chat_sender_role',
  })
  senderRole: ChatSenderRole;

  @Column({ name: 'sender_name', length: 200 })
  senderName: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'is_archived', default: false })
  isArchived: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
