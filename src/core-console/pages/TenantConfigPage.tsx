import { useMemo } from "react";

import { hasPrivilege } from "../../access/privileges";
import { useContextQuery } from "../../data/api/context";
import { useAppCatalogQuery } from "../../data/api/app-catalog";
import { useInstalledAppsQuery } from "../../data/api/installed-apps";
import { Card } from "../../ui-kit/components/Card";

function StatusBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-hc-sm border border-hc-outline bg-hc-surface-variant px-2 py-1 text-xs text-hc-muted">
      {children}
    </span>
  );
}

export function TenantConfigPage() {
  const { data: context } = useContextQuery(true);
  const canManageApps = hasPrivilege(context?.privileges ?? [], "platform.apps.manage");
  const { data: catalogData } = useAppCatalogQuery(canManageApps);
  const { data: installedData } = useInstalledAppsQuery(canManageApps);

  const catalog = useMemo(() => catalogData?.items ?? [], [catalogData?.items]);
  const installed = useMemo(() => installedData?.items ?? [], [installedData?.items]);
  const licenseRequired = catalog.filter((item) => item.license_required).length;

  return (
    <div className="space-y-5">
      <header>
        <div className="text-xs uppercase tracking-wide text-hc-muted">Configuration</div>
        <div className="mt-1 text-2xl font-semibold">Tenant configuration</div>
        <div className="mt-1 text-sm text-hc-muted">
          Tenant-local settings for identity, app access, and license selection.
        </div>
      </header>

      <section id="dashboard" className="grid gap-4 lg:grid-cols-4">
        <Card className="rounded-hc-md">
          <div className="text-sm font-semibold">Tenant</div>
          <div className="mt-3 text-2xl font-semibold">{context?.tenant.id ?? "-"}</div>
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
          <div className="mt-3 text-2xl font-semibold">Planned</div>
          <div className="mt-1 text-xs text-hc-muted">Tenant user and role APIs are not implemented yet.</div>
        </Card>
      </section>

      <div className="grid gap-4">
        <Card id="tenant-details" className="rounded-hc-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Tenant details</div>
              <div className="mt-2 text-xs text-hc-muted">
                This area should eventually manage tenant name, domains, locale, and operational contacts.
              </div>
            </div>
            <StatusBadge>planned</StatusBadge>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <ConfigTile title="Primary domain" status="planned" detail="Domain ownership and tenant resolution controls." />
            <ConfigTile title="Tenant profile" status="planned" detail="Name, contact, locale, and billing-facing metadata." />
            <ConfigTile title="Data policy" status="planned" detail="Tenant-level retention and isolation policy summary." />
          </div>
        </Card>

        <Card id="users" className="rounded-hc-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Users and roles</div>
              <div className="mt-2 text-xs text-hc-muted">
                Tenant admins should be able to invite users and assign tenant-scoped privileges here.
              </div>
            </div>
            <StatusBadge>planned</StatusBadge>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <ConfigTile title="Users" status="planned" detail="Invite, disable, and review tenant users." />
            <ConfigTile title="Roles" status="planned" detail="Reusable tenant role bundles." />
            <ConfigTile title="Delegation" status="planned" detail="Per-tenant delegation approvals and expiry." />
          </div>
        </Card>

        <Card id="apps" className="rounded-hc-md">
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
        </Card>

        <Card id="audit" className="rounded-hc-md">
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
        </Card>
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
