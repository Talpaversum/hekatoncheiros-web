import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authFetch } from "../auth/auth-fetch";

export type TenantSettings = {
  id: string;
  name: string;
  primary_domain: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type PlatformInstanceSettings = {
  instance_id: string;
  name: string;
  public_base_url: string | null;
  updated_at: string;
};

export function useTenantSettingsQuery(enabled = true) {
  return useQuery({
    queryKey: ["tenant-settings"],
    queryFn: () => authFetch<TenantSettings>("/tenant"),
    enabled,
  });
}

export function useUpdateTenantSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { name?: string; primary_domain?: string | null }) =>
      authFetch<TenantSettings>("/tenant", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tenant-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["context"] }),
      ]);
    },
  });
}

export function usePlatformInstanceSettingsQuery(enabled = true) {
  return useQuery({
    queryKey: ["platform-instance-settings"],
    queryFn: () => authFetch<PlatformInstanceSettings>("/platform/instance"),
    enabled,
  });
}

export function useUpdatePlatformInstanceSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { name?: string; public_base_url?: string | null }) =>
      authFetch<PlatformInstanceSettings>("/platform/instance", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["platform-instance-settings"] });
    },
  });
}
