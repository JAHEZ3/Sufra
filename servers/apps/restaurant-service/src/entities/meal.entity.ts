import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('meals')
export class Meal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'section_id', type: 'uuid' })
  sectionId: string;

  @Index()
  @Column({ name: 'restaurant_id', type: 'uuid' })
  restaurantId: string;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl: string;

  @Column({ name: 'base_price', type: 'numeric', precision: 8, scale: 2 })
  basePrice: number;

  @Column({ name: 'discount_price', type: 'numeric', precision: 8, scale: 2, nullable: true })
  discountPrice: number;

  @Column({ nullable: true })
  calories: number;

  @Column({ name: 'is_available', default: true })
  isAvailable: boolean;

  @Column({ name: 'is_featured', default: false })
  isFeatured: boolean;

  @Column({ type: 'text', array: true, nullable: true })
  tags: string[];

  @Column({ name: 'display_order', default: 0 })
  displayOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
