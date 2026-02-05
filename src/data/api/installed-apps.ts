import { useQuery } from "@tanstack/react-query";

import { authFetch } from "../auth/auth-fetch";

export type InstalledApp = {
  app_id: string;
  base_url: string;
  ui_url: string;
  required_privileges: string[];
  manifest: Record<string, unknown>;
};

export function useInstalledAppsQuery(enabled = true) {
  return useQuery({
    queryKey: ["installed-apps"],
    queryFn: () => authFetch<{ items: InstalledApp[] }>("/apps/installed"),
    enabled,
  });
}
