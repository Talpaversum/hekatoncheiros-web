import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authFetch } from "../auth/auth-fetch";

export type PublicJwks = { keys: Array<Record<string, unknown>> };

export type AuthorOnboarding = {
  author_id: string;
  display_name: string;
  public_jwks_json: PublicJwks;
  author_cert_jws: string;
  root_kid: string | null;
  registry_url: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AuthorRegistryTrust = {
  registry_url: string;
  root_jwks_json: PublicJwks;
  revocations_json: unknown[] | Record<string, unknown>;
  synced_at: string;
  synced_by: string | null;
  trust_anchor_json?: { registry_id?: string; fingerprint?: string; trust_policy_version?: number };
};

export type RegistryAuthor = { author_id: string; display_name: string; status: string; active_keys: number; certificate_expires_at: string | null; created_at: string };
export type RegistryAuthorDetail = RegistryAuthor & {
  verification_notes: string;
  keys: Array<{ kid: string; created_at: string; disabled_at: string | null; revoked_at: string | null }>;
  certificates: Array<{ id: string; root_kid: string | null; not_before: string; not_after: string; status: string; revoked_at: string | null }>;
};
export type RegistryDashboard = { registered_authors: number; pending_requests: number; expiring_certificates: number; revocations: number; trust_anchor: { registry_id: string; fingerprint: string; trust_policy_version: number } };

type IssuedAuthorCertificate = {
  author_id?: string;
  display_name?: string;
  author_cert_jws: string;
  root_kid: string;
};

export function useAuthorsQuery(enabled = true) {
  return useQuery({
    queryKey: ["platform-authors"],
    queryFn: () => authFetch<{ items: AuthorOnboarding[] }>("/platform/authors"),
    enabled,
  });
}

export function useAuthorRegistryTrustQuery(enabled = true) {
  return useQuery({
    queryKey: ["author-registry-trust"],
    queryFn: () => authFetch<AuthorRegistryTrust>("/platform/author-registry/trust"),
    enabled,
    retry: false,
  });
}

export function useOnboardAuthorMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { display_name: string; jwks: PublicJwks; cert_ttl_days: number }) =>
      authFetch<IssuedAuthorCertificate & { author_id: string; display_name: string }>("/platform/authors/onboard", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["platform-authors"] }),
  });
}

export function useRotateAuthorKeysMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { authorId: string; jwks: PublicJwks; cert_ttl_days: number }) =>
      authFetch<IssuedAuthorCertificate>(`/platform/authors/${encodeURIComponent(payload.authorId)}/keys`, {
        method: "POST",
        body: JSON.stringify({ jwks: payload.jwks, cert_ttl_days: payload.cert_ttl_days }),
      }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["platform-authors"] }),
  });
}

export function useSyncAuthorRegistryTrustMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authFetch<AuthorRegistryTrust>("/platform/author-registry/sync-trust", { method: "POST" }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["author-registry-trust"] }),
  });
}

export function useRegistryDashboardQuery(enabled = true) {
  return useQuery({ queryKey: ["author-registry-dashboard"], queryFn: () => authFetch<RegistryDashboard>("/platform/author-registry/dashboard"), enabled, retry: false });
}

export function useRegistryAuthorsQuery(enabled = true) {
  return useQuery({ queryKey: ["author-registry-authors"], queryFn: () => authFetch<{ items: RegistryAuthor[] }>("/platform/author-registry/authors"), enabled, retry: false });
}

export function useRegistryAuditQuery(enabled = true) {
  return useQuery({ queryKey: ["author-registry-audit"], queryFn: () => authFetch<{ items: Array<Record<string, unknown>> }>("/platform/author-registry/audit"), enabled, retry: false });
}

export function useRegistryAuthorActionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { authorId: string; action: "approve" | "suspend" | "revoke"; reason?: string }) =>
      authFetch(`/platform/author-registry/authors/${encodeURIComponent(payload.authorId)}/action`, { method: "POST", body: JSON.stringify({ action: payload.action, reason: payload.reason }) }),
    onSuccess: async () => Promise.all([queryClient.invalidateQueries({ queryKey: ["author-registry-authors"] }), queryClient.invalidateQueries({ queryKey: ["author-registry-dashboard"] }), queryClient.invalidateQueries({ queryKey: ["author-registry-audit"] })]),
  });
}

export function useRegistryAuthorDetailQuery(authorId: string | null) {
  return useQuery({ queryKey: ["author-registry-author", authorId], queryFn: () => authFetch<RegistryAuthorDetail>(`/platform/author-registry/authors/${encodeURIComponent(authorId ?? "")}`), enabled: Boolean(authorId), retry: false });
}

export function useRegistryLifecycleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { path: string; method?: "POST" | "DELETE"; body?: unknown }) => authFetch(payload.path, { method: payload.method ?? "POST", body: payload.body === undefined ? undefined : JSON.stringify(payload.body) }),
    onSuccess: async () => Promise.all([queryClient.invalidateQueries({ queryKey: ["author-registry-authors"] }), queryClient.invalidateQueries({ queryKey: ["author-registry-author"] }), queryClient.invalidateQueries({ queryKey: ["author-registry-dashboard"] }), queryClient.invalidateQueries({ queryKey: ["author-registry-audit"] })]),
  });
}
