export enum MenuSelectionType {
  SINGLE = "single",
  MULTIPLE = "multiple",
}

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
  selectionType: MenuSelectionType;
  isRequired: boolean;
  maxSelections: number | null;
  options?: MealOption[];
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
  optionGroups?: MealOptionGroup[];
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

// ── AI Smart Menu Import ─────────────────────────────────────────────────────
export type MenuLanguage = "ar" | "en" | "mixed" | "unknown";

export interface ExtractedSize {
  label: string;
  price?: number | null;
}

export interface ExtractedItem {
  name: string;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
  sizes?: ExtractedSize[];
}

export interface ExtractedCategory {
  name: string;
  items: ExtractedItem[];
}

export interface ExtractedOffer {
  name: string;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
  items?: string[];
}

export interface MenuExtraction {
  restaurantName: string | null;
  language: MenuLanguage;
  currency: string | null;
  categories: ExtractedCategory[];
  offers: ExtractedOffer[];
}

export interface MenuImportResult {
  createdMenu: boolean;
  menuId: string;
  sectionsCreated: number;
  mealsCreated: number;
  optionGroupsCreated: number;
  optionsCreated: number;
}

export interface TopSellingMeal {
  mealId: string;
  mealName: string;
  imageUrl: string | null;
  totalOrders: number;
  revenue: number;
  percentageOfTotal: number;
}
