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

export function TenantConfigPage() {
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
      setMessage("Tenant details were updated.");
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
      setError("This user already has that tenant privilege.");
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
      setMessage("Tenant privilege was added.");
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
      setMessage("Tenant privilege was removed.");
    } catch (err) {
      setError(readErrorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      <ToastNotice message={toastMessage} tone={toastTone} onDismiss={dismissToast} />

      <PageHeader eyebrow="Configuration" title="Tenant configuration" description="Tenant-local settings for identity, app access, and license selection." />

      {(section === "tenant" || section === "") && <>
        <MetricStrip items={[
          { label: "Installed apps", value: installed.length },
          { label: "License required", value: licenseRequired, tone: licenseRequired > 0 ? "warning" : "neutral" },
          { label: "Users", value: tenantUsers.length },
          { label: "Tenant mode", value: context?.tenant.mode ?? "-" },
        ]} />
        <Card className="mt-4 overflow-hidden p-0">
          <SectionHeader title={tenantSettings?.name ?? context?.tenant.name ?? context?.tenant.id ?? "Tenant"} description={tenantSettings?.primary_domain ?? context?.tenant.primary_domain ?? "No primary domain"} meta={<StatusBadge tone="success">{tenantSettings?.status ?? "active"}</StatusBadge>} />
        </Card>
      </>}

      <div className="grid gap-4">
        {section === "details" && <Card className="overflow-hidden p-0">
          <SectionHeader title="Tenant details" description="Edit the tenant display name and primary domain used for tenant resolution." meta={<StatusBadge tone="success">{tenantSettings?.status ?? "active"}</StatusBadge>} />
          <div className="grid gap-3 border-t border-hc-outline p-4 md:grid-cols-2">
            <Field label="Tenant name">
              <Input value={effectiveTenantName} onChange={(event) => setTenantName(event.target.value)} />
            </Field>
            <Field label="Primary domain">
              <Input value={effectivePrimaryDomain} onChange={(event) => setPrimaryDomain(event.target.value)} placeholder="example.com" />
            </Field>
          </div>
          <div className="flex justify-end border-t border-hc-outline px-4 py-3">
            <Button onClick={() => void handleSaveTenant()} disabled={!effectiveTenantName.trim() || updateTenant.isPending}>
              Save tenant
            </Button>
          </div>
          <div className="grid border-t border-hc-outline md:grid-cols-2 md:divide-x md:divide-hc-outline">
            <ConfigTile title="Data policy" status="planned" detail="Tenant-level retention and isolation policy summary." />
            <ConfigTile title="Operational contacts" status="planned" detail="People and addresses responsible for tenant operations." />
          </div>
        </Card>}

        {section === "users" && <Card className="overflow-hidden p-0">
          <SectionHeader title="Users and roles" description="Manage tenant-scoped privileges for users already known to the platform." meta={<StatusBadge>{tenantUsers.length} users</StatusBadge>} />

          <div className="grid gap-3 border-y border-hc-outline bg-hc-surface-variant/40 px-4 py-3 md:grid-cols-[minmax(14rem,1fr)_minmax(14rem,1fr)_auto] md:items-end">
            <Field label="User">
              <Select value={selectedTenantUser?.id ?? ""} onChange={(event) => setSelectedTenantUserId(event.target.value)}>
                {tenantUsers.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}
              </Select>
            </Field>
            <Field label="Tenant privilege">
              <Select value={tenantGrantPrivilege} onChange={(event) => setTenantGrantPrivilege(event.target.value)}>
                <option value="">Select tenant privilege</option>
                {tenantPrivilegeCatalog.map((privilege) => <option key={privilege.id} value={privilege.id}>{privilege.id}</option>)}
              </Select>
            </Field>
            <Button onClick={() => void handleAddTenantGrant()} disabled={!selectedTenantUser || !tenantGrantPrivilege || replaceTenantUserPrivileges.isPending}>
              Add privilege
            </Button>
          </div>

          <div>
            {tenantUsers.length === 0 && <div className="px-4 py-8 text-center text-sm text-hc-muted">No tenant users yet. Platform admin can create users and grant the first tenant privilege from Platform configuration.</div>}
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
          <SectionHeader title="Apps and licenses" description="App installation, catalog sync, feed publishing, and license selection are managed from Applications." meta={<StatusBadge tone="info">active elsewhere</StatusBadge>} />
          <div className="grid border-t border-hc-outline md:grid-cols-3 md:divide-x md:divide-hc-outline">
            <ConfigTile title="Installed apps" status={`${installed.length}`} detail="Runtime apps known to this Core instance." />
            <ConfigTile title="License-required apps" status={`${licenseRequired}`} detail="Catalog entries that need tenant license selection." />
            <ConfigTile title="Feed publishing" status="admin gated" detail="Only installed apps can be published to this instance feed." />
          </div>
        </Card>}

        {section === "audit" && <Card className="overflow-hidden p-0">
          <SectionHeader title="Audit context" description="Tenant-scoped audit search and review will belong here once audit query APIs are available." meta={<StatusBadge>planned</StatusBadge>} />
          <div className="grid border-t border-hc-outline md:grid-cols-3 md:divide-x md:divide-hc-outline">
            <ConfigTile title="Recent admin actions" status="planned" detail="Configuration and app lifecycle events." />
            <ConfigTile title="License events" status="planned" detail="License import, activation, and selection history." />
            <ConfigTile title="Export" status="planned" detail="Tenant evidence bundle for audits and operations." />
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
            <button type="button" className="ml-1 text-hc-muted hover:text-hc-danger disabled:opacity-50" onClick={() => onRemove(grant)} disabled={busy} aria-label={`Remove ${grant.privilege}`}>×</button>
          </span>
        ))}
        {user.privileges.length === 0 && <span className="text-xs text-hc-muted">No tenant privileges</span>}
      </div>
      <StatusBadge tone={user.status === "active" ? "success" : "neutral"}>{user.status}</StatusBadge>
    </div>
  );
}
