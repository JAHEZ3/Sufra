import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('payment_settings')
export class PaymentSettings {
  @PrimaryColumn({ type: 'int', default: 1 })
  id: number;

  @Column({ name: 'enable_credit_card', type: 'boolean', default: true })
  enableCreditCard: boolean;

  @Column({ name: 'enable_apple_pay', type: 'boolean', default: true })
  enableApplePay: boolean;

  @Column({ name: 'enable_cash_on_delivery', type: 'boolean', default: true })
  enableCashOnDelivery: boolean;

  @Column({ name: 'enable_wallet', type: 'boolean', default: true })
  enableWallet: boolean;

  @Column({
    name: 'max_wallet_balance',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 500,
  })
  maxWalletBalance: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
