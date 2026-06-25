import { Entity, PrimaryColumn, Index } from 'typeorm';

@Entity('restaurant_category_map')
export class RestaurantCategoryMap {
  @PrimaryColumn({ name: 'restaurant_id', type: 'uuid' })
  restaurantId: string;

  @Index()
  @PrimaryColumn({ name: 'category_id', type: 'uuid' })
  categoryId: string;
}
