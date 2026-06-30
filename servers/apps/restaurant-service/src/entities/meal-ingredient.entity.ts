import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * A single line of a meal's recipe (bill-of-materials): how much of one
 * inventory item is consumed to make one unit of the meal. e.g. a shawarma
 * meal might have two lines — 150 (g) chicken and 1 (piece) bread.
 *
 * The quantity is expressed in the inventory item's own unit, so no unit is
 * stored here. When a POS bill is paid the order-service multiplies each line
 * by the sold quantity and writes an OUT movement against the linked item.
 */
@Entity("meal_ingredients")
@Index(["mealId", "inventoryItemId"], { unique: true })
@Index(["restaurantId"])
export class MealIngredient {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "meal_id", type: "uuid" })
  mealId: string;

  @Index()
  @Column({ name: "inventory_item_id", type: "uuid" })
  inventoryItemId: string;

  // Denormalized for fast restaurant-scoped queries and ownership checks.
  @Column({ name: "restaurant_id", type: "uuid" })
  restaurantId: string;

  // Amount of the inventory item used per 1 unit of the meal, in the item's
  // own unit (g, piece, ml, ...). Decimal so 0.150 kg / 1.5 pieces work.
  @Column({ type: "numeric", precision: 12, scale: 3 })
  quantity: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
