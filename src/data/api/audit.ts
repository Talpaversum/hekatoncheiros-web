import { useQuery } from "@tanstack/react-query";

import { authFetch } from "../auth/auth-fetch";

export type AuditEvent = {
  id: string; tenant_id: string | null; actor_user_id: string | null; effective_user_id: string | null;
  actor_type: string; application_id: string | null; source_service: string; event_type: string;
  category: string; action: string; outcome: string; severity: string; scope: string; visibility: string;
  resource_type: string | null; resource_id: string | null; object_ref: string; message: string;
  correlation_id: string | null; request_id: string | null; ip_address: string | null; user_agent: string | null;
  metadata: Record<string, unknown>; occurred_at: string; received_at: string; schema_version: number;
};

export type AuditFilterOptions = {
  tenants: string[]; users: string[]; applications: string[]; categories: string[]; event_types: string[];
  severities: string[]; outcomes: string[];
};

export function useAuditEventsQuery(search: string, enabled = true) {
  return useQuery({
    queryKey: ["audit-events", search],
    queryFn: () => authFetch<{ items: AuditEvent[]; next_cursor: string | null }>(`/audit/events${search ? `?${search}` : ""}`),
    enabled,
  });
}

export function useAuditFilterOptionsQuery(enabled = true) {
  return useQuery({ queryKey: ["audit-filter-options"], queryFn: () => authFetch<AuditFilterOptions>("/audit/filter-options"), enabled });
}
