import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

export enum OtpPurpose {
  PHONE_VERIFY = 'phone_verify', // registration — verify phone before account activation
  LOGIN = 'login',               // login step 2 — OTP for active customers
  PASSWORD_RESET = 'password_reset',
}

@Entity('otp_codes')
@Index(['expiresAt'])
export class OtpCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'code_hash', type: 'text' })
  codeHash: string;

  @Column({ type: 'enum', enum: OtpPurpose, enumName: 'otp_purpose' })
  purpose: OtpPurpose;

  @Column({ default: 0 })
  attempts: number;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamp', nullable: true })
  usedAt: Date;
}
