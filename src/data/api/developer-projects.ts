import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authFetch } from "../auth/auth-fetch";

export type SourceType = "manifest" | "feed";
export type DeveloperProject = {
  project_id: string;
  tenant_id: string;
  created_by: string;
  display_name: string;
  origin_url: string;
  source_type: SourceType;
  manifest_url: string | null;
  feed_url: string | null;
  status: "draft" | "connectivity_failed" | "connectivity_ok" | "origin_trusted" | "source_invalid" | "source_valid" | "installed";
  connectivity_result_json: { reachable: boolean; status_code: number | null; latency_ms: number; error?: string } | null;
  manifest_result_json: { valid: boolean; errors: string[]; selected?: { app_id: string; app_name: string; base_url: string; manifest_url: string; manifest_hash: string; manifest?: Record<string, unknown> } | null } | null;
  trusted_origin_id: string | null;
  installed_app_id: string | null;
  created_at: string;
  updated_at: string;
};

export type DeveloperProjectInput = {
  display_name: string;
  origin_url: string;
  source_type: SourceType;
  manifest_url: string | null;
  feed_url: string | null;
};

export type DeveloperRuntimeStatus = {
  app_id: string;
  slug: string;
  ui_url: string;
  open_url: string;
  local: true;
  trust_status: "unverified";
  runtime: { status: string; last_checked_at: string | null; message: string | null };
};

const projectKey = ["developer-projects"] as const;

export function useDeveloperProjects() {
  return useQuery({ queryKey: projectKey, queryFn: () => authFetch<{ items: DeveloperProject[] }>("/developer-projects") });
}

export function useDeveloperRuntimeStatus(projectId: string, enabled: boolean) {
  return useQuery({ queryKey: ["developer-project-runtime", projectId], queryFn: () => authFetch<DeveloperRuntimeStatus>(`/developer-projects/${encodeURIComponent(projectId)}/runtime-status`), enabled, refetchInterval: enabled ? 5_000 : false });
}

export function useDeveloperProjectMutation<T>(action: (payload: T) => Promise<DeveloperProject>) {
  const client = useQueryClient();
  return useMutation({ mutationFn: action, onSuccess: async () => { await client.invalidateQueries({ queryKey: projectKey }); } });
}

export const developerProjectRequests = {
  create: (input: DeveloperProjectInput) => authFetch<DeveloperProject>("/developer-projects", { method: "POST", body: JSON.stringify(input) }),
  update: ({ projectId, input }: { projectId: string; input: DeveloperProjectInput }) => authFetch<DeveloperProject>(`/developer-projects/${encodeURIComponent(projectId)}`, { method: "PUT", body: JSON.stringify(input) }),
  testOrigin: (projectId: string) => authFetch<DeveloperProject>(`/developer-projects/${encodeURIComponent(projectId)}/test-origin`, { method: "POST" }),
  trustOrigin: (projectId: string) => authFetch<DeveloperProject>(`/developer-projects/${encodeURIComponent(projectId)}/trust-origin`, { method: "POST", body: JSON.stringify({ confirmed: true }) }),
  validateSource: (projectId: string) => authFetch<DeveloperProject>(`/developer-projects/${encodeURIComponent(projectId)}/validate-source`, { method: "POST" }),
  install: (projectId: string) => authFetch<DeveloperProject>(`/developer-projects/${encodeURIComponent(projectId)}/install`, { method: "POST" }),
};
