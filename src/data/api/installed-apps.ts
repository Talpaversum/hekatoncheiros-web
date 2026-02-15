import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authFetch } from "../auth/auth-fetch";

export type InstalledApp = {
  app_id: string;
  slug: string;
  app_name?: string;
  base_url: string;
  app_version?: string;
  manifest_version?: string;
  fetched_at?: string;
  ui_url: string;
  ui_integrity: string;
  required_privileges: string[];
  nav_entries?: Array<{ label: string; path: string; required_privileges?: string[] }>;
  enabled?: boolean;
  resolved_entitlement:
    | {
        entitlement_id: string;
        tenant_id: string;
        app_id: string;
        source: string;
        tier: string;
        valid_from: string;
        valid_to: string;
        limits: Record<string, unknown>;
      }
    | null;
  has_any_entitlement: boolean;
  manifest: Record<string, unknown>;
};

export type InstallAppPayload = {
  base_url: string;
  expected_manifest_hash: string;
};

export type FetchManifestPayload = {
  base_url: string;
};

export type FetchManifestResponse = {
  normalized_base_url: string;
  fetched_from_url: string;
  fetched_at: string;
  manifest: Record<string, unknown>;
  manifest_hash: string;
  manifest_version: string;
  app_id: string;
  app_version: string;
  slug: string | null;
};

export function useInstalledAppsQuery(enabled = true) {
  return useQuery({
    queryKey: ["installed-apps"],
    queryFn: () => authFetch<{ items: InstalledApp[] }>("/apps/installed"),
    enabled,
  });
}

export function useInstallAppMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: InstallAppPayload) =>
      authFetch<{ status: string; app_id: string }>("/apps/installed", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["installed-apps"] });
      await queryClient.invalidateQueries({ queryKey: ["app-registry"] });
    },
  });
}

export function useFetchInstallManifestMutation() {
  return useMutation({
    mutationFn: (payload: FetchManifestPayload) =>
      authFetch<FetchManifestResponse>("/apps/installed/fetch-manifest", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  });
}

export function useUninstallAppMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (appId: string) =>
      authFetch<void>(`/apps/installed/${encodeURIComponent(appId)}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["installed-apps"] });
      await queryClient.invalidateQueries({ queryKey: ["app-registry"] });
    },
  });
}
