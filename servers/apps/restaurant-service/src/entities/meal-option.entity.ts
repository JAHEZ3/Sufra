import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('meal_options')
export class MealOption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'group_id', type: 'uuid' })
  groupId: string;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'extra_price', type: 'numeric', precision: 8, scale: 2, default: 0.00 })
  extraPrice: number;

  @Column({ name: 'is_available', default: true })
  isAvailable: boolean;
}
