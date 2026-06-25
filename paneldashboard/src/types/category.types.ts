export interface RestaurantCategory {
  id: string;
  name: string;
  iconUrl: string | null;
}

export interface CreateCategoryPayload {
  name: string;
  iconUrl?: string;
}

export interface UpdateCategoryPayload {
  name?: string;
  iconUrl?: string | null;
}
