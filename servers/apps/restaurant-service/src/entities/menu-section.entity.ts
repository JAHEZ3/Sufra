import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('menu_sections')
export class MenuSection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'menu_id', type: 'uuid' })
  menuId: string;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'display_order', default: 0 })
  displayOrder: number;
}
