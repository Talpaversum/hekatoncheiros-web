import { useMemo, useState } from "react";

import { useAppRegistryQuery } from "../../data/api/app-registry";
import {
  useInstallAppMutation,
  useInstalledAppsQuery,
  useUninstallAppMutation,
  type InstalledApp,
} from "../../data/api/installed-apps";
import { useContextQuery } from "../../data/api/context";
import {
  useAppEntitlementsQuery,
  useClearSelectionMutation,
  useOfflineIngestMutation,
  useSetSelectionMutation,
} from "../../data/api/licensing";
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

  if (!app.resolved_entitlement) {
    return {
      label: app.has_any_entitlement ? "Entitlement unavailable" : "Unlicensed",
      reason: app.has_any_entitlement
        ? "Tenant má entitlementy, ale žádný není aktuálně validní."
        : "App je nainstalovaná, ale tenant pro ni nemá žádný entitlement.",
    };
  }

  if (!registrySlugs.has(app.slug)) {
    return {
      label: "No access",
      reason: "App je licencovaná, ale aktuální uživatel ji nevidí v registry (chybějící oprávnění).",
    };
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
  const setSelectionMutation = useSetSelectionMutation();
  const clearSelectionMutation = useClearSelectionMutation();
  const offlineIngestMutation = useOfflineIngestMutation();

  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [installOpen, setInstallOpen] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [selectedEntitlementId, setSelectedEntitlementId] = useState<string>("");
  const [offlineToken, setOfflineToken] = useState<string>("");
  const [installForm, setInstallForm] = useState({
    base_url: "",
    manifest: "{}",
  });

  const installed = data?.items ?? [];
  const effectiveSelectedAppId = selectedAppId ?? (installed.length > 0 ? installed[0].app_id : null);
  const { data: entitlementsData } = useAppEntitlementsQuery(effectiveSelectedAppId, canManageApps);
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

  const handleSetSelection = async () => {
    if (!effectiveSelectedAppId || !selectedEntitlementId) {
      return;
    }
    await setSelectionMutation.mutateAsync({
      app_id: effectiveSelectedAppId,
      entitlement_id: selectedEntitlementId,
    });
    setMessage("Selection byla nastavena.");
  };

  const handleClearSelection = async () => {
    if (!effectiveSelectedAppId) {
      return;
    }
    await clearSelectionMutation.mutateAsync({ app_id: effectiveSelectedAppId });
    setMessage("Selection byla vyčištěna.");
  };

  const handleIngestOffline = async () => {
    if (!offlineToken.trim()) {
      return;
    }
    const result = await offlineIngestMutation.mutateAsync({ token: offlineToken.trim() });
    setMessage(`Offline token ingest OK (${result.verification_result}).`);
    setOfflineToken("");
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
                        <div
                          className={
                            status.label === "Installed"
                              ? "text-hc-text"
                              : status.label === "Error"
                                ? "text-hc-danger"
                                : "text-hc-muted"
                          }
                        >
                          {status.label}
                        </div>
                        {status.reason && <div className="mt-1 text-xs text-hc-muted">{status.reason}</div>}
                        {app.resolved_entitlement && (
                          <div className="mt-1 text-xs text-hc-muted">
                            {app.resolved_entitlement.source} / {app.resolved_entitlement.tier}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">{app.ui_url ? "✓" : "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button
                            variant="outlined"
                            onClick={() => void handleUninstall(app)}
                            disabled={uninstallMutation.isPending}
                          >
                            Uninstall
                          </Button>
                          <Button variant="tonal" onClick={() => setSelectedAppId(app.app_id)}>
                            Licensing
                          </Button>
                        </div>
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

        <Card>
          <div className="text-sm font-semibold">Licensing management</div>
          <div className="mt-2 text-xs text-hc-muted">Vyber app a nastav selection nebo vlož offline token.</div>

          <div className="mt-3">
            <label className="mb-2 block text-xs uppercase tracking-wide text-hc-muted">App</label>
            <select
              className="w-full rounded-hc-md border border-hc-outline bg-transparent px-3 py-2 text-sm"
              value={effectiveSelectedAppId ?? ""}
              onChange={(event) => setSelectedAppId(event.target.value || null)}
            >
              <option value="">-- vyber app --</option>
              {installed.map((app) => (
                <option key={app.app_id} value={app.app_id}>
                  {pickAppDisplayName(app)} ({app.app_id})
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3">
            <label className="mb-2 block text-xs uppercase tracking-wide text-hc-muted">Entitlements</label>
            <select
              className="w-full rounded-hc-md border border-hc-outline bg-transparent px-3 py-2 text-sm"
              value={selectedEntitlementId}
              onChange={(event) => setSelectedEntitlementId(event.target.value)}
            >
              <option value="">-- fallback (bez selection) --</option>
              {(entitlementsData?.items ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.source} / {item.tier} / do {new Date(item.valid_to).toLocaleString()}
                  {entitlementsData?.selected_entitlement_id === item.id ? " [selected]" : ""}
                </option>
              ))}
            </select>
            <div className="mt-2 flex gap-2">
              <Button onClick={() => void handleSetSelection()} disabled={!selectedEntitlementId || setSelectionMutation.isPending}>
                Set selection
              </Button>
              <Button variant="outlined" onClick={() => void handleClearSelection()} disabled={clearSelectionMutation.isPending}>
                Clear selection
              </Button>
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-xs uppercase tracking-wide text-hc-muted">Offline token (JWT/JWS)</label>
            <textarea
              className="min-h-[140px] w-full rounded-hc-md border border-hc-outline bg-transparent px-3 py-2 text-sm"
              value={offlineToken}
              onChange={(event) => setOfflineToken(event.target.value)}
            />
            <div className="mt-2 flex justify-end">
              <Button onClick={() => void handleIngestOffline()} disabled={!offlineToken.trim() || offlineIngestMutation.isPending}>
                Ingest offline token
              </Button>
            </div>
          </div>
        </Card>

        {message && <div className="text-sm text-hc-primary">{message}</div>}
        {actionError && <div className="text-sm text-hc-danger">{actionError}</div>}
      </div>
    </div>
  );
}
