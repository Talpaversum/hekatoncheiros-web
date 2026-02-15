import { useMemo, useState } from "react";

import { hasPrivilege } from "../../access/privileges";
import { useAppRegistryQuery } from "../../data/api/app-registry";
import {
  useFetchInstallManifestMutation,
  useInstallAppMutation,
  useInstalledAppsQuery,
  useUninstallAppMutation,
  type FetchManifestResponse,
  type InstalledApp,
} from "../../data/api/installed-apps";
import { readErrorMessage } from "../../data/api/read-error-message";
import { useContextQuery } from "../../data/api/context";
import {
  useAppEntitlementsQuery,
  useClearSelectionMutation,
  useOfflineIngestMutation,
  useSetSelectionMutation,
} from "../../data/api/licensing";
import { Button } from "../../ui-kit/components/Button";
import { Card } from "../../ui-kit/components/Card";
import { Dialog } from "../../ui-kit/components/Dialog";
import { Input } from "../../ui-kit/components/Input";
import { Table } from "../../ui-kit/components/Table";

type UninstallState =
  | { status: "idle" }
  | { status: "confirm"; app: InstalledApp }
  | { status: "running"; app: InstalledApp }
  | { status: "success" }
  | { status: "error"; app: InstalledApp; error: string };

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
  const canManageApps = hasPrivilege(context?.privileges ?? [], "platform.apps.manage");
  const { data, isLoading, error: installedQueryError } = useInstalledAppsQuery(canManageApps);
  const { data: registryData } = useAppRegistryQuery(canManageApps);
  const fetchManifestMutation = useFetchInstallManifestMutation();
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
  });
  const [fetchedManifest, setFetchedManifest] = useState<FetchManifestResponse | null>(null);
  const [uninstallState, setUninstallState] = useState<UninstallState>({ status: "idle" });
  const [uninstallConfirmChecked, setUninstallConfirmChecked] = useState(false);

  const installed = data?.items ?? [];
  const effectiveSelectedAppId = selectedAppId ?? (installed.length > 0 ? installed[0].app_id : null);
  const { data: entitlementsData } = useAppEntitlementsQuery(effectiveSelectedAppId, canManageApps);
  const registrySlugs = useMemo(() => new Set((registryData?.items ?? []).map((item) => item.slug)), [registryData?.items]);
  const installedQueryErrorMessage =
    installedQueryError instanceof Error
      ? installedQueryError.message
      : "Nelze načíst seznam nainstalovaných aplikací.";
  const canFetchManifest = installForm.base_url.trim().length > 0;
  const canInstall = fetchedManifest !== null;
  const uninstallDialogOpen = uninstallState.status !== "idle";
  const uninstallRunning = uninstallState.status === "running";

  const readString = (obj: Record<string, unknown>, key: string): string | null => {
    const value = obj[key];
    return typeof value === "string" && value.trim().length > 0 ? value : null;
  };

  const resetUninstallState = () => {
    if (uninstallState.status === "running") {
      return;
    }
    setUninstallState({ status: "idle" });
    setUninstallConfirmChecked(false);
  };

  const executeUninstall = async (app: InstalledApp) => {
    setMessage(null);
    setActionError(null);
    setUninstallState({ status: "running", app });

    try {
      await uninstallMutation.mutateAsync(app.app_id);
      setUninstallState({ status: "success" });
      setMessage(`App ${app.app_id} byla odinstalována.`);
    } catch (error) {
      console.error("Uninstall failed", { appId: app.app_id, error });
      setUninstallState({
        status: "error",
        app,
        error: readErrorMessage(error),
      });
    }
  };

  const handleFetchManifest = async () => {
    setMessage(null);
    setActionError(null);
    setFetchedManifest(null);

    try {
      const fetched = await fetchManifestMutation.mutateAsync({
        base_url: installForm.base_url.trim(),
      });

      setFetchedManifest(fetched);
      setInstallForm({ base_url: fetched.normalized_base_url });
    } catch (err) {
      setActionError(readErrorMessage(err));
    }
  };

  const handleInstall = async () => {
    setMessage(null);
    setActionError(null);

    if (!fetchedManifest) {
      setActionError("Nejprve načti a validuj manifest.");
      return;
    }

    try {
      await installMutation.mutateAsync({
        base_url: installForm.base_url.trim(),
        expected_manifest_hash: fetchedManifest.manifest_hash,
      });
      setMessage(`App ${fetchedManifest.app_id} byla nainstalována.`);
      setInstallForm({ base_url: "" });
      setFetchedManifest(null);
      setInstallOpen(false);
    } catch (err) {
      setActionError(readErrorMessage(err));
    }
  };

  const handleUninstall = (app: InstalledApp) => {
    setUninstallConfirmChecked(false);
    setUninstallState({ status: "confirm", app });
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
              <div className="text-sm font-semibold">Install app</div>
              <div className="mt-3 rounded-hc-sm border border-hc-outline bg-hc-surface px-3 py-2 text-xs text-hc-muted">
                Instalace probíhá pouze přes HTTPS Base URL. Core si manifest načte a validuje automaticky.
              </div>

              <div className="mt-4 grid gap-3">
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-wide text-hc-muted">Base URL</label>
                  <Input
                    placeholder="https://example.com"
                    value={installForm.base_url}
                    onChange={(event) => {
                      setInstallForm((prev) => ({ ...prev, base_url: event.target.value }));
                      setFetchedManifest(null);
                    }}
                  />
                </div>

                <div className="flex justify-between gap-2">
                  <Button onClick={handleFetchManifest} disabled={!canFetchManifest || fetchManifestMutation.isPending}>
                    {fetchManifestMutation.isPending ? "Fetching manifest…" : "Fetch manifest"}
                  </Button>
                  <Button onClick={handleInstall} disabled={!canInstall || installMutation.isPending}>
                    {installMutation.isPending ? "Installing…" : "Install"}
                  </Button>
                </div>

                {fetchedManifest && (
                  <div className="rounded-hc-sm border border-hc-outline bg-hc-surface p-3 text-sm">
                    <div className="mb-2 text-xs uppercase tracking-wide text-hc-muted">Manifest preview (read-only)</div>
                    <div><strong>Base URL:</strong> {fetchedManifest.normalized_base_url}</div>
                    <div><strong>App ID:</strong> {fetchedManifest.app_id}</div>
                    <div><strong>App name:</strong> {readString(fetchedManifest.manifest, "app_name") ?? "—"}</div>
                    <div><strong>Version:</strong> {fetchedManifest.app_version}</div>
                    <div><strong>Slug:</strong> {fetchedManifest.slug ?? "—"}</div>
                    <div>
                      <strong>Scopes:</strong>{" "}
                      {Array.isArray((fetchedManifest.manifest["privileges"] as { required?: unknown } | undefined)?.required)
                        ? ((fetchedManifest.manifest["privileges"] as { required?: string[] }).required ?? []).join(", ")
                        : "—"}
                    </div>
                    <div>
                      <strong>Routes:</strong>{" "}
                      {Array.isArray(
                        ((fetchedManifest.manifest["integration"] as { ui?: { nav_entries?: unknown } } | undefined)?.ui
                          ?.nav_entries as unknown[] | undefined) ?? [],
                      )
                        ? ((((fetchedManifest.manifest["integration"] as { ui?: { nav_entries?: Array<{ path?: string }> } })
                            .ui?.nav_entries ?? []) as Array<{ path?: string }>)
                            .map((entry) => entry.path)
                            .filter((value): value is string => typeof value === "string")
                            .join(", ") || "—")
                        : "—"}
                    </div>
                  </div>
                )}
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
                          <Button variant="outlined" onClick={() => handleUninstall(app)} disabled={uninstallRunning}>
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

      <Dialog
        open={uninstallDialogOpen}
        title="Uninstall app"
        disableClose={uninstallState.status === "running"}
        onClose={resetUninstallState}
      >
        {uninstallState.status === "confirm" && (
          <div>
            <div className="text-lg font-semibold">Confirm uninstall</div>
            <div className="mt-2 text-sm text-hc-muted">Tato akce odstraní aplikaci z runtime instalací platformy.</div>

            <div className="mt-4 rounded-hc-sm border border-hc-outline bg-hc-surface-variant/30 p-3 text-sm">
              <div><strong>App:</strong> {pickAppDisplayName(uninstallState.app)}</div>
              <div><strong>App ID:</strong> {uninstallState.app.app_id}</div>
              <div><strong>Base URL:</strong> {uninstallState.app.base_url}</div>
            </div>

            <label className="mt-4 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={uninstallConfirmChecked}
                onChange={(event) => setUninstallConfirmChecked(event.target.checked)}
              />
              <span>Rozumím dopadu odinstalace.</span>
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={resetUninstallState}>
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={!uninstallConfirmChecked}
                onClick={() => void executeUninstall(uninstallState.app)}
              >
                Confirm uninstall
              </Button>
            </div>
          </div>
        )}

        {uninstallState.status === "running" && (
          <div>
            <div className="text-lg font-semibold">Uninstall in progress</div>
            <div className="mt-2 text-sm text-hc-muted">Odinstalace aplikace právě probíhá. Prosím čekej…</div>
            <div className="mt-4 flex items-center gap-3 text-sm">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-hc-outline border-t-hc-primary" />
              <span>Running uninstall for {uninstallState.app.app_id}</span>
            </div>
          </div>
        )}

        {uninstallState.status === "success" && (
          <div>
            <div className="text-lg font-semibold">Uninstall completed</div>
            <div className="mt-2 text-sm text-hc-muted">Aplikace byla úspěšně odinstalována.</div>
            <div className="mt-5 flex justify-end">
              <Button onClick={resetUninstallState}>Close</Button>
            </div>
          </div>
        )}

        {uninstallState.status === "error" && (
          <div>
            <div className="text-lg font-semibold text-hc-danger">Uninstall failed</div>
            <div className="mt-2 text-sm text-hc-muted">Odinstalaci se nepodařilo dokončit.</div>
            <div className="mt-3 rounded-hc-sm border border-hc-danger/40 bg-hc-danger/10 p-3 text-sm text-hc-danger">
              {uninstallState.error}
            </div>
            <details className="mt-3 text-xs text-hc-muted">
              <summary>Detail chyby</summary>
              <div className="mt-2 whitespace-pre-wrap">{uninstallState.error}</div>
            </details>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={resetUninstallState}>
                Close
              </Button>
              <Button variant="danger" onClick={() => void executeUninstall(uninstallState.app)}>
                Retry
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
