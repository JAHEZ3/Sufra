import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

export enum UserRole {
  CUSTOMER = 'customer',
  RESTAURANT_OWNER = 'restaurant_owner',
  DELIVERY = 'delivery',
  MANAGER = 'manager',
}

export enum UserStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  BANNED = 'banned',
}

@Entity({ name: 'users', synchronize: false })
export class UserRead {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: UserRole, enumName: 'user_role' })
  role: UserRole;

  @Column({ type: 'enum', enum: UserStatus, enumName: 'user_status' })
  status: UserStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
