import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authFetch } from "../auth/auth-fetch";

export type PrivilegeScope = "platform" | "tenant";

export type PrivilegeDefinition = {
  id: string;
  label: string;
  description: string;
  scope: PrivilegeScope;
};

export type PrivilegeGrant = {
  privilege: string;
  tenant_id: string | null;
};

export type IdentityUser = {
  id: string;
  email: string;
  display_name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  privileges: PrivilegeGrant[];
};

export type IdentityTenant = {
  id: string;
  name: string;
  primary_domain: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export function usePrivilegeCatalogQuery(enabled = true) {
  return useQuery({
    queryKey: ["privilege-catalog"],
    queryFn: () => authFetch<{ items: PrivilegeDefinition[] }>("/rbac/privileges"),
    enabled,
  });
}

export function useIdentityUsersQuery(enabled = true) {
  return useQuery({
    queryKey: ["identity-users"],
    queryFn: () => authFetch<{ items: IdentityUser[] }>("/identity/users"),
    enabled,
  });
}

export function useCreateIdentityUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { id: string; email: string; display_name?: string | null; password: string; status: string }) =>
      authFetch<IdentityUser>("/identity/users", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["identity-users"] });
    },
  });
}

export function useUpdateIdentityUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { id: string; email?: string; display_name?: string | null; status?: string }) =>
      authFetch<IdentityUser>(`/identity/users/${encodeURIComponent(payload.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          email: payload.email,
          display_name: payload.display_name,
          status: payload.status,
        }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["identity-users"] });
    },
  });
}

export function useResetIdentityUserPasswordMutation() {
  return useMutation({
    mutationFn: (payload: { id: string; password: string }) =>
      authFetch<void>(`/identity/users/${encodeURIComponent(payload.id)}/password`, {
        method: "POST",
        body: JSON.stringify({ password: payload.password }),
      }),
  });
}

export function useReplaceIdentityUserPrivilegesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { id: string; grants: PrivilegeGrant[] }) =>
      authFetch<{ user_id: string; grants: PrivilegeGrant[] }>(`/identity/users/${encodeURIComponent(payload.id)}/privileges`, {
        method: "PUT",
        body: JSON.stringify({ grants: payload.grants }),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["identity-users"] }),
        queryClient.invalidateQueries({ queryKey: ["tenant-users"] }),
        queryClient.invalidateQueries({ queryKey: ["context"] }),
      ]);
    },
  });
}

export function useIdentityTenantsQuery(enabled = true) {
  return useQuery({
    queryKey: ["identity-tenants"],
    queryFn: () => authFetch<{ items: IdentityTenant[] }>("/identity/tenants"),
    enabled,
  });
}

export function useCreateIdentityTenantMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { id: string; name: string; primary_domain?: string | null; status: string }) =>
      authFetch<IdentityTenant>("/identity/tenants", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["identity-tenants"] }),
        queryClient.invalidateQueries({ queryKey: ["context"] }),
      ]);
    },
  });
}

export function useUpdateIdentityTenantMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { id: string; name?: string; primary_domain?: string | null; status?: string }) =>
      authFetch<IdentityTenant>(`/identity/tenants/${encodeURIComponent(payload.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: payload.name,
          primary_domain: payload.primary_domain,
          status: payload.status,
        }),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["identity-tenants"] }),
        queryClient.invalidateQueries({ queryKey: ["tenant-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["context"] }),
      ]);
    },
  });
}

export function useTenantUsersQuery(enabled = true) {
  return useQuery({
    queryKey: ["tenant-users"],
    queryFn: () => authFetch<{ items: IdentityUser[] }>("/tenant/users"),
    enabled,
  });
}

export function useReplaceTenantUserPrivilegesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { id: string; grants: PrivilegeGrant[] }) =>
      authFetch<{ user_id: string; grants: PrivilegeGrant[] }>(`/tenant/users/${encodeURIComponent(payload.id)}/privileges`, {
        method: "PUT",
        body: JSON.stringify({ grants: payload.grants }),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tenant-users"] }),
        queryClient.invalidateQueries({ queryKey: ["identity-users"] }),
      ]);
    },
  });
}
