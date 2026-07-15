import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authFetch } from "../auth/auth-fetch";

export type AppCatalogEntry = {
  app_id: string;
  source_id: string | null;
  source_type: "manual" | "feed";
  trust_status: "dev" | "manual" | "unverified" | "verified" | "official" | "rejected";
  author_id: string | null;
  namespace: string | null;
  slug: string;
  app_name: string;
  app_version: string;
  summary: string | null;
  base_url: string;
  manifest_url: string;
  manifest_hash: string;
  manifest_version: string;
  license_required: boolean;
  license_issuer_url: string | null;
  metadata: Record<string, unknown>;
  deployment: {
    type?: string;
    service_name?: string;
    internal_base_url?: string;
    compose_project?: string;
    compose_file?: string;
    package_url?: string;
    package_sha256?: string;
    base_url?: string;
  } & Record<string, unknown>;
  published: boolean;
  publish_status: "draft" | "pending" | "published" | "rejected";
  published_at: string | null;
  published_by: string | null;
  publish_note: string | null;
  created_by: string | null;
  fetched_at: string;
  created_at: string;
  updated_at: string;
  installed: {
    slug: string;
    app_version: string | null;
    ui_url: string;
    enabled: boolean;
  } | null;
  license_state: {
    required: boolean;
    has_any_license: boolean;
    selected_active_license: string | null;
  };
  install_payload: {
    base_url: string;
    expected_manifest_hash: string;
  };
};

export type CreateCatalogEntryPayload = {
  base_url: string;
  summary?: string | null;
  trust_status?: "dev" | "manual" | "unverified";
};

export type SetCatalogEntryPublicationPayload = {
  appId: string;
  published: boolean;
  note?: string | null;
};

export type AppCatalogSource = {
  id: string;
  name: string;
  source_type: "manual" | "feed";
  feed_url: string | null;
  trust_mode: "dev" | "manual" | "verified" | "official";
  is_enabled: boolean;
  auto_refresh_enabled: boolean;
  last_sync_at: string | null;
  last_error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateCatalogSourcePayload = {
  name: string;
  feed_url: string;
  trust_mode?: AppCatalogSource["trust_mode"];
};

export type SyncCatalogSourceResponse = {
  source: AppCatalogSource;
  feed_url: string;
  fetched_at: string;
  total: number;
  imported: number;
  skipped: number;
  errors: Array<{ manifest_url: string; message: string }>;
  items: AppCatalogEntry[];
};

export type InstallCatalogEntryMode = "external" | "stage_only" | "compose";

export type CatalogDeploymentPlan = {
  app_id: string;
  mode: string;
  service_name: string;
  internal_base_url: string;
  compose_project: string;
  compose_file: string | null;
  package_url: string | null;
  package_sha256: string | null;
  published_ports_allowed: boolean;
  host_mounts_allowed: boolean;
  requires_approval: boolean;
};

export type AppRuntimeStartApproval = {
  confirmed: true;
  expected_manifest_sha256: string;
  expected_package_sha256: string;
  expected_deployment: {
    service_name: string;
    internal_base_url: string;
    package_url: string;
    compose_project: string;
    compose_file: string;
  };
};

export type InstallCatalogEntryResponse = {
  status: "installed" | "staged";
  app_id: string;
  install_mode?: InstallCatalogEntryMode;
  deployment_plan: CatalogDeploymentPlan;
};

export function useAppCatalogQuery(enabled = true) {
  return useQuery({
    queryKey: ["app-catalog"],
    queryFn: () => authFetch<{ items: AppCatalogEntry[] }>("/apps/catalog"),
    enabled,
  });
}

export function useCreateCatalogEntryFromManifestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateCatalogEntryPayload) =>
      authFetch<AppCatalogEntry>("/apps/catalog/entries/from-manifest", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["app-catalog"] });
    },
  });
}

export function useRefreshCatalogEntryFromInstalledMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (appId: string) =>
      authFetch<AppCatalogEntry>(`/apps/catalog/entries/${encodeURIComponent(appId)}/refresh-from-installed`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["app-catalog"] }),
        queryClient.invalidateQueries({ queryKey: ["installed-apps"] }),
      ]);
    },
  });
}

export function useAppCatalogSourcesQuery(enabled = true) {
  return useQuery({
    queryKey: ["app-catalog-sources"],
    queryFn: () => authFetch<{ items: AppCatalogSource[] }>("/apps/catalog/sources"),
    enabled,
  });
}

export function useCreateCatalogSourceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateCatalogSourcePayload) =>
      authFetch<AppCatalogSource>("/apps/catalog/sources", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["app-catalog-sources"] });
    },
  });
}

export function useSetCatalogSourceEnabledMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) =>
      authFetch<AppCatalogSource>(`/apps/catalog/sources/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ is_enabled: isEnabled }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["app-catalog-sources"] });
    },
  });
}

export function useSetCatalogSourceAutoRefreshMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, autoRefreshEnabled }: { id: string; autoRefreshEnabled: boolean }) =>
      authFetch<AppCatalogSource>(`/apps/catalog/sources/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ auto_refresh_enabled: autoRefreshEnabled }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["app-catalog-sources"] });
    },
  });
}

export function useSyncCatalogSourceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      authFetch<SyncCatalogSourceResponse>(`/apps/catalog/sources/${encodeURIComponent(id)}/sync`, {
        method: "POST",
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["app-catalog"] }),
        queryClient.invalidateQueries({ queryKey: ["app-catalog-sources"] }),
      ]);
    },
  });
}

export function useInstallCatalogEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      appId,
      mode,
      approval,
    }: {
      appId: string;
      mode: InstallCatalogEntryMode;
      approval?: AppRuntimeStartApproval;
    }) =>
      authFetch<InstallCatalogEntryResponse>(`/apps/catalog/entries/${encodeURIComponent(appId)}/install`, {
        method: "POST",
        body: JSON.stringify({ mode, approval }),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["app-catalog"] }),
        queryClient.invalidateQueries({ queryKey: ["installed-apps"] }),
        queryClient.invalidateQueries({ queryKey: ["app-registry"] }),
      ]);
    },
  });
}

export function useUpdateManagedAppRuntimeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ appId, approval }: { appId: string; approval: AppRuntimeStartApproval }) =>
      authFetch<InstallCatalogEntryResponse>(`/apps/installed/${encodeURIComponent(appId)}/runtime/update`, {
        method: "POST",
        body: JSON.stringify({ mode: "compose", approval }),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["app-catalog"] }),
        queryClient.invalidateQueries({ queryKey: ["installed-apps"] }),
        queryClient.invalidateQueries({ queryKey: ["app-registry"] }),
      ]);
    },
  });
}

export function useSetCatalogEntryPublicationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ appId, published, note }: SetCatalogEntryPublicationPayload) =>
      authFetch<AppCatalogEntry>(`/apps/catalog/entries/${encodeURIComponent(appId)}/publication`, {
        method: "PATCH",
        body: JSON.stringify({ published, note: note ?? null }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["app-catalog"] });
    },
  });
}

export function useDeleteCatalogEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (appId: string) =>
      authFetch<void>(`/apps/catalog/entries/${encodeURIComponent(appId)}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["app-catalog"] });
    },
  });
}
