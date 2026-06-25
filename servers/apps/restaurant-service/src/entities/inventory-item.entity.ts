import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export enum InventoryUnit {
  KG       = "kg",       // كيلوغرام
  GRAM     = "g",        // غرام
  LITER    = "l",        // لتر
  ML       = "ml",       // مل
  PIECE    = "piece",    // قطعة
  BOX      = "box",      // صندوق
  PACK     = "pack",     // عبوة
  BOTTLE   = "bottle",   // زجاجة
  DOZEN    = "dozen",    // دزينة
  BAG      = "bag",      // كيس
}

/**
 * A stocked item the restaurant tracks (ingredient, packaging, supply).
 * Quantity is the live on-hand count; movements log every change.
 */
@Entity("inventory_items")
@Index(["restaurantId", "name"])
@Index(["restaurantId", "sku"], { unique: true, where: '"sku" IS NOT NULL' })
export class InventoryItem {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "restaurant_id", type: "uuid" })
  restaurantId: string;

  @Column({ length: 200 })
  name: string;

  // Stock-keeping unit — optional, but useful for scanning / supplier sync.
  @Column({ length: 50, nullable: true })
  sku: string | null;

  @Column({
    type: "enum",
    enum: InventoryUnit,
    enumName: "inventory_unit",
    default: InventoryUnit.PIECE,
  })
  unit: InventoryUnit;

  // Current on-hand quantity. Decimal so half-kg etc. work cleanly.
  @Column({
    name: "current_quantity",
    type: "numeric",
    precision: 12,
    scale: 3,
    default: 0,
  })
  currentQuantity: number;

  // Alert threshold: low-stock when currentQuantity <= reorderThreshold.
  // Zero means alerts are off for this item.
  @Column({
    name: "reorder_threshold",
    type: "numeric",
    precision: 12,
    scale: 3,
    default: 0,
  })
  reorderThreshold: number;

  // Cost per unit (last-known). Used for stock-value reporting.
  @Column({
    name: "unit_cost",
    type: "numeric",
    precision: 12,
    scale: 2,
    default: 0,
  })
  unitCost: number;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
