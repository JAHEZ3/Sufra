import type { Restaurant } from "./restaurant.types";

export interface RestaurantHour {
  id: string;
  restaurantId: string;
  /** 0 = Sunday … 6 = Saturday (or backend convention). */
  dayOfWeek: number;
  /** "HH:mm" or "HH:mm:ss". */
  openTime: string;
  closeTime: string;
}

export type MealOptionSelectionType = "single" | "multiple";

export interface MealOption {
  id: string;
  groupId: string;
  name: string;
  extraPrice: number;
  isAvailable: boolean;
}

export interface MealOptionGroup {
  id: string;
  mealId: string;
  name: string;
  selectionType: MealOptionSelectionType;
  isRequired: boolean;
  maxSelections: number | null;
  options: MealOption[];
}

export interface Meal {
  id: string;
  sectionId: string;
  restaurantId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  basePrice: number;
  discountPrice: number | null;
  calories: number | null;
  isAvailable: boolean;
  isFeatured: boolean;
  tags: string[] | null;
  displayOrder: number;
  createdAt: string;
  optionGroups: MealOptionGroup[];
}

export interface MenuSection {
  id: string;
  menuId: string;
  name: string;
  displayOrder: number;
  meals: Meal[];
}

export interface Menu {
  id: string;
  restaurantId: string;
  name: string;
  isActive: boolean;
  displayOrder: number;
  sections: MenuSection[];
}

export interface RestaurantFull {
  restaurant: Restaurant;
  hours: RestaurantHour[];
  menus: Menu[];
}
