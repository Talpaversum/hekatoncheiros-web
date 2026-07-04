import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authFetch } from "../auth/auth-fetch";

export type AccountProfile = {
  id: string;
  email: string;
  display_name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export function useAccountQuery(enabled = true) {
  return useQuery({
    queryKey: ["account"],
    queryFn: () => authFetch<AccountProfile>("/account"),
    enabled,
  });
}

export function useUpdateAccountMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { email?: string; display_name?: string | null }) =>
      authFetch<AccountProfile>("/account", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["account"] }),
        queryClient.invalidateQueries({ queryKey: ["context"] }),
      ]);
    },
  });
}

export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: (payload: { current_password: string; new_password: string }) =>
      authFetch<void>("/account/password", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  });
}
