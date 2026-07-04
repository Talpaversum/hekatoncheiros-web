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
