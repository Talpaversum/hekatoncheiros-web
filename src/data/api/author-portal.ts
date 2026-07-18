import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authFetch } from "../auth/auth-fetch";

export type AuthorMode =
  | "talpaversum_hosted"
  | "trusted_self_hosted";
export type AuthorRequest = { request_id: string; requested_display_name: string; legal_name: string | null; contact_email: string; website: string | null; git_provider_profile: string | null; description: string; operating_mode: AuthorMode; intended_distribution: string; terms_accepted: boolean; public_jwks_json?: { keys: Record<string, unknown>[] } | null; external_issuer_url?: string | null; status: string; review_notes: string | null; author_id: string | null; created_at: string };
export type AuthorProfile = { author_id: string; display_name: string; operating_mode: AuthorMode; registry_status: string; status: string; role: string; permissions_json: string[]; external_issuer_url?: string | null };
export type AuthorApp = { author_app_id: string; author_id: string; app_id: string | null; display_name: string; repository_full_name: string | null; repository_visibility: string | null; branch: string | null; manifest_path: string | null; manifest_json?: Record<string, unknown> | null; manifest_errors_json: string[]; status: string; runtime_management: string; licensing_management: string; operating_mode?: AuthorMode; member_permissions_json?: string[] };
export type GitConnection = { connection_id: string; author_id: string; provider: string; account_login: string; status: string; last_verified_at: string | null; created_at: string };
export type GitRepository = { id: number; full_name: string; visibility: "public" | "private"; default_branch: string; html_url: string; accessible: boolean };
export type CatalogSubmission = { submission_id: string; author_app_id: string; author_id: string; app_id?: string | null; display_name?: string; operating_mode?: AuthorMode; status: string; eligibility_json: Record<string, boolean>; review_notes: string | null; created_at: string };
export type ActivityEvent = { event_id: string; author_id: string | null; action: string; from_status: string | null; to_status: string | null; metadata_json: Record<string, unknown>; created_at: string };
export type AuthorMember = { author_id: string; user_id: string; email: string; role: string; permissions_json: string[]; status: string; created_at: string };
export type InstanceCapabilities = Record<"privateAppDevelopment" | "trustedOrigins" | "privateCatalogs" | "officialAuthorOnboarding" | "officialAuthorRegistry" | "officialCatalogPublishing" | "officialCatalogReview" | "hostedAuthorServices" | "hostedBuilds" | "hostedRuntime" | "hostedLicensing" | "externalTrustedAuthorPublishing", { enabled: boolean; configured: boolean; available: boolean; reason?: string; url?: string }>;

const invalidate = (client: ReturnType<typeof useQueryClient>) => Promise.all([
  client.invalidateQueries({ queryKey: ["author-portal"] }), client.invalidateQueries({ queryKey: ["author-requests-admin"] }),
  client.invalidateQueries({ queryKey: ["author-git"] }), client.invalidateQueries({ queryKey: ["author-apps"] }),
  client.invalidateQueries({ queryKey: ["author-catalog"] }), client.invalidateQueries({ queryKey: ["author-activity"] }),
  client.invalidateQueries({ queryKey: ["author-members"] }),
]);

