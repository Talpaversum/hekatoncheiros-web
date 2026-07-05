import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authFetch } from "../auth/auth-fetch";

export type InstalledApp = {
  app_id: string;
  slug: string;
  app_name?: string;
  base_url: string;
  app_version?: string;
  manifest_hash?: string;
  manifest_version?: string;
  fetched_at?: string;
  ui_url: string;
  ui_integrity: string;
  required_privileges: string[];
  nav_entries?: Array<{ label: string; path: string; required_privileges?: string[] }>;
  enabled?: boolean;
  catalog_update: {
    state: "available" | "same" | "stale" | "baseline_missing";
    update_available: boolean | null;
    app_version: string;
    manifest_hash: string;
    fetched_at: string;
    source_type: "manual" | "feed";
    trust_status: "dev" | "manual" | "unverified" | "verified" | "official" | "rejected";
  } | null;
  update_signal: {
    source: "app" | "feed" | "manual";
    app_version: string | null;
    manifest_hash: string | null;
    manifest_url: string | null;
    note: string | null;
    reported_at: string;
    update_available: boolean | null;
  } | null;
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

export type CheckInstalledAppUpdateResponse = {
  app_id: string;
  checked_at: string;
  update_available: boolean | null;
  installed: {
    app_version: string | null;
    manifest_hash: string | null;
    fetched_at: string | null;
  };
  fetched: {
    app_version: string;
    manifest_hash: string;
    fetched_at: string;
    fetched_from_url: string;
  };
};

export type IssueInstalledAppTokenResponse = {
  app_id: string;
  token_type: "Bearer";
  access_token: string;
  expires_at: string;
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
      await queryClient.invalidateQueries({ queryKey: ["app-catalog"] });
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
    onMutate: async (appId: string) => {
      await queryClient.cancelQueries({ queryKey: ["installed-apps"] });
      const previousInstalledApps = queryClient.getQueryData<{ items: InstalledApp[] }>(["installed-apps"]);

      if (previousInstalledApps) {
        queryClient.setQueryData<{ items: InstalledApp[] }>(["installed-apps"], {
          items: previousInstalledApps.items.filter((item) => item.app_id !== appId),
        });
      }

      return { previousInstalledApps };
    },
    onError: (error, appId, context) => {
      if (context?.previousInstalledApps) {
        queryClient.setQueryData(["installed-apps"], context.previousInstalledApps);
      }
      console.error("Uninstall failed", { appId, error });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["installed-apps"] });
      await queryClient.invalidateQueries({ queryKey: ["app-registry"] });
      await queryClient.invalidateQueries({ queryKey: ["app-catalog"] });
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["installed-apps"] });
      await queryClient.invalidateQueries({ queryKey: ["app-catalog"] });
    },
  });
}

export function useRefreshInstalledAppArtifactMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (appId: string) =>
      authFetch<{ status: string; app_id: string; refreshed_at: string }>(
        `/apps/installed/${encodeURIComponent(appId)}/refresh-artifact`,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["installed-apps"] });
      await queryClient.invalidateQueries({ queryKey: ["app-registry"] });
      await queryClient.invalidateQueries({ queryKey: ["app-catalog"] });
    },
  });
}

export function useCheckInstalledAppUpdateMutation() {
  return useMutation({
    mutationFn: (appId: string) =>
      authFetch<CheckInstalledAppUpdateResponse>(
        `/apps/installed/${encodeURIComponent(appId)}/check-update`,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      ),
  });
}

export function useIssueInstalledAppTokenMutation() {
  return useMutation({
    mutationFn: (appId: string) =>
      authFetch<IssueInstalledAppTokenResponse>(
        `/apps/installed/${encodeURIComponent(appId)}/app-token`,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      ),
  });
}

export function useClearInstalledAppUpdateSignalMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (appId: string) =>
      authFetch<void>(`/apps/installed/${encodeURIComponent(appId)}/update-signal`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["installed-apps"] });
    },
  });
}
