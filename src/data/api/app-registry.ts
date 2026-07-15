import { useQuery } from "@tanstack/react-query";

import { authFetch } from "../auth/auth-fetch";

export type AppRegistryEntry = {
  app_id: string;
  app_name?: string;
  slug: string;
  ui_url: string;
  localization: {
    contract_version: number;
    default_locale: string;
    supported_locales: string[];
    resources: Array<{ locale: string; path: string; format: string }>;
  };
  nav_entries: Array<{
    label: string;
    path: string;
    required_privileges?: string[];
  }>;
  help_entries?: Array<{
    title: string;
    summary: string;
    outcome?: string;
    category?: string;
    steps: string[];
    path: string;
    required_privileges?: string[];
  }>;
  runtime: { status: "unknown" | "starting" | "healthy" | "degraded" | "unreachable" | "stopped"; last_checked_at: string | null; last_healthy_at: string | null; status_changed_at: string; consecutive_failures: number; message: string | null };
};

export function useAppRegistryQuery(enabled = true) {
  return useQuery({
    queryKey: ["app-registry"],
    queryFn: () => authFetch<{ items: AppRegistryEntry[] }>("/apps/registry"),
    enabled,
    refetchInterval: enabled ? 5000 : false,
  });
}
