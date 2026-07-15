import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authFetch } from "../auth/auth-fetch";

export function useUserPreferenceQuery<T>(namespace: string, enabled = true) {
  return useQuery({ queryKey: ["user-preference", namespace], queryFn: () => authFetch<{ value: T | null; updated_at: string | null }>(`/account/preferences/${encodeURIComponent(namespace)}`), enabled });
}

export function useSaveUserPreferenceMutation<T>(namespace: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (value: T | null) => authFetch<void>(`/account/preferences/${encodeURIComponent(namespace)}`, { method: "PUT", body: JSON.stringify({ value }) }),
    onMutate: async (value) => {
      await queryClient.cancelQueries({ queryKey: ["user-preference", namespace] });
      const previous = queryClient.getQueryData(["user-preference", namespace]);
      queryClient.setQueryData(["user-preference", namespace], { value, updated_at: new Date().toISOString() });
      return { previous };
    },
    onError: (_error, _value, context) => queryClient.setQueryData(["user-preference", namespace], context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["user-preference", namespace] }),
  });
}
