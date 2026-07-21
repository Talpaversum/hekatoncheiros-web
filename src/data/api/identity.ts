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

export type TenantRole = {
  id: string;
  tenant_id: string;
  key: string;
  name: string;
  description: string;
  is_system: boolean;
  version: number;
  privileges: string[];
  member_count: number;
};

export type TenantMembership = {
  id: string;
  tenant_id: string;
  tenant_name: string;
  user_id: string;
  status: string;
  version: number;
  roles: TenantRole[];
  direct_privileges: string[];
  effective_privileges: string[];
  created_at: string;
  updated_at: string;
};

export type IdentityUser = {
  id: string;
  email: string;
  display_name: string | null;
  nickname: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  privileges: PrivilegeGrant[];
  memberships: TenantMembership[];
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
    mutationFn: (payload: { email: string; display_name?: string | null; nickname?: string | null; password: string; status: string; memberships?: { tenant_id: string; role_ids?: string[]; role_keys?: string[] }[] }) =>
      authFetch<IdentityUser>("/identity/users", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["identity-users"] });
    },
  });
}

export function useUpdateIdentityUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { id: string; email?: string; display_name?: string | null; nickname?: string | null; status?: string }) =>
      authFetch<IdentityUser>(`/identity/users/${encodeURIComponent(payload.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          email: payload.email,
          display_name: payload.display_name,
          nickname: payload.nickname,
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
    mutationFn: (payload: { name: string; primary_domain?: string | null; status: string; first_admin_user_id?: string | null }) =>
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

export function useTenantMembershipsQuery(enabled = true) {
  return useQuery({
    queryKey: ["tenant-memberships"],
    queryFn: () => authFetch<{ items: TenantMembership[] }>("/tenant/memberships"),
    enabled,
  });
}

export function useTenantUserDirectoryQuery(search: string) {
  return useQuery({
    queryKey: ["tenant-user-directory", search],
    queryFn: () => authFetch<{ items: IdentityUser[] }>(`/tenant/user-directory?search=${encodeURIComponent(search.trim())}`),
    enabled: search.trim().length >= 2,
  });
}

export function useTenantRolesQuery(enabled = true) {
  return useQuery({
    queryKey: ["tenant-roles"],
    queryFn: () => authFetch<{ items: TenantRole[] }>("/tenant/roles"),
    enabled,
  });
}

function useTenantRbacMutation<T>(mutationFn: (payload: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tenant-memberships"] }),
      queryClient.invalidateQueries({ queryKey: ["tenant-roles"] }),
      queryClient.invalidateQueries({ queryKey: ["tenant-users"] }),
      queryClient.invalidateQueries({ queryKey: ["identity-users"] }),
      queryClient.invalidateQueries({ queryKey: ["context"] }),
    ]);
  } });
}

export function useCreateTenantMembershipMutation() {
  return useTenantRbacMutation((payload: { user_id: string; role_ids?: string[] }) =>
    authFetch<TenantMembership>("/tenant/memberships", { method: "POST", body: JSON.stringify(payload) }));
}

export function useCreateTenantUserMutation() {
  return useTenantRbacMutation((payload: { email: string; display_name: string; nickname?: string | null; password: string; status: string; role_ids?: string[] }) =>
    authFetch<IdentityUser>("/tenant/users", { method: "POST", body: JSON.stringify(payload) }));
}

export function useUpdateTenantMembershipMutation() {
  return useTenantRbacMutation((payload: { id: string; status: "active" | "inactive"; version: number }) =>
    authFetch<TenantMembership>(`/tenant/memberships/${encodeURIComponent(payload.id)}`, {
      method: "PATCH", body: JSON.stringify({ status: payload.status, version: payload.version }),
    }));
}

export function useDeleteTenantMembershipMutation() {
  return useTenantRbacMutation((id: string) => authFetch<void>(`/tenant/memberships/${encodeURIComponent(id)}`, { method: "DELETE" }));
}

export function useAssignTenantMemberRoleMutation() {
  return useTenantRbacMutation((payload: { membership_id: string; role_id: string }) =>
    authFetch<void>(`/tenant/memberships/${encodeURIComponent(payload.membership_id)}/roles/${encodeURIComponent(payload.role_id)}`, { method: "POST" }));
}

export function useRemoveTenantMemberRoleMutation() {
  return useTenantRbacMutation((payload: { membership_id: string; role_id: string }) =>
    authFetch<void>(`/tenant/memberships/${encodeURIComponent(payload.membership_id)}/roles/${encodeURIComponent(payload.role_id)}`, { method: "DELETE" }));
}

export function useCreateTenantRoleMutation() {
  return useTenantRbacMutation((payload: { key: string; name: string; description: string; privileges: string[] }) =>
    authFetch<TenantRole>("/tenant/roles", { method: "POST", body: JSON.stringify(payload) }));
}

export function useDeleteTenantRoleMutation() {
  return useTenantRbacMutation((id: string) => authFetch<void>(`/tenant/roles/${encodeURIComponent(id)}`, { method: "DELETE" }));
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
