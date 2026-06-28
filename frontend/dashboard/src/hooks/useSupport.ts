"use client";

import { useMutation } from "@tanstack/react-query";
import { supportApi, unwrapManager } from "@/lib/api";
import type {
  CreateSupportTicketPayload,
  SupportTicket,
} from "@/types/support.types";

export function useCreateSupportTicket() {
  return useMutation({
    mutationFn: async (payload: CreateSupportTicketPayload) => {
      const res = await supportApi.create(payload);
      return unwrapManager<SupportTicket>(res.data);
    },
  });
}
