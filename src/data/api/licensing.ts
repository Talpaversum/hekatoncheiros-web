import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authFetch } from "../auth/auth-fetch";

export type EntitlementItem = {
  id: string;
  tenant_id: string;
  app_id: string;
  source: string;
  tier: string;
  valid_from: string;
  valid_to: string;
  limits: Record<string, unknown>;
  status: string;
  created_at: string;
  updated_at: string;
};

export type AppEntitlementsResponse = {
  app_id: string;
  selected_entitlement_id: string | null;
  items: EntitlementItem[];
};

export function useAppEntitlementsQuery(appId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["licensing-entitlements", appId],
    queryFn: () => authFetch<AppEntitlementsResponse>(`/licensing/entitlements?app_id=${encodeURIComponent(appId ?? "")}`),
    enabled: enabled && Boolean(appId),
  });
}

export function useSetSelectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { app_id: string; entitlement_id: string }) =>
      authFetch<void>("/licensing/selection", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["licensing-entitlements", variables.app_id] });
      await queryClient.invalidateQueries({ queryKey: ["installed-apps"] });
      await queryClient.invalidateQueries({ queryKey: ["app-registry"] });
    },
  });
}

export function useClearSelectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { app_id: string }) =>
      authFetch<void>("/licensing/selection/clear", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["licensing-entitlements", variables.app_id] });
      await queryClient.invalidateQueries({ queryKey: ["installed-apps"] });
      await queryClient.invalidateQueries({ queryKey: ["app-registry"] });
    },
  });
}

export function useOfflineIngestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { token: string }) =>
      authFetch<{ status: string; verification_result: string }>("/licensing/offline", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["installed-apps"] });
      await queryClient.invalidateQueries({ queryKey: ["app-registry"] });
      await queryClient.invalidateQueries({ queryKey: ["licensing-entitlements"] });
    },
  });
}
