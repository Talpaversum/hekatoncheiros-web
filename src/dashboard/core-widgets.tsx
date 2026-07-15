/* eslint-disable react-refresh/only-export-components */
import { useState } from "react";
import { Link } from "react-router-dom";

import { useAppCatalogQuery } from "../data/api/app-catalog";
import { useAppRegistryQuery } from "../data/api/app-registry";
import { useAuditEventsQuery } from "../data/api/audit";
import { useContextQuery } from "../data/api/context";
import { useTenantUsersQuery } from "../data/api/identity";
import { useInstalledAppsQuery } from "../data/api/installed-apps";
import { useLocalization } from "../localization/LocalizationProvider";
import { Input } from "../ui-kit/components/Input";
import { Select } from "../ui-kit/components/Select";
import { Field } from "../ui-kit/components/Page";

import type { DashboardWidgetProps, DashboardWidgetSettingsProps } from "./widget-contract";
import { registerDashboardWidget } from "./widget-registry";

function Metric({ value, description, tone = "neutral", href }: { value: string | number; description: string; tone?: "neutral" | "success" | "warning" | "danger" | "info"; href?: string }) {
  const valueTone = tone === "warning" ? "text-hc-warning" : tone === "danger" ? "text-hc-danger" : tone === "success" ? "text-hc-success" : "";
  const content = <div className="flex flex-col gap-1.5"><div className={`text-2xl font-semibold leading-none ${valueTone}`}>{value}</div><div className="text-xs text-hc-muted">{description}</div></div>;
  return href ? <Link to={href} className="block h-full rounded-hc-sm focus:outline-none focus:ring-2 focus:ring-hc-primary/40">{content}</Link> : content;
}
function QueryState({ loading, error, retry }: { loading: boolean; error: boolean; retry(): void }) { const { t } = useLocalization(); if (loading) return <div className="h-10 animate-pulse rounded bg-hc-surface-variant/60" />; if (error) return <div className="flex items-center justify-between gap-2 text-sm text-hc-danger"><span>{t("dashboard.widgetError")}</span><button className="text-hc-primary underline" onClick={retry}>{t("dashboard.retry")}</button></div>; return null; }

