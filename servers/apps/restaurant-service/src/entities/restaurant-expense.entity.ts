import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export enum ExpenseCategory {
  RENT = "rent",           // إيجار
  SALARIES = "salaries",   // رواتب
  SUPPLIES = "supplies", /* The comment `// موردين / مشتريات` is providing a translation or
  clarification for the ExpenseCategory enum value `SUPPLIES`. In this case,
  it is translating the category "SUPPLIES" into Arabic, where "موردين /
  مشتريات" means "suppliers / purchases" in English. This can be helpful for
  developers or users who are more comfortable with Arabic or for
  documentation purposes. */
    // موردين / مشتريات
  UTILITIES = "utilities", // فواتير (كهرباء/ماء/إنترنت)
  OTHER = "other",         // أخرى
}

/**
 * Operational expense recorded by the restaurant owner (rent, salaries,
 * supplies, etc.). Subtracted from order revenue to compute net profit
 * in the finance dashboard.
 */
@Entity("restaurant_expenses")
@Index(["restaurantId", "occurredAt"])
export class RestaurantExpense {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "restaurant_id", type: "uuid" })
  restaurantId: string;

  // Stored as a positive number; the report logic treats it as outflow.
  @Column({ type: "numeric", precision: 12, scale: 2 })
  amount: number;

  @Index()
  @Column({
    type: "enum",
    enum: ExpenseCategory,
    enumName: "expense_category",
    default: ExpenseCategory.OTHER,
  })
  category: ExpenseCategory;

  @Column({ type: "text", nullable: true })
  description: string | null;

  // When the expense actually happened (lets staff backfill old bills).
  // Defaults to created_at server-side if omitted by the client.
  @Index()
  @Column({ name: "occurred_at", type: "timestamp" })
  occurredAt: Date;

  // The user (owner / manager) who entered the row. Audit only.
  @Column({ name: "created_by_user_id", type: "uuid", nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
