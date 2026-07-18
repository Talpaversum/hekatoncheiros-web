import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authFetch } from "../auth/auth-fetch";

export type SourceType = "github" | "gitlab" | "git" | "local_workspace" | "manifest" | "private_feed";
export type DeveloperProject = {
  project_id: string;
  tenant_id: string;
  created_by: string;
  display_name: string;
  origin_url: string | null;
  source_type: SourceType;
  manifest_url: string | null;
  feed_url: string | null;
  status: "draft" | "connectivity_failed" | "connectivity_ok" | "origin_trusted" | "source_invalid" | "source_valid" | "installed";
  connectivity_result_json: { reachable: boolean; status_code: number | null; latency_ms: number; error?: string } | null;
  manifest_result_json: { valid: boolean; errors: string[]; selected?: { app_id: string; app_name: string; base_url: string; manifest_url: string; manifest_hash: string; manifest?: Record<string, unknown> } | null } | null;
  trusted_origin_id: string | null;
  installed_app_id: string | null;
  source_connection_id: string | null;
  repository: string | null;
  workspace_path: string | null;
  branch: string | null;
  manifest_path: string | null;
  source_revision: string | null;
  validated_revision: string | null;
  deployed_revision: string | null;
  manifest_hash: string | null;
  runtime_type: "dockerfile" | "docker_compose" | "external_runtime" | "already_running_service";
  deployment_status: string;
  runtime_status: string;
  update_status: "up_to_date" | "update_available" | "validation_required" | "validation_failed" | "deployment_required" | "runtime_approval_required" | "deployment_failed";
  last_sync_at: string | null;
  last_validation_at: string | null;
  last_deployment_at: string | null;
  wizard_step: number;
  wizard_state_json: Record<string, unknown>;
  synced_manifest_json: Record<string, unknown> | null;
  pending_diff_json: DeveloperProjectDiff | null;
  created_at: string;
  updated_at: string;
};

export type DeveloperProjectInput = {
  display_name: string;
  origin_url: string;
  source_type: "manifest" | "private_feed";
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
export type DeveloperProjectDiff = { manifest: { changed: boolean; before_hash?: string | null; after_hash?: string | null }; runtime: { changed: boolean; before?: Record<string,unknown>|null; after?: Record<string,unknown>|null }; requires_runtime_approval?:boolean; [key:string]:unknown };

const projectKey = ["developer-projects"] as const;

export function useDeveloperProjects() {
  return useQuery({ queryKey: projectKey, queryFn: () => authFetch<{ items: DeveloperProject[] }>("/developer-projects") });
}

export function useDeveloperRuntimeStatus(projectId: string, enabled: boolean) {
  return useQuery({ queryKey: ["developer-project-runtime", projectId], queryFn: () => authFetch<DeveloperRuntimeStatus>(`/developer-projects/${encodeURIComponent(projectId)}/runtime-status`), enabled, refetchInterval: enabled ? 5_000 : false });
}
export function useDeveloperProjectDiff(projectId:string,enabled:boolean){return useQuery({queryKey:["developer-project-diff",projectId],queryFn:()=>authFetch<DeveloperProjectDiff>(`/developer-projects/${encodeURIComponent(projectId)}/diff`),enabled});}

export function useDeveloperProjectMutation<T>(action: (payload: T) => Promise<DeveloperProject>) {
  const client = useQueryClient();
  return useMutation({ mutationFn: action, onSuccess: async () => { await client.invalidateQueries({ queryKey: projectKey }); } });
}

export const developerProjectRequests = {
  createDraft: (input: { source_type: SourceType; display_name?: string }) => authFetch<DeveloperProject>("/developer-projects/drafts", { method: "POST", body: JSON.stringify(input) }),
  saveDraft: ({ projectId, input }: { projectId: string; input: { wizard_step: number; display_name?: string; origin_url?: string | null; source_connection_id?: string | null; repository?: string | null; workspace_path?: string | null; branch?: string | null; manifest_path?: string | null; manifest_url?: string | null; feed_url?: string | null; runtime_type?: DeveloperProject["runtime_type"]; wizard_state_json?: Record<string, unknown> } }) => authFetch<DeveloperProject>(`/developer-projects/${encodeURIComponent(projectId)}/draft`, { method: "PATCH", body: JSON.stringify(input) }),
  sync: (projectId:string)=>authFetch<DeveloperProject>(`/developer-projects/${encodeURIComponent(projectId)}/sync`,{method:"POST"}),
  create: (input: DeveloperProjectInput) => authFetch<DeveloperProject>("/developer-projects", { method: "POST", body: JSON.stringify(input) }),
  update: ({ projectId, input }: { projectId: string; input: DeveloperProjectInput }) => authFetch<DeveloperProject>(`/developer-projects/${encodeURIComponent(projectId)}`, { method: "PUT", body: JSON.stringify(input) }),
  testOrigin: (projectId: string) => authFetch<DeveloperProject>(`/developer-projects/${encodeURIComponent(projectId)}/test-origin`, { method: "POST" }),
  trustOrigin: (projectId: string) => authFetch<DeveloperProject>(`/developer-projects/${encodeURIComponent(projectId)}/trust-origin`, { method: "POST", body: JSON.stringify({ confirmed: true }) }),
  validateSource: (projectId: string) => authFetch<DeveloperProject>(`/developer-projects/${encodeURIComponent(projectId)}/validate-source`, { method: "POST" }),
  approveRuntime: (projectId: string) => authFetch<DeveloperProject>(`/developer-projects/${encodeURIComponent(projectId)}/approve-runtime`, { method: "POST", body: JSON.stringify({ confirmed: true }) }),
  install: (projectId: string) => authFetch<DeveloperProject>(`/developer-projects/${encodeURIComponent(projectId)}/install`, { method: "POST" }),
};
