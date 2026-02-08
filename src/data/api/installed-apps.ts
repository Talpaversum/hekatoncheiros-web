import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authFetch } from "../auth/auth-fetch";

export type InstalledApp = {
  app_id: string;
  slug: string;
  app_name?: string;
  base_url: string;
  ui_url: string;
  ui_integrity: string;
  required_privileges: string[];
  nav_entries?: Array<{ label: string; path: string; required_privileges?: string[] }>;
  enabled?: boolean;
  licensed: boolean;
  manifest: Record<string, unknown>;
};

export type InstallAppPayload = {
  app_id: string;
  base_url: string;
  manifest: Record<string, unknown>;
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
