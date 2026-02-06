import { useMemo, useState } from "react";

import { useAppRegistryQuery } from "../../data/api/app-registry";
import {
  useInstallAppMutation,
  useInstalledAppsQuery,
  useUninstallAppMutation,
  type InstalledApp,
} from "../../data/api/installed-apps";
import { useContextQuery } from "../../data/api/context";
import { Button } from "../../ui-kit/components/Button";
import { Card } from "../../ui-kit/components/Card";
import { Input } from "../../ui-kit/components/Input";
import { Table } from "../../ui-kit/components/Table";

function pickAppDisplayName(app: InstalledApp) {
  const displayName = app.manifest?.["display_name"];
  if (typeof displayName === "string" && displayName.trim().length > 0) {
    return displayName;
  }

  const appName = app.manifest?.["app_name"];
  if (typeof appName === "string" && appName.trim().length > 0) {
    return appName;
  }

  if (app.app_id?.trim()) {
    return app.app_id;
  }

  return app.slug;
}

function getStatus(app: InstalledApp, registrySlugs: Set<string>) {
  if (!app.ui_url || app.ui_url.trim().length === 0) {
    return { label: "Error", reason: "Missing ui_url (core-managed field)." };
  }

  if (!registrySlugs.has(app.slug)) {
    return { label: "Error", reason: "Registry mismatch: app slug is not present in registry." };
  }

  return { label: "Installed" as const, reason: null };
}

export function AppsPage() {
  const { data: context } = useContextQuery(true);
  const canManageApps = (context?.privileges ?? []).includes("platform.apps.manage");
  const { data, isLoading, error: installedQueryError } = useInstalledAppsQuery(canManageApps);
  const { data: registryData } = useAppRegistryQuery(canManageApps);
  const installMutation = useInstallAppMutation();
  const uninstallMutation = useUninstallAppMutation();

  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [installOpen, setInstallOpen] = useState(false);
  const [installForm, setInstallForm] = useState({
    base_url: "",
    manifest: "{}",
  });

  const installed = data?.items ?? [];
  const registrySlugs = useMemo(() => new Set((registryData?.items ?? []).map((item) => item.slug)), [registryData?.items]);
  const installedQueryErrorMessage =
    installedQueryError instanceof Error
      ? installedQueryError.message
      : "Nelze načíst seznam nainstalovaných aplikací.";
  const canSubmit = useMemo(
    () => installForm.base_url.trim().length > 0 && installForm.manifest.trim().length > 0,
    [installForm.base_url, installForm.manifest],
  );

  const handleInstall = async () => {
    setMessage(null);
    setActionError(null);

    try {
      const parsed = JSON.parse(installForm.manifest || "{}") as Record<string, unknown>;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Manifest JSON musí být objekt.");
      }

      const appId = parsed["app_id"];
      if (typeof appId !== "string" || appId.trim().length === 0) {
        throw new Error("Manifest musí obsahovat validní app_id.");
      }

      await installMutation.mutateAsync({
        app_id: appId,
        base_url: installForm.base_url.trim(),
        manifest: parsed,
      });
      setMessage(`App ${appId} byla nainstalována.`);
      setInstallForm({ base_url: "", manifest: "{}" });
      setInstallOpen(false);
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  const handleUninstall = async (app: InstalledApp) => {
    const confirmed = window.confirm(
      `This removes the app from the platform UI. App data schemas are not deleted.\n\napp_id: ${app.app_id}\nslug: ${app.slug}`,
    );

    if (!confirmed) {
      return;
    }

    setMessage(null);
    setActionError(null);
    try {
      await uninstallMutation.mutateAsync(app.app_id);
      setMessage(`App ${app.app_id} byla odinstalována.`);
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  if (!canManageApps) {
    return (
      <Card>
        <div className="text-lg font-semibold">Manage Apps</div>
        <div className="mt-2 text-sm text-hc-muted">Nemáš oprávnění pro správu aplikací.</div>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-wide text-hc-muted">Admin</div>
        <div className="mt-1 text-2xl font-semibold">Manage Apps</div>
        <div className="mt-1 text-sm text-hc-muted">Install/uninstall apps and inspect platform runtime status.</div>
      </div>

      <div className="grid gap-6">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">Installed apps</div>
            <Button variant={installOpen ? "tonal" : "filled"} onClick={() => setInstallOpen((prev) => !prev)}>
              {installOpen ? "Close install" : "Install app"}
            </Button>
          </div>

          {installOpen && (
            <div className="mb-5 rounded-hc-md border border-hc-outline bg-hc-surface-variant/40 p-4">
              <div className="text-sm font-semibold">Install app (DEV MVP)</div>
              <div className="mt-3 rounded-hc-sm border border-hc-outline bg-hc-surface px-3 py-2 text-xs text-hc-muted">
                UI plugins are fetched and hosted by the platform core during installation. You do not provide UI URLs manually.
              </div>

              <div className="mt-4 grid gap-3">
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-wide text-hc-muted">Base URL</label>
                  <Input
                    placeholder="http://127.0.0.1:4010"
                    value={installForm.base_url}
                    onChange={(event) => setInstallForm((prev) => ({ ...prev, base_url: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-wide text-hc-muted">Manifest JSON</label>
                  <textarea
                    className="min-h-[180px] w-full rounded-hc-md border border-hc-outline bg-transparent px-3 py-2 text-sm text-hc-text focus:border-hc-primary focus:outline-none focus:ring-2 focus:ring-hc-primary/30"
                    value={installForm.manifest}
                    onChange={(event) => setInstallForm((prev) => ({ ...prev, manifest: event.target.value }))}
                  />
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleInstall} disabled={!canSubmit || installMutation.isPending}>
                    {installMutation.isPending ? "Installing…" : "Install app"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="text-sm text-hc-muted">Načítám seznam aplikací…</div>
          ) : installed.length === 0 ? (
            <div className="text-sm text-hc-muted">Žádné aplikace nejsou nainstalované.</div>
          ) : (
            <Table>
              <thead className="border-b border-hc-outline text-xs uppercase tracking-wide text-hc-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">App name</th>
                  <th className="px-4 py-3 font-medium">Slug</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">UI</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {installed.map((app) => {
                  const status = getStatus(app, registrySlugs);
                  return (
                    <tr key={app.app_id} className="border-b border-hc-outline/60 align-top">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium">{pickAppDisplayName(app)}</div>
                        <div className="text-xs text-hc-muted">{app.app_id}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">{app.slug}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className={status.label === "Error" ? "text-hc-danger" : "text-hc-text"}>{status.label}</div>
                        {status.reason && <div className="mt-1 text-xs text-hc-muted">{status.reason}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm">{app.ui_url ? "✓" : "—"}</td>
                      <td className="px-4 py-3">
                        <Button
                          variant="outlined"
                          onClick={() => void handleUninstall(app)}
                          disabled={uninstallMutation.isPending}
                        >
                          Uninstall
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}

          {installedQueryError && (
            <div className="mt-3 text-sm text-hc-danger">
              {installedQueryErrorMessage}
            </div>
          )}
          <div className="mt-3 text-xs text-hc-muted">
            Uninstall removes app from platform UI. App data schemas are not deleted.
          </div>
        </Card>

        {message && <div className="text-sm text-hc-primary">{message}</div>}
        {actionError && <div className="text-sm text-hc-danger">{actionError}</div>}
      </div>
    </div>
  );
}
