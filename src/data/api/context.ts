import { useQuery } from "@tanstack/react-query";

import { authFetch } from "../auth/auth-fetch";

export type ContextResponse = {
  tenant: {
    id: string | null;
    mode: string;
    name?: string | null;
    primary_domain?: string | null;
    status?: string | null;
  };
  actor: {
    user_id: string;
    email?: string | null;
    display_name?: string | null;
    status?: string | null;
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
