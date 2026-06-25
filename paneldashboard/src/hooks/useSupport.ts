"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supportApi, unwrapManager } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import type { Paginated } from "@/types/common.types";
import type {
  CreateSupportTicketPayload,
  ListSupportTicketsParams,
  SupportTicket,
  UpdateSupportTicketStatusPayload,
} from "@/types/support.types";

export function useCreateSupportTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateSupportTicketPayload) => {
      const res = await supportApi.create(payload);
      return unwrapManager<SupportTicket>(res.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.support.root }),
  });
}

export function useSupportTickets(params?: ListSupportTicketsParams) {
  return useQuery<Paginated<SupportTicket>>({
    queryKey: queryKeys.support.list(params),
    queryFn: async () => {
      const res = await supportApi.list(params);
      return unwrapManager<Paginated<SupportTicket>>(res.data);
    },
  });
}

export function useUpdateSupportTicketStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateSupportTicketStatusPayload;
    }) => {
      const res = await supportApi.updateStatus(id, payload);
      return unwrapManager<SupportTicket>(res.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.support.root }),
  });
}
