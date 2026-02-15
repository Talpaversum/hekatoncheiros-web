import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authFetch } from "../auth/auth-fetch";

export type TrustedOrigin = {
  id: string;
  origin: string;
  is_enabled: boolean;
  note: string | null;
  created_at: string;
  created_by: string | null;
};

export function useTrustedOriginsQuery(enabled = true) {
  return useQuery({
    queryKey: ["trusted-origins"],
    queryFn: () => authFetch<{ items: TrustedOrigin[] }>("/platform/trusted-origins"),
    enabled,
  });
}

export function useCreateTrustedOriginMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { origin: string; note?: string | null }) =>
      authFetch<TrustedOrigin>("/platform/trusted-origins", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["trusted-origins"] });
    },
  });
}

export function useUpdateTrustedOriginMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; is_enabled?: boolean; note?: string | null }) =>
      authFetch<TrustedOrigin>(`/platform/trusted-origins/${encodeURIComponent(payload.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          is_enabled: payload.is_enabled,
          ...(Object.prototype.hasOwnProperty.call(payload, "note") ? { note: payload.note } : {}),
        }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["trusted-origins"] });
    },
  });
}

export function useDeleteTrustedOriginMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authFetch<void>(`/platform/trusted-origins/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["trusted-origins"] });
    },
  });
}
