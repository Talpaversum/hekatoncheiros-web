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

function StatusBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-hc-sm border border-hc-outline bg-hc-surface-variant px-2 py-1 text-xs text-hc-muted">
      {children}
    </span>
  );
}

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
    <div className="space-y-5">
      <header>
        <div className="text-xs uppercase tracking-wide text-hc-muted">Configuration</div>
        <div className="mt-1 text-2xl font-semibold">Tenant configuration</div>
        <div className="mt-1 text-sm text-hc-muted">
          Tenant-local settings for identity, app access, and license selection.
        </div>
      </header>

      {message && <div className="rounded-hc-md border border-hc-success/25 bg-hc-success/10 px-4 py-3 text-sm text-hc-success">{message}</div>}
      {error && <div className="rounded-hc-md border border-hc-danger/30 bg-hc-danger/10 px-4 py-3 text-sm text-hc-danger">{error}</div>}

      {(section === "tenant" || section === "") && <section className="grid gap-4 lg:grid-cols-4">
        <Card className="rounded-hc-md">
          <div className="text-sm font-semibold">Tenant</div>
          <div className="mt-3 text-2xl font-semibold">{tenantSettings?.name ?? context?.tenant.name ?? context?.tenant.id ?? "-"}</div>
          <div className="mt-1 text-xs text-hc-muted">Mode: {context?.tenant.mode ?? "-"}</div>
        </Card>
        <Card className="rounded-hc-md">
          <div className="text-sm font-semibold">Installed apps</div>
          <div className="mt-3 text-2xl font-semibold">{installed.length}</div>
          <div className="mt-1 text-xs text-hc-muted">Apps available in this instance.</div>
        </Card>
        <Card className="rounded-hc-md">
          <div className="text-sm font-semibold">Licensed catalog apps</div>
          <div className="mt-3 text-2xl font-semibold">{licenseRequired}</div>
          <div className="mt-1 text-xs text-hc-muted">Apps that require selected active licenses.</div>
        </Card>
        <Card className="rounded-hc-md">
          <div className="text-sm font-semibold">User management</div>
          <div className="mt-3 text-2xl font-semibold">{tenantUsers.length}</div>
          <div className="mt-1 text-xs text-hc-muted">Users with tenant-scoped privileges.</div>
        </Card>
      </section>}

      <div className="grid gap-4">
        {section === "details" && <Card className="rounded-hc-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Tenant details</div>
              <div className="mt-2 text-xs text-hc-muted">Edit the tenant display name and primary domain used for tenant resolution.</div>
            </div>
            <StatusBadge>{tenantSettings?.status ?? "active"}</StatusBadge>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-hc-muted">Tenant name</label>
              <Input value={effectiveTenantName} onChange={(event) => setTenantName(event.target.value)} />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-hc-muted">Primary domain</label>
              <Input value={effectivePrimaryDomain} onChange={(event) => setPrimaryDomain(event.target.value)} placeholder="example.com" />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => void handleSaveTenant()} disabled={!effectiveTenantName.trim() || updateTenant.isPending}>
              Save tenant
            </Button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <ConfigTile title="Data policy" status="planned" detail="Tenant-level retention and isolation policy summary." />
            <ConfigTile title="Operational contacts" status="planned" detail="People and addresses responsible for tenant operations." />
          </div>
        </Card>}

        {section === "users" && <Card className="rounded-hc-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Users and roles</div>
              <div className="mt-2 text-xs text-hc-muted">
                Manage tenant-scoped privileges for users already known to the platform.
              </div>
            </div>
            <StatusBadge>{tenantUsers.length} users</StatusBadge>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <select className="rounded-hc-md border border-hc-outline bg-transparent px-3 py-2 text-sm text-hc-text" value={selectedTenantUser?.id ?? ""} onChange={(event) => setSelectedTenantUserId(event.target.value)}>
              {tenantUsers.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}
            </select>
            <select className="rounded-hc-md border border-hc-outline bg-transparent px-3 py-2 text-sm text-hc-text" value={tenantGrantPrivilege} onChange={(event) => setTenantGrantPrivilege(event.target.value)}>
              <option value="">Select tenant privilege</option>
              {tenantPrivilegeCatalog.map((privilege) => <option key={privilege.id} value={privilege.id}>{privilege.id}</option>)}
            </select>
            <Button onClick={() => void handleAddTenantGrant()} disabled={!selectedTenantUser || !tenantGrantPrivilege || replaceTenantUserPrivileges.isPending}>
              Add privilege
            </Button>
          </div>

          <div className="mt-4 grid gap-3">
            {tenantUsers.length === 0 && <div className="text-sm text-hc-muted">No tenant users yet. Platform admin can create users and grant the first tenant privilege from Platform configuration.</div>}
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

        {section === "apps" && <Card className="rounded-hc-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Apps and licenses</div>
              <div className="mt-2 text-xs text-hc-muted">
                App install, catalog sync, feed publishing, and license selection are currently managed from Applications.
              </div>
            </div>
            <StatusBadge>active elsewhere</StatusBadge>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <ConfigTile title="Installed apps" status={`${installed.length}`} detail="Runtime apps known to this Core instance." />
            <ConfigTile title="License-required apps" status={`${licenseRequired}`} detail="Catalog entries that need tenant license selection." />
            <ConfigTile title="Feed publishing" status="admin gated" detail="Only installed apps can be published to this instance feed." />
          </div>
        </Card>}

        {section === "audit" && <Card className="rounded-hc-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Audit context</div>
              <div className="mt-2 text-xs text-hc-muted">
                Tenant-scoped audit search and review will belong here once audit query APIs are available.
              </div>
            </div>
            <StatusBadge>planned</StatusBadge>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
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
    <div className="rounded-hc-md border border-hc-outline bg-hc-surface p-3">
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
    <div className={`rounded-hc-md border p-3 ${selected ? "border-hc-primary bg-hc-primary/5" : "border-hc-outline"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="text-left" onClick={onSelect}>
          <div className="text-sm font-semibold">{user.display_name || user.email}</div>
          <div className="mt-1 text-xs text-hc-muted">{user.email} · {user.id}</div>
        </button>
        <StatusBadge>{user.status}</StatusBadge>
      </div>
      <div className="mt-3 grid gap-2">
        {user.privileges.map((grant) => (
          <div key={`${grant.privilege}:${grant.tenant_id ?? "tenant"}`} className="flex flex-wrap items-center justify-between gap-3 rounded-hc-sm border border-hc-outline bg-hc-surface p-2">
            <div className="text-sm">{grant.privilege}</div>
            <Button variant="ghost" onClick={() => onRemove(grant)} disabled={busy}>
              Remove
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
