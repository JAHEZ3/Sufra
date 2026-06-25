import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";
import { PaymentInfo } from "../common/payment-info";

export enum RestaurantStatus {
  PENDING_APPROVAL = "pending_approval",
  ACTIVE = "active",
  SUSPENDED = "suspended",
  CLOSED = "closed",
}

export enum CuisineType {
  FAST_FOOD = "fast_food",
  SWEETS = "sweets",
  DRINKS = "drinks",
  KITCHEN = "kitchen",
  PIZZA = "pizza",
  SHAWARMA = "shawarma",
  GRILLS = "grills",
  SEAFOOD = "seafood",
  SANDWICHES = "sandwiches",
  BREAKFAST = "breakfast",
  HEALTHY = "healthy",
  ASIAN = "asian",
  OTHER = "other",
}

@Entity("restaurants")
@Index(["city", "status", "isOpen"])
export class Restaurant {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "owner_user_id", type: "uuid" })
  ownerUserId: string;

  @Column({ length: 200, nullable: true })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ name: "logo_url", type: "text", nullable: true })
  logoUrl: string;

  @Column({ name: "cover_url", type: "text", nullable: true })
  coverUrl: string;

  // Brand "main color" (#RRGGBB) chosen by the owner. Drives the accent on the
  // customer QR menu. Null → the app falls back to the default Sufra green.
  @Column({ name: "brand_color", length: 9, nullable: true })
  brandColor: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ name: "owner_name", length: 200, nullable: true })
  ownerName: string;

  @Column({ name: "owner_national_id_number", length: 50, nullable: true })
  ownerNationalIdNumber: string;

  @Column({ name: "commercial_reg_number", length: 50, nullable: true })
  commercialRegNumber: string;

  @Column({ name: "cuisine_type", nullable: true })
  cuisineType: string;

  
  @Column({ name: "payment_info", type: "jsonb", nullable: true })
  paymentInfo: PaymentInfo;

  @Column({ name: "terms_accepted", default: false })
  termsAccepted: boolean;

  @Column({ type: "text", nullable: true })
  street: string;

  @Index()
  @Column({ length: 100, nullable: true })
  city: string;

  @Column({ type: "numeric", precision: 9, scale: 6, nullable: true })
  lat: number;

  @Column({ type: "numeric", precision: 9, scale: 6, nullable: true })
  lng: number;

  @Column({
    name: "min_order_amount",
    type: "numeric",
    precision: 8,
    scale: 2,
    default: 0.0,
  })
  minOrderAmount: number;

  // Display currency for all amounts in the dashboard (SAR, ILS, USD, AED, EGP).
  @Column({ name: "currency_type", length: 8, default: "SAR" })
  currencyType: string;

  @Index()
  @Column({ type: "numeric", precision: 3, scale: 2, default: 0.0 })
  rating: number;

  @Column({ name: "total_ratings", default: 0 })
  totalRatings: number;

  @Index()
  @Column({
    type: "enum",
    enum: RestaurantStatus,
    enumName: "restaurant_status",
    default: RestaurantStatus.PENDING_APPROVAL,
  })
  status: RestaurantStatus;

  @Index()
  @Column({ name: "is_open", default: false })
  isOpen: boolean;

  @Index()
  @Column({ name: "is_Futarta", default: false })
  is_Futarta: boolean;

  // ─── Thermal printer config (LAN/IP — ESC/POS over TCP 9100) ───────────
  // Two printers: one in the kitchen for tickets (items only), one at the
  // cashier counter for priced receipts. Both optional — when unset, that
  // print target is silently skipped.

  @Column({ name: "kitchen_printer_ip", length: 64, nullable: true })
  kitchenPrinterIp: string | null;

  @Column({ name: "kitchen_printer_port", type: "int", default: 9100 })
  kitchenPrinterPort: number;

  @Column({ name: "cashier_printer_ip", length: 64, nullable: true })
  cashierPrinterIp: string | null;

  @Column({ name: "cashier_printer_port", type: "int", default: 9100 })
  cashierPrinterPort: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
