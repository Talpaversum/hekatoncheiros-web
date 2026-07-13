import { Card } from "../../ui-kit/components/Card";
import { MetricStrip, PageHeader, SectionHeader, StatusBadge } from "../../ui-kit/components/Page";
import { useContextQuery } from "../../data/api/context";

export function DashboardPage() {
  const { data, isLoading } = useContextQuery();
  const licenseCount = data?.licenses ? Object.keys(data.licenses).length : 0;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Dashboard"
        title="Overview"
        description={data ? `Operational context for ${data.tenant.name ?? data.tenant.id}.` : "Loading operational context..."}
        actions={(
          <MetricStrip items={[
            { label: "Privileges", value: data?.privileges.length ?? 0 },
            { label: "Licenses", value: licenseCount },
            { label: "Delegation", value: data?.actor.impersonating ? "On" : "Off", tone: data?.actor.impersonating ? "warning" : "neutral" },
          ]} />
        )}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
        <Card className="overflow-hidden p-0">
          <SectionHeader title="Current context" description="Identity and tenant applied to API requests in this session." />
          {isLoading ? (
            <div className="border-t border-hc-outline px-4 py-6 text-sm text-hc-muted">Loading...</div>
          ) : (
            <dl className="grid border-t border-hc-outline sm:grid-cols-2">
              <ContextItem label="User" value={data?.actor.display_name ?? data?.actor.email ?? data?.actor.user_id ?? "-"} detail={data?.actor.user_id} />
              <ContextItem label="Effective user" value={data?.actor.effective_user_id ?? "-"} detail={data?.actor.impersonating ? "Delegated session" : "Direct session"} />
              <ContextItem label="Tenant" value={data?.tenant.name ?? data?.tenant.id ?? "-"} detail={data?.tenant.id ?? undefined} />
              <ContextItem label="Tenant mode" value={data?.tenant.mode ?? "-"} detail={data?.tenant.primary_domain ?? undefined} />
            </dl>
          )}
        </Card>

        <Card className="overflow-hidden p-0">
          <SectionHeader title="Session access" description="Effective permissions after tenant resolution." meta={<StatusBadge tone="success">active</StatusBadge>} />
          <div className="border-t border-hc-outline p-3">
            <div className="flex max-h-52 flex-wrap gap-1.5 overflow-auto">
              {(data?.privileges ?? []).map((privilege) => <StatusBadge key={privilege}>{privilege}</StatusBadge>)}
              {!isLoading && (data?.privileges.length ?? 0) === 0 && <div className="px-1 py-3 text-sm text-hc-muted">No effective privileges.</div>}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ContextItem({ label, value, detail }: { label: string; value: string; detail?: string | null }) {
  return (
    <div className="border-b border-hc-outline px-4 py-3 last:border-b-0 sm:odd:border-r">
      <dt className="text-xs font-medium text-hc-muted">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold" title={value}>{value}</dd>
      {detail && detail !== value && <div className="mt-0.5 truncate text-xs text-hc-muted" title={detail}>{detail}</div>}
    </div>
  );
}
