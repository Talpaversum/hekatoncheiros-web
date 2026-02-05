import { useQuery } from "@tanstack/react-query";

import { authFetch } from "../../data/auth/auth-fetch";
import { getAccessToken } from "../../data/auth/storage";
import { Card } from "../../ui-kit/components/Card";

type LicenseResponse = {
  app_id: string;
  state: "active" | "inactive" | "expired";
  plan: string | null;
  expires_at: string | null;
  features: Record<string, boolean>;
  limits: Record<string, unknown>;
};

export function LicensingPage() {
  const token = getAccessToken();
  const { data, isLoading } = useQuery({
    queryKey: ["license", "app_inventory"],
    queryFn: () => authFetch<LicenseResponse>(`/licensing/apps/app_inventory`),
    enabled: !!token,
  });

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-wide text-hc-muted">Licensing</div>
        <div className="mt-1 text-2xl font-semibold">App inventory</div>
        <div className="mt-1 text-sm text-hc-muted">app_inventory</div>
      </div>
      <Card>
        {!token ? (
          <div className="text-sm text-hc-muted">Chybí access token, přihlas se znovu.</div>
        ) : isLoading ? (
          <div className="text-sm">Načítám…</div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-hc-muted">Stav licence</div>
            <div className="text-lg font-semibold">{data?.state ?? "inactive"}</div>
            <div className="text-xs text-hc-muted">Plan: {data?.plan ?? "-"}</div>
            <pre className="rounded-hc-sm border border-hc-outline bg-hc-surface-variant p-3 text-xs text-hc-text">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}
      </Card>
    </div>
  );
}
