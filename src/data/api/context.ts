import { useQuery } from "@tanstack/react-query";

import { authFetch } from "../auth/auth-fetch";

export type ContextResponse = {
  tenant: { id: string | null; mode: string };
  actor: {
    user_id: string;
    effective_user_id: string;
    impersonating: boolean;
    delegation: unknown;
  };
  privileges: string[];
  licenses: Record<string, unknown>;
};

export function useContextQuery(enabled = true) {
  return useQuery({
    queryKey: ["context"],
    queryFn: () => authFetch<ContextResponse>("/context"),
    enabled,
  });
}
