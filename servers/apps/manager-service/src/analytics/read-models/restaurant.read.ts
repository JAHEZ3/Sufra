import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum RestaurantStatus {
  PENDING_APPROVAL = 'pending_approval',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  CLOSED = 'closed',
}

export enum CuisineType {
  FAST_FOOD = 'fast_food',
  SWEETS = 'sweets',
  DRINKS = 'drinks',
  KITCHEN = 'kitchen',
  PIZZA = 'pizza',
  SHAWARMA = 'shawarma',
  GRILLS = 'grills',
  SEAFOOD = 'seafood',
  SANDWICHES = 'sandwiches',
  BREAKFAST = 'breakfast',
  HEALTHY = 'healthy',
  ASIAN = 'asian',
  OTHER = 'other',
}

@Entity({ name: 'restaurants', synchronize: false })
export class RestaurantRead {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ length: 200, nullable: true })
  name: string;

  @Column({ length: 100, nullable: true })
  city: string;

  @Column({ name: 'cuisine_type', type: 'enum', enum: CuisineType, enumName: 'cuisine_type', nullable: true })
  cuisineType: CuisineType;

  @Column({ type: 'numeric', precision: 3, scale: 2 })
  rating: string;

  @Column({ name: 'total_ratings' })
  totalRatings: number;

  @Index()
  @Column({ type: 'enum', enum: RestaurantStatus, enumName: 'restaurant_status' })
  status: RestaurantStatus;

  @Column({ name: 'is_open' })
  isOpen: boolean;

  @Column({ type: 'numeric', precision: 9, scale: 6, nullable: true })
  lat: string | null;

  @Column({ type: 'numeric', precision: 9, scale: 6, nullable: true })
  lng: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
