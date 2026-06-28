"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deliveryApi, unwrap } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import type {
  ChangeAgentStatusPayload,
  ListAgentsParams,
  RejectAgentApplicationPayload,
  UpdateAgentPayload,
} from "@/types/delivery.types";

// ─── Applications ────────────────────────────────────────────────────────────

export function useDeliveryApplications() {
  return useQuery({
    queryKey: queryKeys.deliveryAgents.applications,
    queryFn: () => deliveryApi.listApplications().then(unwrap),
  });
}

export function useApproveDeliveryApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deliveryApi.approveApplication(id).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.deliveryAgents.applications });
      qc.invalidateQueries({ queryKey: queryKeys.deliveryAgents.root });
    },
  });
}

export function useRejectDeliveryApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: RejectAgentApplicationPayload;
    }) => deliveryApi.rejectApplication(id, payload).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.deliveryAgents.applications });
    },
  });
}

// ─── Agents ──────────────────────────────────────────────────────────────────

export function useDeliveryAgents(params?: ListAgentsParams) {
  return useQuery({
    queryKey: queryKeys.deliveryAgents.list(params),
    queryFn: () => deliveryApi.list(params).then(unwrap),
  });
}

export function useDeliveryAgent(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.deliveryAgents.detail(id ?? ""),
    queryFn: () => deliveryApi.getOne(id as string).then(unwrap),
    enabled: !!id,
  });
}

export function useUpdateDeliveryAgent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateAgentPayload) =>
      deliveryApi.update(id, payload).then(unwrap),
    onSuccess: (agent) => {
      qc.setQueryData(queryKeys.deliveryAgents.detail(id), agent);
      qc.invalidateQueries({ queryKey: queryKeys.deliveryAgents.root });
    },
  });
}

export function useChangeDeliveryAgentStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ChangeAgentStatusPayload) =>
      deliveryApi.changeStatus(id, payload).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.deliveryAgents.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.deliveryAgents.root });
    },
  });
}

export function useDeleteDeliveryAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deliveryApi.delete(id).then(unwrap),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: queryKeys.deliveryAgents.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.deliveryAgents.root });
    },
  });
}
