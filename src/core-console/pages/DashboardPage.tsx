import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { hasPrivilege } from "../../access/privileges";
import { useAppCatalogQuery } from "../../data/api/app-catalog";
import { useAuditEventsQuery } from "../../data/api/audit";
import { useContextQuery } from "../../data/api/context";
import { useTenantUsersQuery } from "../../data/api/identity";
import { useInstalledAppsQuery } from "../../data/api/installed-apps";
import { useLocalization } from "../../localization/LocalizationProvider";
import { Card } from "../../ui-kit/components/Card";
import { PageHeader, SectionHeader, StatusBadge } from "../../ui-kit/components/Page";

type Widget = {
  id: string;
  label: string;
  value: ReactNode;
  description: string;
  status: "available" | "planned";
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  href?: string;
};

export function DashboardPage() {
  const { data, isLoading } = useContextQuery();
  const privileges = data?.privileges ?? [];
  const canManageApps = hasPrivilege(privileges, "platform.apps.manage");
  const canManageTenant = hasPrivilege(privileges, "tenant.config.manage");
  const canReadAudit = ["core.audit.read.own", "core.audit.read.tenant", "platform.audit.read"].some((privilege) => hasPrivilege(privileges, privilege));
  const [auditFrom] = useState(() => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  const [auditTo] = useState(() => new Date().toISOString());
  const { data: catalogData } = useAppCatalogQuery(canManageApps);
  const { data: installedData } = useInstalledAppsQuery(canManageApps);
  const { data: tenantUsersData } = useTenantUsersQuery(canManageTenant);
  const { data: auditData, isLoading: isAuditLoading } = useAuditEventsQuery(`from=${encodeURIComponent(auditFrom)}&to=${encodeURIComponent(auditTo)}&limit=50`, canReadAudit);
  const { t } = useLocalization();

  const catalog = catalogData?.items ?? [];
  const installed = installedData?.items ?? [];
  const licenseCount = data?.licenses ? Object.keys(data.licenses).length : 0;
  const appsRequiringLicense = catalog.filter((app) => app.license_required).length;
  const availableUpdates = installed.filter(
    (app) => app.catalog_update?.state === "available" || app.update_signal?.update_available === true,
  ).length;

  const widgets: Widget[] = [
    { id: "licenses", label: t("dashboard.tenantLicenses"), value: licenseCount, description: t("dashboard.tenantLicensesDescription"), status: "available" },
    { id: "installed", label: t("dashboard.installedApps"), value: canManageApps ? installed.length : "-", description: t("dashboard.installedAppsDescription"), status: "available" },
    { id: "license-required", label: t("dashboard.appsRequiringLicense"), value: canManageApps ? appsRequiringLicense : "-", description: t("dashboard.appsRequiringLicenseDescription"), status: "available", tone: appsRequiringLicense > 0 ? "warning" : "neutral" },
    { id: "updates", label: t("dashboard.availableUpdates"), value: canManageApps ? availableUpdates : "-", description: t("dashboard.availableUpdatesDescription"), status: "available", tone: availableUpdates > 0 ? "warning" : "neutral" },
    { id: "users", label: t("dashboard.tenantUsers"), value: canManageTenant ? tenantUsersData?.items.length ?? 0 : "-", description: t("dashboard.tenantUsersDescription"), status: "available" },
    ...(canReadAudit ? [{ id: "audit", label: t("dashboard.recentAuditEvents"), value: isAuditLoading ? "…" : auditData?.next_cursor ? "50+" : auditData?.items.length ?? 0, description: t("dashboard.recentAuditEventsDescription"), status: "available" as const, tone: auditData?.items.some((event) => event.severity === "error" || event.severity === "critical") ? "warning" as const : "info" as const, href: "/core/audit?from=now-1d&to=now" }] : []),
    { id: "jobs", label: t("dashboard.failedJobs"), value: "-", description: t("dashboard.failedJobsDescription"), status: "planned" },
    { id: "health", label: t("dashboard.systemHealth"), value: "-", description: t("dashboard.systemHealthDescription"), status: "planned" },
    { id: "expiring", label: t("dashboard.expiringLicenses"), value: "-", description: t("dashboard.expiringLicensesDescription"), status: "planned" },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={t("nav.dashboard")}
        title={t("nav.overview")}
        description={data ? t("dashboard.operationalContext", { tenant: data.tenant.name ?? data.tenant.id ?? t("common.noTenant") }) : t("dashboard.loadingContext")}
      />

      <section aria-labelledby="dashboard-widgets">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 id="dashboard-widgets" className="text-sm font-semibold">{t("dashboard.operations")}</h2>
          <div className="text-xs text-hc-muted">{t("dashboard.frontendLayout")}</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {widgets.map((widget) => <DashboardWidget key={widget.id} widget={widget} liveLabel={t("common.live")} plannedLabel={t("common.planned")} />)}
        </div>
      </section>

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
          <SectionHeader title={t("dashboard.myPrivileges")} description={t("dashboard.sessionAccessDescription")} meta={<StatusBadge tone="success">{t("common.active")}</StatusBadge>} />
          <div className="border-t border-hc-outline p-3">
            <div className="flex max-h-52 flex-wrap gap-1.5 overflow-auto">
              {privileges.map((privilege) => <StatusBadge key={privilege}>{privilege}</StatusBadge>)}
              {!isLoading && privileges.length === 0 && <div className="px-1 py-3 text-sm text-hc-muted">{t("dashboard.noPrivileges")}</div>}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function DashboardWidget({ widget, liveLabel, plannedLabel }: { widget: Widget; liveLabel: string; plannedLabel: string }) {
  const content = (
    <Card className={`flex min-h-32 flex-col justify-between gap-4 p-4 ${widget.href ? "transition hover:border-hc-primary hover:bg-hc-surface-variant/30" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-medium">{widget.label}</div>
        <StatusBadge tone={widget.status === "planned" ? "neutral" : widget.tone ?? "info"}>
          {widget.status === "planned" ? plannedLabel : liveLabel}
        </StatusBadge>
      </div>
      <div>
        <div className="text-2xl font-semibold leading-none">{widget.value}</div>
        <div className="mt-2 text-xs text-hc-muted">{widget.description}</div>
      </div>
    </Card>
  );
  return widget.href ? <Link to={widget.href} className="rounded-hc-md focus:outline-none focus:ring-2 focus:ring-hc-primary/40">{content}</Link> : content;
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
