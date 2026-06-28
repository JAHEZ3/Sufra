"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  menuApi,
  mealsApi,
  optionGroupsApi,
  optionsApi,
  aiMenuImportApi,
} from "@/lib/api";
import { queryKeys, queryClient } from "@/lib/queryClient";
import type {
  Menu,
  MenuSection,
  Meal,
  MealOptionGroup,
  MealOption,
  MenuExtraction,
  MenuImportResult,
} from "@/types/menu.types";
import type {
  CreateMenuDto,
  UpdateMenuDto,
  CreateMenuSectionDto,
  UpdateMenuSectionDto,
  CreateMealDto,
  UpdateMealDto,
  CreateOptionGroupDto,
  UpdateOptionGroupDto,
  CreateOptionDto,
  UpdateOptionDto,
} from "@/dto/meal.dto";

// Backend wraps every response in `{ data, message }`. Unwrap once.
function unwrap<T>(res: { data: { data?: T } | T }): T {
  const payload = res.data as { data?: T } | T;
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data?: T }).data as T;
  }
  return payload as T;
}

// ── Menu tree ────────────────────────────────────────────────────────────────
// The backend exposes /menus, /menus/:id/sections, and /sections/:id/meals
// separately. The UI expects a tree, so we compose it client-side.
export function useMenu() {
  return useQuery<Menu[]>({
    queryKey: queryKeys.menu.all,
    queryFn: async () => {
      const menus = unwrap<Menu[]>(await menuApi.listMenus()) ?? [];

      const withSections = await Promise.all(
        menus.map(async (menu) => {
          const sections =
            unwrap<MenuSection[]>(await menuApi.listSections(menu.id)) ?? [];
          const sectionsWithMeals = await Promise.all(
            sections.map(async (section) => {
              const meals =
                unwrap<Meal[]>(await mealsApi.list(section.id)) ?? [];
              return { ...section, meals };
            }),
          );
          return { ...menu, sections: sectionsWithMeals };
        }),
      );

      return withSections;
    },
  });
}

const invalidateMenu = () =>
  queryClient.invalidateQueries({ queryKey: queryKeys.menu.all });

// ── Menus ────────────────────────────────────────────────────────────────────
export function useCreateMenu() {
  return useMutation({
    mutationFn: (data: CreateMenuDto) => menuApi.createMenu(data),
    onSuccess: invalidateMenu,
  });
}

export function useUpdateMenu() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMenuDto }) =>
      menuApi.updateMenu(id, data),
    onSuccess: invalidateMenu,
  });
}

export function useDeleteMenu() {
  return useMutation({
    mutationFn: (id: string) => menuApi.deleteMenu(id),
    onSuccess: invalidateMenu,
  });
}

export function useReorderMenus() {
  return useMutation({
    mutationFn: (orderedIds: string[]) => menuApi.reorderMenus(orderedIds),
    onSuccess: invalidateMenu,
  });
}

// ── Sections ────────────────────────────────────────────────────────────────
// menuId goes in the URL, NOT the body — backend rejects extra body keys.
export function useCreateSection() {
  return useMutation({
    mutationFn: ({
      menuId,
      data,
    }: {
      menuId: string;
      data: CreateMenuSectionDto;
    }) => menuApi.createSection(menuId, data),
    onSuccess: invalidateMenu,
  });
}

export function useUpdateSection() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMenuSectionDto }) =>
      menuApi.updateSection(id, data),
    onSuccess: invalidateMenu,
  });
}

export function useDeleteSection() {
  return useMutation({
    mutationFn: (id: string) => menuApi.deleteSection(id),
    onSuccess: invalidateMenu,
  });
}

export function useReorderSections() {
  return useMutation({
    mutationFn: ({
      menuId,
      orderedIds,
    }: {
      menuId: string;
      orderedIds: string[];
    }) => menuApi.reorderSections(menuId, orderedIds),
    onSuccess: invalidateMenu,
  });
}

// ── Meals ───────────────────────────────────────────────────────────────────
// Backend POST/PATCH /meals are multipart, so callers may pass FormData when
// uploading an image. Plain DTO is still accepted for non-image updates.
export function useCreateMeal() {
  return useMutation({
    mutationFn: (data: CreateMealDto | FormData) => mealsApi.create(data),
    onSuccess: invalidateMenu,
  });
}

