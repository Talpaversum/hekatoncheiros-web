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
};

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
