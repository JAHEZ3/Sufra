import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

export enum MovementType {
  // Purchased / received from supplier — adds to stock.
  IN = "in",
  // Consumed (used in a meal) or sold — subtracts from stock.
  OUT = "out",
  // Manual correction (waste, count fix, transfer). Signed quantity:
  // positive = adds, negative = subtracts.
  ADJUSTMENT = "adjustment",
}

/**
 * Append-only log of every change to an inventory item's quantity. The
 * item's current_quantity is the running sum derived from these rows
 * (kept materialized for fast reads, recomputed via service code).
 */
@Entity("inventory_movements")
@Index(["itemId", "createdAt"])
@Index(["restaurantId", "createdAt"])
export class InventoryMovement {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "item_id", type: "uuid" })
  itemId: string;

  @Index()
  @Column({ name: "restaurant_id", type: "uuid" })
  restaurantId: string;

  @Column({
    type: "enum",
    enum: MovementType,
    enumName: "inventory_movement_type",
  })
  type: MovementType;

  // Signed: positive for IN/positive-adjustment, negative for OUT/
  // negative-adjustment. Always recorded as the delta — easier to sum.
  @Column({ type: "numeric", precision: 12, scale: 3 })
  quantity: number;

  // Optional per-unit cost at the time of movement (for IN rows). Lets
  // the report compute landed cost accurately even if unit_cost on the
  // item changes later.
  @Column({
    name: "unit_cost",
    type: "numeric",
    precision: 12,
    scale: 2,
    nullable: true,
  })
  unitCost: number | null;

  @Column({ type: "text", nullable: true })
  note: string | null;

  @Column({ name: "created_by_user_id", type: "uuid", nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
