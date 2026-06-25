import type { MenuSelectionType } from "@/types/menu.types";

// ── Menus ────────────────────────────────────────────────────────────────────
export interface CreateMenuDto {
  name: string;
  isActive?: boolean;
  displayOrder?: number;
}

export interface UpdateMenuDto {
  name?: string;
  isActive?: boolean;
  displayOrder?: number;
}

// ── Sections ────────────────────────────────────────────────────────────────
// Backend takes menuId via URL path, NOT body — so no menuId here.
export interface CreateMenuSectionDto {
  name: string;
  displayOrder?: number;
}

export interface UpdateMenuSectionDto {
  name?: string;
  displayOrder?: number;
}

// ── Meals ────────────────────────────────────────────────────────────────────
export interface CreateMealDto {
  sectionId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  basePrice: number;
  discountPrice?: number;
  calories?: number;
  isAvailable?: boolean;
  isFeatured?: boolean;
  tags?: string[];
  displayOrder?: number;
}

export interface UpdateMealDto {
  sectionId?: string;
  name?: string;
  description?: string;
  imageUrl?: string;
  basePrice?: number;
  discountPrice?: number;
  calories?: number;
  isAvailable?: boolean;
  isFeatured?: boolean;
  tags?: string[];
  displayOrder?: number;
}

// ── Option groups ────────────────────────────────────────────────────────────
export interface CreateOptionGroupDto {
  name: string;
  selectionType: MenuSelectionType;
  isRequired?: boolean;
  maxSelections?: number;
}

export interface UpdateOptionGroupDto {
  name?: string;
  selectionType?: MenuSelectionType;
  isRequired?: boolean;
  maxSelections?: number;
}

// ── Options ──────────────────────────────────────────────────────────────────
export interface CreateOptionDto {
  name: string;
  extraPrice?: number;
  isAvailable?: boolean;
}

export interface UpdateOptionDto {
  name?: string;
  extraPrice?: number;
  isAvailable?: boolean;
}
