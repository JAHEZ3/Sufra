import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * A physical table at a restaurant. Powers the QR-ordering flow: customers
 * scan a per-table QR (carrying `qrToken`) and submit an anonymous POS order
 * that lands on the staff dashboard for confirmation.
 */
@Entity("restaurant_tables")
@Index(["restaurantId", "number"], { unique: true })
export class RestaurantTable {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "restaurant_id", type: "uuid" })
  restaurantId: string;

  // Free-form: '5', 'T1', 'طاولة 7'. Unique per restaurant.
  @Column({ length: 50 })
  number: string;

  @Column({ type: "int", default: 4 })
  capacity: number;

  // Section / area label, e.g. 'داخلي', 'تراس', 'VIP'.
  @Column({ length: 80, nullable: true })
  section: string | null;

  // Secret slug embedded in the QR URL. Rotatable so a leaked QR can be
  // invalidated without renumbering the table.
  @Index({ unique: true })
  @Column({ name: "qr_token", length: 64 })
  qrToken: string;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
