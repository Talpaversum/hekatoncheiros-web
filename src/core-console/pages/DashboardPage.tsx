import { Card } from "../../ui-kit/components/Card";
import { MetricStrip, PageHeader, SectionHeader, StatusBadge } from "../../ui-kit/components/Page";
import { useContextQuery } from "../../data/api/context";
import { useLocalization } from "../../localization/LocalizationProvider";

export function DashboardPage() {
  const { data, isLoading } = useContextQuery();
  const licenseCount = data?.licenses ? Object.keys(data.licenses).length : 0;
  const { t } = useLocalization();

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={t("nav.dashboard")}
        title={t("nav.overview")}
        description={data ? t("dashboard.operationalContext", { tenant: data.tenant.name ?? data.tenant.id ?? t("common.noTenant") }) : t("dashboard.loadingContext")}
        actions={(
          <MetricStrip items={[
            { label: t("dashboard.privileges"), value: data?.privileges.length ?? 0 },
            { label: t("dashboard.licenses"), value: licenseCount },
            { label: t("dashboard.delegation"), value: data?.actor.impersonating ? t("common.on") : t("common.off"), tone: data?.actor.impersonating ? "warning" : "neutral" },
          ]} />
        )}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
        <Card className="overflow-hidden p-0">
          <SectionHeader title={t("dashboard.currentContext")} description={t("dashboard.currentContextDescription")} />
          {isLoading ? (
            <div className="border-t border-hc-outline px-4 py-6 text-sm text-hc-muted">{t("common.loading")}</div>
          ) : (
            <dl className="grid border-t border-hc-outline sm:grid-cols-2">
              <ContextItem label={t("dashboard.user")} value={data?.actor.display_name ?? data?.actor.email ?? data?.actor.user_id ?? "-"} detail={data?.actor.user_id} />
              <ContextItem label={t("dashboard.effectiveUser")} value={data?.actor.effective_user_id ?? "-"} detail={data?.actor.impersonating ? t("dashboard.delegatedSession") : t("dashboard.directSession")} />
              <ContextItem label={t("dashboard.tenant")} value={data?.tenant.name ?? data?.tenant.id ?? "-"} detail={data?.tenant.id ?? undefined} />
              <ContextItem label={t("dashboard.tenantMode")} value={data?.tenant.mode ?? "-"} detail={data?.tenant.primary_domain ?? undefined} />
            </dl>
          )}
        </Card>

        <Card className="overflow-hidden p-0">
          <SectionHeader title={t("dashboard.sessionAccess")} description={t("dashboard.sessionAccessDescription")} meta={<StatusBadge tone="success">{t("common.active")}</StatusBadge>} />
          <div className="border-t border-hc-outline p-3">
            <div className="flex max-h-52 flex-wrap gap-1.5 overflow-auto">
              {(data?.privileges ?? []).map((privilege) => <StatusBadge key={privilege}>{privilege}</StatusBadge>)}
              {!isLoading && (data?.privileges.length ?? 0) === 0 && <div className="px-1 py-3 text-sm text-hc-muted">{t("dashboard.noPrivileges")}</div>}
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
