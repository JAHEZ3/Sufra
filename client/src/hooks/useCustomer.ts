"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customerClient } from "@/lib/axios";

export interface CustomerAddress {
  id: string;
  label: string | null;
  street: string;
  city: string | null;
  lat: number;
  lng: number;
  isDefault: boolean;
  createdAt: string;
}

export interface CustomerProfile {
  id: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  dateOfBirth: string | null;
  locationLat: number | null;
  locationLng: number | null;
  profileCompleted: boolean;
  avatarUrl: string | null;
  defaultAddressId: string | null;
  walletBalance: number;
  addresses?: CustomerAddress[];
}

export interface AddressInput {
  label?: string;
  street: string;
  city?: string;
  lat: number;
  lng: number;
  isDefault?: boolean;
}

function unwrap<T>(payload: unknown): T {
  const root = payload as { data?: T } | T;
  if (root && typeof root === "object" && "data" in root) {
    return (root as { data?: T }).data as T;
  }
  return root as T;
}

const KEYS = {
  profile: ["customer", "profile"] as const,
  addresses: ["customer", "addresses"] as const,
};

export function useCustomerProfile() {
  return useQuery({
    queryKey: KEYS.profile,
    queryFn: async () => {
      const res = await customerClient.get("/api/customer/profile");
      return unwrap<CustomerProfile>(res.data);
    },
    retry: false,
  });
}

export function useUpdateCustomerProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: {
      firstName?: string;
      lastName?: string;
      dateOfBirth?: string;
      locationLat?: number;
      locationLng?: number;
    }) => {
      const form = new FormData();
      Object.entries(dto).forEach(([k, v]) => {
        if (v !== undefined && v !== null) form.append(k, String(v));
      });
      const res = await customerClient.patch("/api/customer/profile", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return unwrap<CustomerProfile>(res.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.profile }),
  });
}

export function useAddresses() {
  return useQuery({
    queryKey: KEYS.addresses,
    queryFn: async () => {
      const res = await customerClient.get("/api/customer/addresses");
      return unwrap<CustomerAddress[]>(res.data);
    },
    retry: false,
  });
}

export function useCreateAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: AddressInput) => {
      const res = await customerClient.post("/api/customer/addresses", dto);
      return unwrap<CustomerAddress>(res.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.addresses }),
  });
}

export function useUpdateAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: Partial<AddressInput> }) => {
      const res = await customerClient.patch(`/api/customer/addresses/${id}`, dto);
      return unwrap<CustomerAddress>(res.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.addresses }),
  });
}

export function useSetDefaultAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await customerClient.patch(`/api/customer/addresses/${id}/default`);
      return unwrap<CustomerAddress>(res.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.addresses }),
  });
}

export function useDeleteAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await customerClient.delete(`/api/customer/addresses/${id}`);
      return { id };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.addresses }),
  });
}
