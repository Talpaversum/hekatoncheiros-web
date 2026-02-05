import { Card } from "../../ui-kit/components/Card";
import { useContextQuery } from "../../data/api/context";

export function DashboardPage() {
  const { data, isLoading } = useContextQuery();

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-wide text-hc-muted">Dashboard</div>
        <div className="mt-1 text-2xl font-semibold">Přehled</div>
        <div className="mt-1 text-sm text-hc-muted">
          {data ? `Tenant ${data.tenant.id}` : "Načítání…"}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <div className="text-sm text-hc-muted">Context snapshot</div>
          {isLoading ? (
            <div className="mt-4 text-sm">Načítám…</div>
          ) : (
            <pre className="mt-4 rounded-hc-sm bg-hc-surface-variant p-3 text-xs text-hc-text">
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </Card>
        <Card>
          <div className="text-sm text-hc-muted">Licensing</div>
          <div className="mt-4 text-sm">
            {data?.licenses ? Object.keys(data.licenses).length : 0} aktivních licencí
          </div>
        </Card>
      </div>
    </div>
  );
}
