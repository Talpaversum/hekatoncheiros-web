import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authFetch } from "../auth/auth-fetch";

export type TenantLicenseItem = {
  id: string;
  tenant_id: string;
  author_id: string;
  app_id: string;
  jti: string;
  license_mode: "portable" | "instance_bound";
  audience: string[];
  license_jws: string;
  author_cert_jws?: string | null;
  author_kid?: string | null;
  status: string;
  valid_from: string | null;
  valid_to: string | null;
  created_at: string;
  updated_at: string;
};

export type TenantLicensesResponse = {
  app_id: string | null;
  selected_license_jti: string | null;
  items: TenantLicenseItem[];
};

export type LicenseValidationResponse = {
  valid: boolean;
  chain_verified: boolean;
  status: string;
  claims: Record<string, unknown> | null;
  errors: string[];
};

export function usePlatformInstanceIdQuery(tenantId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["platform-instance-id", tenantId],
    queryFn: () => authFetch<{ platform_instance_id: string }>(`/platform/instance-id`),
    enabled: enabled && Boolean(tenantId),
  });
}

export function useTenantLicensesQuery(tenantId: string | null, appId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["tenant-licenses", tenantId, appId],
    queryFn: () =>
      authFetch<TenantLicensesResponse>(
        `/tenants/${encodeURIComponent(tenantId ?? "")}/licenses${appId ? `?app_id=${encodeURIComponent(appId)}` : ""}`,
      ),
    enabled: enabled && Boolean(tenantId),
  });
}

export function useValidateLicenseMutation(tenantId: string | null) {
  return useMutation({
    mutationFn: (payload: { license_jws: string; author_cert_jws?: string; bundle?: Record<string, unknown> }) =>
      authFetch<LicenseValidationResponse>(`/tenants/${encodeURIComponent(tenantId ?? "")}/licenses/validate`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  });
}

export function useImportLicenseMutation(tenantId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { license_jws: string; author_cert_jws?: string; bundle?: Record<string, unknown> }) =>
      authFetch<{ status: string; item: TenantLicenseItem }>(
        `/tenants/${encodeURIComponent(tenantId ?? "")}/licenses/import`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      ),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["tenant-licenses", tenantId] });
      await queryClient.invalidateQueries({ queryKey: ["installed-apps"] });
      await queryClient.invalidateQueries({ queryKey: ["app-registry"] });
      await queryClient.invalidateQueries({ queryKey: ["tenant-licenses", tenantId, response.item.app_id] });
    },
  });
}

export function useSelectLicenseMutation(tenantId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { app_id: string; license_jti: string }) =>
      authFetch<void>(`/tenants/${encodeURIComponent(tenantId ?? "")}/licenses/select`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["tenant-licenses", tenantId, variables.app_id] });
      await queryClient.invalidateQueries({ queryKey: ["installed-apps"] });
      await queryClient.invalidateQueries({ queryKey: ["app-registry"] });
    },
  });
}

export function useClearLicenseSelectionMutation(tenantId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { app_id: string }) =>
      authFetch<void>(`/tenants/${encodeURIComponent(tenantId ?? "")}/licenses/selection/clear`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["tenant-licenses", tenantId, variables.app_id] });
      await queryClient.invalidateQueries({ queryKey: ["installed-apps"] });
      await queryClient.invalidateQueries({ queryKey: ["app-registry"] });
    },
  });
}

export function useStartLicenseOAuthMutation(tenantId: string | null) {
  return useMutation({
    mutationFn: (payload: {
      issuer: string;
      app_id: string;
      license_mode: "portable" | "instance_bound";
      auto_select?: boolean;
    }) =>
      authFetch<{ status: string; redirect_url: string; state: string }>(
        `/tenants/${encodeURIComponent(tenantId ?? "")}/licenses/oauth/start?issuer=${encodeURIComponent(payload.issuer)}&app_id=${encodeURIComponent(payload.app_id)}&license_mode=${encodeURIComponent(payload.license_mode)}&auto_select=${payload.auto_select ? "true" : "false"}`,
      ),
  });
}

export function useHandleLicenseOAuthCallbackMutation(tenantId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { code: string; state: string }) =>
      authFetch<{ status: string; auto_selected: boolean; item: TenantLicenseItem }>(
        `/tenants/${encodeURIComponent(tenantId ?? "")}/licenses/oauth/callback?code=${encodeURIComponent(payload.code)}&state=${encodeURIComponent(payload.state)}`,
      ),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["tenant-licenses", tenantId] });
      await queryClient.invalidateQueries({ queryKey: ["tenant-licenses", tenantId, response.item.app_id] });
      await queryClient.invalidateQueries({ queryKey: ["installed-apps"] });
      await queryClient.invalidateQueries({ queryKey: ["app-registry"] });
    },
  });
}

// Legacy compatibility for existing UI components
export type EntitlementItem = {
  id: string;
  tenant_id: string;
  app_id: string;
  source: string;
  tier: string;
  valid_from: string;
  valid_to: string;
  limits: Record<string, unknown>;
  status: string;
  created_at: string;
  updated_at: string;
};

export type AppEntitlementsResponse = {
  app_id: string;
  selected_entitlement_id: string | null;
  items: EntitlementItem[];
};

export function useAppEntitlementsQuery(appId: string | null, enabled = true) {
  const tenantId = "tnt_default";
  return useQuery({
    queryKey: ["licensing-entitlements", appId],
    queryFn: async () => {
      const response = await authFetch<TenantLicensesResponse>(
        `/tenants/${encodeURIComponent(tenantId)}/licenses?app_id=${encodeURIComponent(appId ?? "")}`,
      );
      return {
        app_id: response.app_id ?? appId ?? "",
        selected_entitlement_id: response.selected_license_jti,
        items: response.items.map((item) => ({
          id: item.jti,
          tenant_id: item.tenant_id,
          app_id: item.app_id,
          source: "LICENSE",
          tier: "licensed",
          valid_from: item.valid_from ?? item.created_at,
          valid_to: item.valid_to ?? item.updated_at,
          limits: {},
          status: item.status,
          created_at: item.created_at,
          updated_at: item.updated_at,
        })),
      } satisfies AppEntitlementsResponse;
    },
    enabled: enabled && Boolean(appId),
  });
}

export function useSetSelectionMutation() {
  return useSelectLicenseMutation("tnt_default") as ReturnType<typeof useSelectLicenseMutation>;
}

export function useClearSelectionMutation() {
  return useClearLicenseSelectionMutation("tnt_default") as ReturnType<typeof useClearLicenseSelectionMutation>;
}

export function useOfflineIngestMutation() {
  const importMutation = useImportLicenseMutation("tnt_default");
  return useMutation({
    mutationFn: async (payload: { token: string }) => {
      const imported = await importMutation.mutateAsync({ license_jws: payload.token });
      return {
        status: imported.status,
        verification_result: imported.item.status,
      };
    },
  });
}
