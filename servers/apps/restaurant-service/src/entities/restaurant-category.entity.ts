import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('restaurant_categories')
export class RestaurantCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100, unique: true })
  name: string;

  @Column({ name: 'icon_url', type: 'text', nullable: true })
  iconUrl: string;
}
