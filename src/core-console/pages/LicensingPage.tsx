import { useQuery } from "@tanstack/react-query";

import { authFetch } from "../../data/auth/auth-fetch";
import { getAccessToken } from "../../data/auth/storage";
import { Card } from "../../ui-kit/components/Card";

type LicenseResponse = {
  app_id: string;
  selected_entitlement_id: string | null;
  items: Array<{
    id: string;
    source: string;
    tier: string;
    valid_from: string;
    valid_to: string;
    limits: Record<string, unknown>;
    status: string;
  }>;
};

export function LicensingPage() {
  const token = getAccessToken();
  const { data, isLoading } = useQuery({
    queryKey: ["license", "com.talpaversum.inventory", "entitlements"],
    queryFn: () => authFetch<LicenseResponse>(`/licensing/entitlements?app_id=com.talpaversum.inventory`),
    enabled: !!token,
  });

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-wide text-hc-muted">Licensing</div>
        <div className="mt-1 text-2xl font-semibold">Inventory</div>
        <div className="mt-1 text-sm text-hc-muted">com.talpaversum.inventory</div>
      </div>
      <Card>
        {!token ? (
          <div className="text-sm text-hc-muted">Chybí access token, přihlas se znovu.</div>
        ) : isLoading ? (
          <div className="text-sm">Načítám…</div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-hc-muted">Entitlements</div>
            <div className="text-lg font-semibold">{data?.items?.length ?? 0}</div>
            <div className="text-xs text-hc-muted">Selected: {data?.selected_entitlement_id ?? "none"}</div>
            <pre className="rounded-hc-sm border border-hc-outline bg-hc-surface-variant p-3 text-xs text-hc-text">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}
      </Card>
    </div>
  );
}
