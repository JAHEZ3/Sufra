import { Entity, PrimaryGeneratedColumn, Column, Index, Unique } from 'typeorm';

@Entity('restaurant_hours')
@Unique(['restaurantId', 'dayOfWeek'])
export class RestaurantHour {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'restaurant_id', type: 'uuid' })
  restaurantId: string;

  @Column({ name: 'day_of_week', type: 'smallint' })
  dayOfWeek: number;

  @Column({ name: 'open_time', type: 'time' })
  openTime: string;

  @Column({ name: 'close_time', type: 'time' })
  closeTime: string;
}
