"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { unwrap, usersApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import type {
  ChangeUserStatusPayload,
  ListUsersParams,
  UpdateUserPayload,
} from "@/types/user.types";

export function useUsers(params?: ListUsersParams) {
  return useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => usersApi.list(params).then(unwrap),
  });
}

export function useUser(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.users.detail(id ?? ""),
    queryFn: () => usersApi.getOne(id as string).then(unwrap),
    enabled: !!id,
  });
}

export function useUpdateUser(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateUserPayload) =>
      usersApi.update(id, payload).then(unwrap),
    onSuccess: (user) => {
      qc.setQueryData(queryKeys.users.detail(id), user);
      qc.invalidateQueries({ queryKey: queryKeys.users.root });
    },
  });
}

export function useChangeUserStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ChangeUserStatusPayload) =>
      usersApi.changeStatus(id, payload).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.users.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.users.root });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.delete(id).then(unwrap),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: queryKeys.users.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.users.root });
    },
  });
}
