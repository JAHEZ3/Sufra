import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

export enum UserRole {
  CUSTOMER = "customer",
  RESTAURANT_OWNER = "restaurant_owner",
  DELIVERY = "delivery",
  MANAGER = "manager",
}

export enum UserStatus {
  PENDING = "pending",
  ACTIVE = "active",
  SUSPENDED = "suspended",
  BANNED = "banned",
}

@Entity("users")
@Index(["role", "status"])
@Index(["createdAt"])
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ unique: true, length: 255, nullable: true })
  email: string;

  @Index()
  @Column({ unique: true, length: 20, nullable: true })
  phone: string;

  @Column({ name: "full_name", length: 255, nullable: true })
  fullName: string;

  @Column({ name: "password_hash", type: "text", nullable: true })
  passwordHash: string;

  @Column({ type: "enum", enum: UserRole, enumName: "user_role" })
  role: UserRole;

  @Column({
    type: "enum",
    enum: UserStatus,
    enumName: "user_status",
    default: UserStatus.PENDING,
  })
  status: UserStatus;

  @Column({ name: "email_verified_at", type: "timestamp", nullable: true })
  emailVerifiedAt: Date;

  @Column({ name: "phone_verified_at", type: "timestamp", nullable: true })
  phoneVerifiedAt: Date;

  @Column({ name: "last_login_at", type: "timestamp", nullable: true })
  lastLoginAt: Date;

  @Column({ name: "device_info", type: "jsonb", nullable: true })
  deviceInfo: Record<string, any>;

  @Column({ name: "profile_completed", default: false })
  profileCompleted: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