export function useUpdateMeal() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMealDto | FormData }) =>
      mealsApi.update(id, data),
    onSuccess: invalidateMenu,
  });
}

export function useDeleteMeal() {
  return useMutation({
    mutationFn: (id: string) => mealsApi.delete(id),
    onSuccess: invalidateMenu,
  });
}

// Backend flips the flag server-side; caller only passes the id.
export function useToggleMealAvailability() {
  return useMutation({
    mutationFn: (id: string) => mealsApi.toggleAvailability(id),
    onSuccess: invalidateMenu,
  });
}

export function useGenerateMealAiImage() {
  return useMutation({
    mutationFn: (mealId: string) => mealsApi.generateAiImage(mealId),
    onSuccess: invalidateMenu,
  });
}

export function useReorderMeals() {
  return useMutation({
    mutationFn: ({
      sectionId,
      orderedIds,
    }: {
      sectionId: string;
      orderedIds: string[];
    }) => mealsApi.reorder(sectionId, orderedIds),
    onSuccess: invalidateMenu,
  });
}

// ── Option groups ───────────────────────────────────────────────────────────
export function useOptionGroups(mealId: string | undefined) {
  return useQuery<MealOptionGroup[]>({
    queryKey: queryKeys.menu.optionGroups(mealId ?? ""),
    queryFn: async () =>
      unwrap<MealOptionGroup[]>(await optionGroupsApi.list(mealId!)) ?? [],
    enabled: Boolean(mealId),
  });
}

export function useCreateOptionGroup() {
  return useMutation({
    mutationFn: ({
      mealId,
      data,
    }: {
      mealId: string;
      data: CreateOptionGroupDto;
    }) => optionGroupsApi.create(mealId, data),
    onSuccess: (_res, vars) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.menu.optionGroups(vars.mealId),
      }),
  });
}

export function useUpdateOptionGroup(mealId?: string) {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOptionGroupDto }) =>
      optionGroupsApi.update(id, data),
    onSuccess: () => {
      if (mealId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.menu.optionGroups(mealId),
        });
      }
    },
  });
}

export function useDeleteOptionGroup(mealId?: string) {
  return useMutation({
    mutationFn: (id: string) => optionGroupsApi.delete(id),
    onSuccess: () => {
      if (mealId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.menu.optionGroups(mealId),
        });
      }
    },
  });
}

// ── Options ─────────────────────────────────────────────────────────────────
export function useOptions(groupId: string | undefined) {
  return useQuery<MealOption[]>({
    queryKey: queryKeys.menu.options(groupId ?? ""),
    queryFn: async () =>
      unwrap<MealOption[]>(await optionsApi.list(groupId!)) ?? [],
    enabled: Boolean(groupId),
  });
}

export function useCreateOption() {
  return useMutation({
    mutationFn: ({
      groupId,
      data,
    }: {
      groupId: string;
      data: CreateOptionDto;
    }) => optionsApi.create(groupId, data),
    onSuccess: (_res, vars) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.menu.options(vars.groupId),
      }),
  });
}

export function useUpdateOption(groupId?: string) {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOptionDto }) =>
      optionsApi.update(id, data),
    onSuccess: () => {
      if (groupId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.menu.options(groupId),
        });
      }
    },
  });
}

export function useDeleteOption(groupId?: string) {
  return useMutation({
    mutationFn: (id: string) => optionsApi.delete(id),
    onSuccess: () => {
      if (groupId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.menu.options(groupId),
        });
      }
    },
  });
}

// ── AI Smart Menu Import ────────────────────────────────────────────────────
export function useAnalyzeMenuImage() {
  return useMutation({
    mutationFn: async (image: File) => {
      const res = await aiMenuImportApi.analyze(image);
      return unwrap<MenuExtraction>(res);
    },
  });
}

export function useApplyMenuImport() {
  return useMutation({
    mutationFn: async (data: {
      targetMenuId?: string;
      menuName?: string;
      extraction: MenuExtraction;
    }) => {
      const res = await aiMenuImportApi.apply(data);
      return unwrap<MenuImportResult>(res);
    },
    onSuccess: invalidateMenu,
  });
}
