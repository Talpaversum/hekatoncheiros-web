import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { hasPrivilege } from "../../access/privileges";
import { useContextQuery } from "../../data/api/context";
import { useAppCatalogQuery } from "../../data/api/app-catalog";
import { useTenantSettingsQuery, useUpdateTenantSettingsMutation } from "../../data/api/configuration";
import {
  usePrivilegeCatalogQuery,
  useReplaceTenantUserPrivilegesMutation,
  useTenantUsersQuery,
  type IdentityUser,
  type PrivilegeGrant,
} from "../../data/api/identity";
import { useInstalledAppsQuery } from "../../data/api/installed-apps";
import { readErrorMessage } from "../../data/api/read-error-message";
import { Button } from "../../ui-kit/components/Button";
import { Card } from "../../ui-kit/components/Card";
import { Input } from "../../ui-kit/components/Input";
import { Field, MetricStrip, PageHeader, SectionHeader, StatusBadge } from "../../ui-kit/components/Page";
import { Select } from "../../ui-kit/components/Select";
import { ToastNotice } from "../../ui-kit/components/ToastNotice";
import { useLocalization } from "../../localization/LocalizationProvider";

export function TenantConfigPage() {
  const { t } = useLocalization();
  const location = useLocation();
  const { data: context } = useContextQuery(true);
  const canManageApps = hasPrivilege(context?.privileges ?? [], "platform.apps.manage");
  const { data: catalogData } = useAppCatalogQuery(canManageApps);
  const { data: installedData } = useInstalledAppsQuery(canManageApps);
  const { data: tenantSettings } = useTenantSettingsQuery(true);
  const { data: tenantUsersData } = useTenantUsersQuery(true);
  const { data: privilegeCatalogData } = usePrivilegeCatalogQuery(true);
  const updateTenant = useUpdateTenantSettingsMutation();
  const replaceTenantUserPrivileges = useReplaceTenantUserPrivilegesMutation();
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [primaryDomain, setPrimaryDomain] = useState<string | null>(null);
  const [selectedTenantUserId, setSelectedTenantUserId] = useState("");
  const [tenantGrantPrivilege, setTenantGrantPrivilege] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const catalog = useMemo(() => catalogData?.items ?? [], [catalogData?.items]);
  const installed = useMemo(() => installedData?.items ?? [], [installedData?.items]);
  const tenantUsers = tenantUsersData?.items ?? [];
  const tenantPrivilegeCatalog = (privilegeCatalogData?.items ?? []).filter((item) => item.scope === "tenant");
  const licenseRequired = catalog.filter((item) => item.license_required).length;
  const section = location.pathname.split("/").pop() ?? "";
  const effectiveTenantName = tenantName ?? tenantSettings?.name ?? context?.tenant.name ?? "";
  const effectivePrimaryDomain = primaryDomain ?? tenantSettings?.primary_domain ?? context?.tenant.primary_domain ?? "";
  const selectedTenantUser = tenantUsers.find((item) => item.id === selectedTenantUserId) ?? tenantUsers[0];
  const toastMessage = error ?? message;
  const toastTone = error ? "danger" : "success";
  const dismissToast = () => {
    setMessage(null);
    setError(null);
  };

  const handleSaveTenant = async () => {
    setMessage(null);
    setError(null);
    try {
      await updateTenant.mutateAsync({
        name: effectiveTenantName.trim(),
        primary_domain: effectivePrimaryDomain.trim() || null,
      });
      setTenantName(null);
      setPrimaryDomain(null);
      setMessage(t("tenant.detailsUpdated"));
    } catch (err) {
      setError(readErrorMessage(err));
    }
  };

  const handleAddTenantGrant = async () => {
    if (!selectedTenantUser || !tenantGrantPrivilege) {
      return;
    }
    const exists = selectedTenantUser.privileges.some((item) => item.privilege === tenantGrantPrivilege);
    if (exists) {
      setError(t("tenant.privilegeExists"));
      return;
    }
    setMessage(null);
    setError(null);
    try {
      await replaceTenantUserPrivileges.mutateAsync({
        id: selectedTenantUser.id,
        grants: [...selectedTenantUser.privileges, { privilege: tenantGrantPrivilege, tenant_id: tenantSettings?.id ?? context?.tenant.id ?? null }],
      });
      setTenantGrantPrivilege("");
      setMessage(t("tenant.privilegeAdded"));
    } catch (err) {
      setError(readErrorMessage(err));
    }
  };

  const handleRemoveTenantGrant = async (user: IdentityUser, grant: PrivilegeGrant) => {
    setMessage(null);
    setError(null);
    try {
      await replaceTenantUserPrivileges.mutateAsync({
        id: user.id,
        grants: user.privileges.filter((item) => item.privilege !== grant.privilege),
      });
      setMessage(t("tenant.privilegeRemoved"));
    } catch (err) {
      setError(readErrorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      <ToastNotice message={toastMessage} tone={toastTone} onDismiss={dismissToast} />

      <PageHeader eyebrow={t("config.configuration")} title={t("tenant.title")} description={t("tenant.description")} />

      {(section === "tenant" || section === "") && <>
        <MetricStrip items={[
          { label: t("tenant.installedApps"), value: installed.length },
          { label: t("tenant.licenseRequired"), value: licenseRequired, tone: licenseRequired > 0 ? "warning" : "neutral" },
          { label: t("tenant.users"), value: tenantUsers.length },
          { label: t("tenant.mode"), value: context?.tenant.mode ?? "-" },
        ]} />
        <Card className="mt-4 overflow-hidden p-0">
          <SectionHeader title={tenantSettings?.name ?? context?.tenant.name ?? context?.tenant.id ?? t("tenant.fallbackName")} description={tenantSettings?.primary_domain ?? context?.tenant.primary_domain ?? t("tenant.noPrimaryDomain")} meta={<StatusBadge tone="success">{tenantSettings?.status ?? t("config.active")}</StatusBadge>} />
        </Card>
      </>}

      <div className="grid gap-4">
        {section === "details" && <Card className="overflow-hidden p-0">
          <SectionHeader title={t("tenant.details")} description={t("tenant.detailsDescription")} meta={<StatusBadge tone="success">{tenantSettings?.status ?? t("config.active")}</StatusBadge>} />
          <div className="grid gap-3 border-t border-hc-outline p-4 md:grid-cols-2">
            <Field label={t("tenant.name")}>
              <Input value={effectiveTenantName} onChange={(event) => setTenantName(event.target.value)} />
            </Field>
            <Field label={t("tenant.primaryDomain")}>
              <Input value={effectivePrimaryDomain} onChange={(event) => setPrimaryDomain(event.target.value)} placeholder="example.com" />
            </Field>
          </div>
          <div className="flex justify-end border-t border-hc-outline px-4 py-3">
            <Button onClick={() => void handleSaveTenant()} disabled={!effectiveTenantName.trim() || updateTenant.isPending}>
              {t("tenant.save")}
            </Button>
          </div>
          <div className="grid border-t border-hc-outline md:grid-cols-2 md:divide-x md:divide-hc-outline">
            <ConfigTile title={t("tenant.dataPolicy")} status={t("common.planned")} detail={t("tenant.dataPolicyDescription")} />
            <ConfigTile title={t("tenant.operationalContacts")} status={t("common.planned")} detail={t("tenant.operationalContactsDescription")} />
          </div>
        </Card>}

        {section === "users" && <Card className="overflow-hidden p-0">
          <SectionHeader title={t("nav.usersPrivileges")} description={t("tenant.usersRolesDescription")} meta={<StatusBadge>{t("tenant.usersCount", { count: tenantUsers.length })}</StatusBadge>} />

          <div className="grid gap-3 border-y border-hc-outline bg-hc-surface-variant/40 px-4 py-3 md:grid-cols-[minmax(14rem,1fr)_minmax(14rem,1fr)_auto] md:items-end">
            <Field label={t("tenant.user")}>
              <Select value={selectedTenantUser?.id ?? ""} onChange={(event) => setSelectedTenantUserId(event.target.value)}>
                {tenantUsers.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}
              </Select>
            </Field>
            <Field label={t("tenant.privilege")}>
              <Select value={tenantGrantPrivilege} onChange={(event) => setTenantGrantPrivilege(event.target.value)}>
                <option value="">{t("tenant.selectPrivilege")}</option>
                {tenantPrivilegeCatalog.map((privilege) => <option key={privilege.id} value={privilege.id}>{privilege.id}</option>)}
              </Select>
            </Field>
            <Button onClick={() => void handleAddTenantGrant()} disabled={!selectedTenantUser || !tenantGrantPrivilege || replaceTenantUserPrivileges.isPending}>
              {t("tenant.addPrivilege")}
            </Button>
          </div>

          <div>
            {tenantUsers.length === 0 && <div className="px-4 py-8 text-center text-sm text-hc-muted">{t("tenant.noUsers")}</div>}
            {tenantUsers.map((user) => (
              <TenantUserRow
                key={user.id}
                user={user}
                selected={selectedTenantUser?.id === user.id}
                onSelect={() => setSelectedTenantUserId(user.id)}
                onRemove={(grant) => void handleRemoveTenantGrant(user, grant)}
                busy={replaceTenantUserPrivileges.isPending}
              />
            ))}
          </div>
        </Card>}

        {section === "apps" && <Card className="overflow-hidden p-0">
          <SectionHeader title={t("tenant.appsLicenses")} description={t("tenant.appsLicensesDescription")} meta={<StatusBadge tone="info">{t("tenant.activeElsewhere")}</StatusBadge>} />
          <div className="grid border-t border-hc-outline md:grid-cols-3 md:divide-x md:divide-hc-outline">
            <ConfigTile title={t("tenant.installedApps")} status={`${installed.length}`} detail={t("tenant.installedAppsDescription")} />
            <ConfigTile title={t("tenant.licenseApps")} status={`${licenseRequired}`} detail={t("tenant.licenseAppsDescription")} />
            <ConfigTile title={t("tenant.feedPublishing")} status={t("tenant.adminGated")} detail={t("tenant.feedPublishingDescription")} />
          </div>
        </Card>}

        {section === "audit" && <Card className="overflow-hidden p-0">
          <SectionHeader title={t("tenant.auditContext")} description={t("tenant.auditDescription")} meta={<StatusBadge>{t("common.planned")}</StatusBadge>} />
          <div className="grid border-t border-hc-outline md:grid-cols-3 md:divide-x md:divide-hc-outline">
            <ConfigTile title={t("tenant.recentActions")} status={t("common.planned")} detail={t("tenant.recentActionsDescription")} />
            <ConfigTile title={t("tenant.licenseEvents")} status={t("common.planned")} detail={t("tenant.licenseEventsDescription")} />
            <ConfigTile title={t("tenant.export")} status={t("common.planned")} detail={t("tenant.exportDescription")} />
          </div>
        </Card>}
      </div>
    </div>
  );
}

function ConfigTile({ title, status, detail }: { title: string; status: string; detail: string }) {
  return (
    <div className="border-b border-hc-outline px-4 py-3 last:border-b-0 md:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">{title}</div>
        <StatusBadge>{status}</StatusBadge>
      </div>
      <div className="mt-2 text-xs text-hc-muted">{detail}</div>
    </div>
  );
}

function TenantUserRow({
  user,
  selected,
  onSelect,
  onRemove,
  busy,
}: {
  user: IdentityUser;
  selected: boolean;
  onSelect: () => void;
  onRemove: (grant: PrivilegeGrant) => void;
  busy: boolean;
}) {
  const { t } = useLocalization();
  return (
    <div className={`grid gap-2 border-b border-hc-outline px-4 py-3 last:border-b-0 md:grid-cols-[minmax(14rem,0.8fr)_minmax(18rem,1.5fr)_auto] md:items-center ${selected ? "bg-hc-primary/5" : ""}`}>
      <button type="button" className="min-w-0 text-left" onClick={onSelect}>
          <div className="text-sm font-semibold">{user.display_name || user.email}</div>
          <div className="truncate text-xs text-hc-muted">{user.email} · {user.id}</div>
      </button>
      <div className="flex flex-wrap gap-1.5">
        {user.privileges.map((grant) => (
          <span key={`${grant.privilege}:${grant.tenant_id ?? "tenant"}`} className="inline-flex items-center gap-1 rounded-hc-sm border border-hc-outline bg-hc-surface px-2 py-1 text-xs">
            {grant.privilege}
            <button type="button" className="ml-1 text-hc-muted hover:text-hc-danger disabled:opacity-50" onClick={() => onRemove(grant)} disabled={busy} aria-label={`${t("tenant.remove")} ${grant.privilege}`}>×</button>
          </span>
        ))}
        {user.privileges.length === 0 && <span className="text-xs text-hc-muted">{t("tenant.noPrivileges")}</span>}
      </div>
      <StatusBadge tone={user.status === "active" ? "success" : "neutral"}>{user.status === "active" ? t("config.active") : user.status === "disabled" ? t("config.disabled") : user.status}</StatusBadge>
    </div>
  );
}
