import { Entity, PrimaryGeneratedColumn, Column, Index, OneToMany } from 'typeorm';
import { MealOption } from './meal-option.entity';

export enum MenuSelectionType {
  SINGLE = 'single',
  MULTIPLE = 'multiple',
}

@Entity('meal_option_groups')
export class MealOptionGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'meal_id', type: 'uuid' })
  mealId: string;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'selection_type', type: 'enum', enum: MenuSelectionType, enumName: 'menu_selection_type' })
  selectionType: MenuSelectionType;

  @Column({ name: 'is_required', default: false })
  isRequired: boolean;

  @Column({ name: 'max_selections', nullable: true })
  maxSelections: number;

  @OneToMany(() => MealOption, (option) => option.groupId)
  options: MealOption[];
}
