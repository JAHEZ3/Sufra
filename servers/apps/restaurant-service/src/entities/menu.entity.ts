import { Entity, PrimaryGeneratedColumn, Column, Index, OneToMany } from 'typeorm';
import { MenuSection } from './menu-section.entity';

@Entity('menus')
export class Menu {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'restaurant_id', type: 'uuid' })
  restaurantId: string;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'display_order', default: 0 })
  displayOrder: number;

  @OneToMany(() => MenuSection, (section) => section.menuId)
  sections: MenuSection[];
}
