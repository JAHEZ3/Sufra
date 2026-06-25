import { Entity, PrimaryColumn, Column } from 'typeorm';

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

// Read-only mirror of the auth-service `users` table. synchronize:false so
// TypeORM never tries to migrate the schema from this service.
@Entity({ name: 'users', synchronize: false })
export class UserRead {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ name: 'full_name', length: 255, nullable: true })
  fullName: string;

  @Column({ type: 'enum', enum: UserRole, enumName: 'user_role' })
  role: UserRole;

  @Column({ type: 'enum', enum: UserStatus, enumName: 'user_status' })
  status: UserStatus;
}