export function useAuthorOverview() { return useQuery({ queryKey: ["author-portal"], queryFn: () => authFetch<{ requests: AuthorRequest[]; profiles: AuthorProfile[]; apps: AuthorApp[]; submissions: CatalogSubmission[]; operator: boolean; capabilities: { author_review: boolean; catalog_review: boolean; runtime_review: boolean; instance: InstanceCapabilities } }>("/author-portal/overview") }); }
export function useAdminAuthorRequests(enabled: boolean) { return useQuery({ queryKey: ["author-requests-admin"], queryFn: () => authFetch<{ items: AuthorRequest[] }>("/author-portal/admin/requests"), enabled }); }
const activeAuthor = () => localStorage.getItem("hc.activeAuthorId") ?? "";
export function useGitConnections(authorId = activeAuthor()) { return useQuery({ queryKey: ["author-git", authorId], queryFn: () => authFetch<{ items: GitConnection[] }>(`/author-portal/git-connections${authorId ? `?author_id=${encodeURIComponent(authorId)}` : ""}`) }); }
export function useAuthorApps(scope: "workspace" | "registry" = "workspace", authorId = scope === "workspace" ? activeAuthor() : "") { return useQuery({ queryKey: ["author-apps", scope, authorId], queryFn: () => authFetch<{ items: AuthorApp[] }>(`/author-portal/apps?scope=${scope}${authorId ? `&author_id=${encodeURIComponent(authorId)}` : ""}`) }); }
export function useCatalogSubmissions(scope: "workspace" | "registry" = "workspace", authorId = scope === "workspace" ? activeAuthor() : "") { return useQuery({ queryKey: ["author-catalog", scope, authorId], queryFn: () => authFetch<{ items: CatalogSubmission[]; operator: boolean }>(`/author-portal/catalog-submissions?scope=${scope}${authorId ? `&author_id=${encodeURIComponent(authorId)}` : ""}`) }); }
export function useAuthorActivity(authorId = activeAuthor()) { return useQuery({ queryKey: ["author-activity", authorId], queryFn: () => authFetch<{ items: ActivityEvent[] }>(`/author-portal/activity${authorId ? `?author_id=${encodeURIComponent(authorId)}` : ""}`) }); }
export function useGitRepositories(connectionId: string) { return useQuery({ queryKey: ["author-git-repos", connectionId], queryFn: () => authFetch<{ items: GitRepository[] }>(`/author-portal/git-connections/${encodeURIComponent(connectionId)}/repositories`), enabled: Boolean(connectionId), retry: false }); }
export function useAuthorMembers(authorId: string) { return useQuery({ queryKey: ["author-members", authorId], queryFn: () => authFetch<{ items: AuthorMember[] }>(`/author-portal/profiles/${encodeURIComponent(authorId)}/members`), enabled: Boolean(authorId), retry: false }); }

export function useAuthorPortalMutation<T>(request: (payload: T) => Promise<unknown>) {
  const client = useQueryClient(); return useMutation({ mutationFn: request, onSuccess: () => invalidate(client) });
}

export const authorPortalRequests = {
  createRequest: (payload: Record<string, unknown>) => authFetch<AuthorRequest>("/author-portal/requests", { method: "POST", body: JSON.stringify(payload) }),
  updateRequest: (payload: { requestId: string; values: Record<string, unknown> }) => authFetch<AuthorRequest>(`/author-portal/requests/${encodeURIComponent(payload.requestId)}`, { method: "PUT", body: JSON.stringify(payload.values) }),
  submitRequest: (requestId: string) => authFetch<AuthorRequest>(`/author-portal/requests/${encodeURIComponent(requestId)}/submit`, { method: "POST" }),
  reviewRequest: (payload: { requestId: string; action: string; notes?: string }) => authFetch<AuthorRequest>(`/author-portal/admin/requests/${encodeURIComponent(payload.requestId)}/action`, { method: "POST", body: JSON.stringify({ action: payload.action, notes: payload.notes }) }),
  saveMember: (payload: { authorId: string; user_id: string; role: string }) => authFetch<AuthorMember>(`/author-portal/profiles/${encodeURIComponent(payload.authorId)}/members`, { method: "PUT", body: JSON.stringify({ user_id: payload.user_id, role: payload.role }) }),
  connectGitHub: (payload: { author_id: string; token: string }) => authFetch<GitConnection>("/author-portal/git-connections/github", { method: "POST", body: JSON.stringify(payload) }),
  disconnectGit: (connectionId: string) => authFetch<void>(`/author-portal/git-connections/${encodeURIComponent(connectionId)}`, { method: "DELETE" }),
  inspectRepository: (payload: { connection_id: string; repository: string; branch: string; manifest_path: string }) => authFetch<{ manifest: Record<string, unknown> | null; errors: string[]; status: string }>("/author-portal/repositories/inspect", { method: "POST", body: JSON.stringify(payload) }),
  createApp: (payload: { author_id: string; connection_id: string; repository: string; branch: string; manifest_path: string }) => authFetch<AuthorApp>("/author-portal/apps/from-git", { method: "POST", body: JSON.stringify(payload) }),
  appAction: (payload: { appId: string; action: string; notes?: string }) => authFetch<AuthorApp>(`/author-portal/apps/${encodeURIComponent(payload.appId)}/action`, { method: "POST", body: JSON.stringify({ action: payload.action, notes: payload.notes }) }),
  submitCatalog: (appId: string) => authFetch<CatalogSubmission>(`/author-portal/apps/${encodeURIComponent(appId)}/catalog-submission`, { method: "POST" }),
  reviewCatalog: (payload: { submissionId: string; action: string; notes?: string }) => authFetch<CatalogSubmission>(`/author-portal/admin/catalog-submissions/${encodeURIComponent(payload.submissionId)}/action`, { method: "POST", body: JSON.stringify({ action: payload.action, notes: payload.notes }) }),
};