function TenantLicensesWidget() {
  const { data } = useContextQuery(); const { t } = useLocalization();
  const count = data?.licenses ? Object.keys(data.licenses).length : 0;
  return <Metric value={count} description={count ? t("dashboard.tenantLicensesDescription") : t("dashboard.noTenantLicenses")} />;
}
function InstalledAppsWidget() {
  const query = useInstalledAppsQuery(true); const { t } = useLocalization();
  if (query.isLoading || query.isError) return <QueryState loading={query.isLoading} error={query.isError} retry={() => void query.refetch()} />;
  const items = query.data?.items ?? [];
  return <div className="space-y-2"><Metric value={items.length} description={t("dashboard.installedCount", { count: items.length })} />{items.slice(0, 3).map((app) => <div key={app.app_id} className="border-t border-hc-outline pt-2 text-xs"><div className="truncate font-medium">{app.app_name ?? app.slug}</div><div className="truncate text-hc-muted">{app.enabled === false ? t("common.off") : t("common.active")} · {app.app_version ?? "—"}</div></div>)}<Link className="block text-xs text-hc-primary" to="/core/apps/installed">{t("dashboard.viewAll")}</Link></div>;
}
function LicenseRequiredWidget({ size }: DashboardWidgetProps) {
  const query = useAppCatalogQuery(true); const { t } = useLocalization();
  if (query.isLoading || query.isError) return <QueryState loading={query.isLoading} error={query.isError} retry={() => void query.refetch()} />;
  const apps = query.data?.items.filter((app) => app.license_required) ?? [];
  if (!apps.length) return <Metric value="0" description={t("dashboard.noAppsRequireLicense")} />;
  const visible = apps.slice(0, size === "small" ? 2 : 4);
  return <div className="space-y-2"><Metric value={apps.length} description={t("dashboard.appsRequiringLicenseDescription")} tone="warning" />{visible.map((app) => <Link key={app.app_id} to="/core/apps" className="block truncate border-t border-hc-outline pt-2 text-xs font-medium hover:text-hc-primary" title={app.app_name}>{app.app_name}</Link>)}{apps.length > visible.length && <Link className="block text-xs text-hc-primary" to="/core/apps">{t("dashboard.moreApps", { count: apps.length - visible.length })}</Link>}</div>;
}
function AppUpdatesWidget() {
  const query = useInstalledAppsQuery(true); const { t } = useLocalization();
  if (query.isLoading || query.isError) return <QueryState loading={query.isLoading} error={query.isError} retry={() => void query.refetch()} />;
  const updates = query.data?.items.filter((app) => app.catalog_update?.state === "available" || app.update_signal?.update_available) ?? [];
  return updates.length ? <div className="space-y-2"><Metric value={updates.length} description={t("dashboard.availableUpdatesDescription")} tone="warning" />{updates.slice(0, 3).map((app) => <div className="truncate border-t border-hc-outline pt-2 text-xs" key={app.app_id}>{app.app_name ?? app.slug} · {app.catalog_update?.app_version ?? app.update_signal?.app_version ?? "—"}</div>)}</div> : <Metric value="0" description={t("dashboard.noUpdates")} />;
}
function TenantUsersWidget() {
  const query = useTenantUsersQuery(true); const { t } = useLocalization();
  if (query.isLoading || query.isError) return <QueryState loading={query.isLoading} error={query.isError} retry={() => void query.refetch()} />;
  const items = query.data?.items ?? []; const active = items.filter((user) => user.status === "active").length;
  return <Metric value={items.length} description={t("dashboard.activeUsers", { count: active })} href="/core/tenant/users" />;
}
function AuditWidget({ settings, size }: DashboardWidgetProps) {
  const { t } = useLocalization();
  const hours = Math.min(Math.max(Number(settings["hours"] ?? 24), 1), 720);
  const sizeLimit = size === "small" ? 2 : size === "medium" ? 4 : 8;
  const limit = Math.min(Math.max(Number(settings["limit"] ?? sizeLimit), 1), sizeLimit);
  const severity = Array.isArray(settings["severity"]) ? settings["severity"].join(",") : "";
  const [now] = useState(() => Date.now());
  const from = new Date(now - hours * 3_600_000).toISOString();
  const query = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(new Date(now).toISOString())}&limit=${limit}${severity ? `&severity=${encodeURIComponent(severity)}` : ""}`;
  const result = useAuditEventsQuery(query, true);
  if (result.isLoading || result.isError) return <QueryState loading={result.isLoading} error={result.isError} retry={() => void result.refetch()} />;
  const events = result.data?.items.slice(0, sizeLimit) ?? [];
  if (!events.length) return <div className="py-2 text-sm text-hc-muted">{t("dashboard.noAuditEvents")}</div>;
  return <div><div className="divide-y divide-hc-outline">{events.map((event) => <Link key={event.id} to={`/core/audit?detail=${encodeURIComponent(event.id)}`} title={event.message} className="grid grid-cols-[3.25rem_4.5rem_minmax(0,1fr)] gap-2 py-2 text-xs hover:bg-hc-surface-variant"><span className="text-hc-muted">{new Date(event.occurred_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span><span className="truncate capitalize">{event.outcome || event.severity}</span><span className="min-w-0"><span className="block truncate font-medium">{event.message || event.action}</span>{size !== "small" && <span className="block truncate text-hc-muted">{event.actor_user_id ?? event.actor_type}{size === "wide" && event.application_id ? ` · ${event.application_id}` : ""}</span>}</span></Link>)}</div><Link className="mt-2 block text-xs text-hc-primary" to="/core/audit">{t("dashboard.viewAll")}</Link></div>;
}
function AuditSettings({ value, onChange }: DashboardWidgetSettingsProps) {
  const { t } = useLocalization();
  return <div className="grid gap-3 sm:grid-cols-2"><Field label={t("dashboard.settingTimeHours")}><Input type="number" min={1} max={720} value={Number(value["hours"] ?? 24)} onChange={(event) => onChange({ ...value, hours: Number(event.target.value) })} /></Field><Field label={t("dashboard.settingEventLimit")}><Select value={Number(value["limit"] ?? 50)} onChange={(event) => onChange({ ...value, limit: Number(event.target.value) })}>{[10, 25, 50, 100, 200].map((limit) => <option key={limit} value={limit}>{limit}</option>)}</Select></Field><Field label={t("dashboard.settingSeverity")} className="sm:col-span-2"><Select value={(value["severity"] as string[] | undefined)?.join(",") ?? ""} onChange={(event) => onChange({ ...value, severity: event.target.value ? event.target.value.split(",") : [] })}><option value="">{t("dashboard.allSeverities")}</option><option value="warning,error,critical">{t("dashboard.importantSeverities")}</option><option value="error,critical">{t("dashboard.errorsOnly")}</option></Select></Field></div>;
}
function UnavailableWidget() { const { t } = useLocalization(); return <div className="py-2 text-sm text-hc-muted">{t("dashboard.dataUnavailable")}</div>; }
function AppRuntimeHealthWidget({ size }: DashboardWidgetProps) { const query = useAppRegistryQuery(true); const { t } = useLocalization(); if (query.isLoading || query.isError) return <QueryState loading={query.isLoading} error={query.isError} retry={() => void query.refetch()} />; const limit = size === "small" ? 2 : size === "medium" ? 4 : 8; const items = [...(query.data?.items ?? [])].sort((a, b) => Number(a.runtime.status === "healthy") - Number(b.runtime.status === "healthy")).slice(0, limit); return items.length ? <div className="divide-y divide-hc-outline">{items.map((app) => <div key={app.app_id} className="flex items-center justify-between gap-2 py-2 text-xs"><span className="truncate font-medium">{app.app_name ?? app.slug}</span><span className={app.runtime.status === "healthy" ? "text-hc-success" : app.runtime.status === "degraded" ? "text-hc-warning" : "text-hc-danger"}>{t(`runtime.status.${app.runtime.status}`)}</span></div>)}</div> : <div className="text-sm text-hc-muted">{t("common.noApps")}</div>; }

let registered = false;
export function registerCoreDashboardWidgets() {
  if (registered) return; registered = true;
  const common = { owner: "core" as const, supportedScopes: ["tenant", "platform"] as const, supportedSizes: ["small", "medium"] as const, presentation: "kpi" as const, defaultSize: "small" as const, defaultSettings: {} };
  registerDashboardWidget({ ...common, id: "core.tenant-licenses", titleKey: "dashboard.tenantLicenses", descriptionKey: "dashboard.tenantLicensesDescription", categoryKey: "dashboard.categoryLicensing", requiredPrivileges: [], defaultVisible: true, defaultPosition: 10, component: TenantLicensesWidget });
  registerDashboardWidget({ ...common, presentation: "summary", id: "core.installed-apps", titleKey: "dashboard.installedApps", descriptionKey: "dashboard.installedAppsDescription", categoryKey: "dashboard.categorySystem", requiredPrivileges: ["platform.apps.manage"], defaultVisible: true, defaultPosition: 20, component: InstalledAppsWidget });
  registerDashboardWidget({ ...common, id: "core.license-required", titleKey: "dashboard.appsRequiringLicense", descriptionKey: "dashboard.appsRequiringLicenseDescription", categoryKey: "dashboard.categoryLicensing", requiredPrivileges: ["platform.apps.manage"], defaultVisible: true, defaultPosition: 30, component: LicenseRequiredWidget });
  registerDashboardWidget({ ...common, id: "core.app-updates", titleKey: "dashboard.availableUpdates", descriptionKey: "dashboard.availableUpdatesDescription", categoryKey: "dashboard.categorySystem", requiredPrivileges: ["platform.apps.manage"], defaultVisible: true, defaultPosition: 40, component: AppUpdatesWidget });
  registerDashboardWidget({ ...common, id: "core.tenant-users", titleKey: "dashboard.tenantUsers", descriptionKey: "dashboard.tenantUsersDescription", categoryKey: "dashboard.categoryIdentity", requiredPrivileges: ["tenant.config.manage"], defaultVisible: true, defaultPosition: 50, component: TenantUsersWidget });
  registerDashboardWidget({ ...common, presentation: "list", supportedSizes: ["medium", "wide"], id: "core.audit", titleKey: "dashboard.recentAuditEvents", descriptionKey: "dashboard.recentAuditEventsDescription", categoryKey: "dashboard.categoryAccounting", requiredPrivileges: ["core.audit.read.own|core.audit.read.tenant|platform.audit.read"], defaultVisible: true, defaultPosition: 60, defaultSize: "medium", defaultSettings: { hours: 24, limit: 4, severity: [] }, component: AuditWidget, settingsComponent: AuditSettings });
  registerDashboardWidget({ ...common, presentation: "list", id: "core.failed-jobs", titleKey: "dashboard.failedJobs", descriptionKey: "dashboard.failedJobsDescription", categoryKey: "dashboard.categorySystem", requiredPrivileges: ["platform.superadmin"], defaultVisible: false, defaultPosition: 70, component: UnavailableWidget });
  registerDashboardWidget({ ...common, presentation: "summary", id: "core.system-health", titleKey: "dashboard.systemHealth", descriptionKey: "dashboard.systemHealthDescription", categoryKey: "dashboard.categorySystem", requiredPrivileges: ["platform.superadmin"], defaultVisible: false, defaultPosition: 80, component: UnavailableWidget });
  registerDashboardWidget({ ...common, presentation: "list", id: "core.expiring-licenses", titleKey: "dashboard.expiringLicenses", descriptionKey: "dashboard.expiringLicensesDescription", categoryKey: "dashboard.categoryLicensing", requiredPrivileges: ["core.licensing.read"], defaultVisible: false, defaultPosition: 90, component: UnavailableWidget });
  registerDashboardWidget({ ...common, presentation: "list", supportedSizes: ["small", "medium", "wide"], id: "core.app-runtime-health", titleKey: "dashboard.appRuntimeHealth", descriptionKey: "dashboard.appRuntimeHealthDescription", categoryKey: "dashboard.categorySystem", requiredPrivileges: [], defaultVisible: true, defaultPosition: 65, component: AppRuntimeHealthWidget });
}
