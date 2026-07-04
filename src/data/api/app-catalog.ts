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
    base_url?: string;
  } & Record<string, unknown>;
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

export type InstallCatalogEntryMode = "external" | "stage_only" | "compose";

export type CatalogDeploymentPlan = {
  app_id: string;
  mode: string;
  service_name: string;
  internal_base_url: string;
  compose_project: string;
  compose_file: string | null;
  published_ports_allowed: boolean;
  host_mounts_allowed: boolean;
  requires_approval: boolean;
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

export function useInstallCatalogEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ appId, mode }: { appId: string; mode: InstallCatalogEntryMode }) =>
      authFetch<InstallCatalogEntryResponse>(`/apps/catalog/entries/${encodeURIComponent(appId)}/install`, {
        method: "POST",
        body: JSON.stringify({ mode }),
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
