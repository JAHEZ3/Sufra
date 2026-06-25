import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A customer's standalone rating of a restaurant (independent of any order).
 *
 * This table is the source of truth for the denormalised `restaurants.rating`
 * and `restaurants.total_ratings` columns: after every write we recompute the
 * aggregate from here (see RestaurantRatingsService), so the average is always
 * exactly AVG(rating) over the live rows — re-rating and future deletes stay
 * correct with no drift.
 *
 * One row per (restaurant, customer): re-rating updates the existing row rather
 * than inserting a duplicate, enforced by the unique constraint below.
 */
@Entity('restaurant_ratings')
@Unique('uq_restaurant_ratings_restaurant_user', ['restaurantId', 'userId'])
export class RestaurantRating {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'restaurant_id', type: 'uuid' })
  restaurantId: string; // FK → restaurants.id

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string; // customer sub from the JWT

  @Column({ type: 'smallint' })
  rating: number; // 1..5 (validated at the DTO layer)

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
