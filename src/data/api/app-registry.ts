import { useQuery } from "@tanstack/react-query";

import { authFetch } from "../auth/auth-fetch";

export type AppRegistryEntry = {
  app_id: string;
  slug: string;
  ui_url: string;
  nav_entries: Array<{
    label: string;
    path: string;
    required_privileges?: string[];
  }>;
};

export function useAppRegistryQuery(enabled = true) {
  return useQuery({
    queryKey: ["app-registry"],
    queryFn: () => authFetch<{ items: AppRegistryEntry[] }>("/apps/registry"),
    enabled,
  });
}
