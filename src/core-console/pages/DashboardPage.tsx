import { Card } from "../../ui-kit/components/Card";
import { TopBar } from "../../ui-kit/layout/TopBar";
import { useContextQuery } from "../../data/api/context";

export function DashboardPage() {
  const { data, isLoading } = useContextQuery();

  return (
    <div>
      <TopBar
        title="Dashboard"
        meta={data ? `Tenant ${data.tenant.id}` : "Načítání…"}
      >
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-hc-muted">
          {data?.actor?.user_id ?? "Neznámý uživatel"}
        </span>
      </TopBar>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <div className="text-sm text-hc-muted">Context snapshot</div>
          {isLoading ? (
            <div className="mt-4 text-sm">Načítám…</div>
          ) : (
            <pre className="mt-4 whitespace-pre-wrap text-xs text-hc-text">
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
