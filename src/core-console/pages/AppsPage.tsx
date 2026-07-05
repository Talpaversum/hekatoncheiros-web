import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { hasPrivilege } from "../../access/privileges";
import {
  useAppCatalogQuery,
  useAppCatalogSourcesQuery,
  useCreateCatalogEntryFromManifestMutation,
  useCreateCatalogSourceMutation,
  useDeleteCatalogEntryMutation,
  useInstallCatalogEntryMutation,
  useSetCatalogSourceEnabledMutation,
  useSetCatalogEntryPublicationMutation,
  useSyncCatalogSourceMutation,
  type AppCatalogEntry,
  type AppCatalogSource,
  type CatalogDeploymentPlan,
  type InstallCatalogEntryMode,
} from "../../data/api/app-catalog";
import { useAppRegistryQuery } from "../../data/api/app-registry";
import {
  useInstalledAppsQuery,
  useRefreshInstalledAppArtifactMutation,
  useUninstallAppMutation,
  type InstalledApp,
} from "../../data/api/installed-apps";
import { readErrorMessage } from "../../data/api/read-error-message";
import { useContextQuery } from "../../data/api/context";
import {
  useAppEntitlementsQuery,
  useClearSelectionMutation,
  useOfflineIngestMutation,
  useSetSelectionMutation,
  useStartLicenseOAuthMutation,
} from "../../data/api/licensing";
import { Button } from "../../ui-kit/components/Button";
import { Card } from "../../ui-kit/components/Card";
import { Dialog } from "../../ui-kit/components/Dialog";
import { Input } from "../../ui-kit/components/Input";
import { Select } from "../../ui-kit/components/Select";
import { Table } from "../../ui-kit/components/Table";
import { ToastNotice } from "../../ui-kit/components/ToastNotice";

type Tab = "catalog" | "installed" | "licensing";

type UninstallState =
  | { status: "idle" }
  | { status: "confirm"; app: InstalledApp }
  | { status: "running"; app: InstalledApp }
  | { status: "success" }
  | { status: "error"; app: InstalledApp; error: string };

type InstallDialogState =
  | { status: "idle" }
  | { status: "confirm"; entry: AppCatalogEntry; mode: InstallCatalogEntryMode; plan: CatalogDeploymentPlan }
  | { status: "running"; entry: AppCatalogEntry; mode: InstallCatalogEntryMode; plan: CatalogDeploymentPlan }
  | { status: "result"; entry: AppCatalogEntry; message: string; plan: CatalogDeploymentPlan }
  | { status: "error"; entry: AppCatalogEntry; mode: InstallCatalogEntryMode; error: string; plan: CatalogDeploymentPlan };

function Badge({ tone = "neutral", children }: { tone?: "neutral" | "good" | "warn" | "danger"; children: React.ReactNode }) {
  const toneClass = {
    neutral: "border-hc-outline bg-hc-surface-variant text-hc-muted",
    good: "border-hc-success/30 bg-hc-success/10 text-hc-success",
    warn: "border-hc-warning/35 bg-hc-warning/10 text-hc-warning",
    danger: "border-hc-danger/35 bg-hc-danger/10 text-hc-danger",
  }[tone];

  return (
    <span className={`inline-flex items-center rounded-hc-sm border px-2 py-1 text-xs font-medium ${toneClass}`}>
      {children}
    </span>
  );
}

function pickAppDisplayName(app: InstalledApp) {
  const appName = app.manifest?.["app_name"];
  return typeof appName === "string" && appName.trim().length > 0 ? appName : app.app_name ?? app.app_id;
}

function getInstalledStatus(app: InstalledApp, registrySlugs: Set<string>) {
  const licensing = app.manifest?.["licensing"] as { required?: boolean } | undefined;

  if (app.ui_url.trim().length === 0) {
    return { label: "Broken", tone: "danger" as const, detail: "Missing Core-hosted UI artifact." };
  }

  if (licensing?.required === true && !app.resolved_entitlement) {
    return {
      label: app.has_any_entitlement ? "License inactive" : "License missing",
      tone: "warn" as const,
      detail: app.has_any_entitlement
        ? "Tenant has licenses, but none is selected and active."
        : "Installed and staged, but runtime use is blocked.",
    };
  }

  if (!registrySlugs.has(app.slug)) {
    return { label: "Hidden", tone: "neutral" as const, detail: "Current user cannot see it in runtime navigation." };
  }

  return { label: "Ready", tone: "good" as const, detail: null };
}

function getCatalogRuntimeStatus(entry: AppCatalogEntry) {
  if (!entry.installed) {
    return { label: "Available", tone: "neutral" as const, detail: null };
  }

  if (!entry.installed.enabled) {
    return { label: "Disabled", tone: "danger" as const, detail: "Installed, but disabled for runtime use." };
  }

  if (entry.license_state.required && !entry.license_state.selected_active_license) {
    return {
      label: entry.license_state.has_any_license ? "License inactive" : "License missing",
      tone: "warn" as const,
      detail: entry.license_state.has_any_license
        ? "A tenant license exists, but no active license is selected."
        : "Installed, but runtime use is blocked until a tenant license is selected.",
    };
  }

  return { label: "Ready", tone: "good" as const, detail: null };
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString();
}

function buildCatalogDeploymentPlan(entry: AppCatalogEntry, mode: InstallCatalogEntryMode = "external"): CatalogDeploymentPlan {
  return {
    app_id: entry.app_id,
    mode,
    service_name: entry.deployment.service_name ?? entry.slug,
    internal_base_url: entry.deployment.internal_base_url ?? entry.deployment.base_url ?? entry.base_url,
    compose_project: entry.deployment.compose_project ?? "hekatoncheiros-core",
    compose_file: entry.deployment.compose_file ?? null,
    published_ports_allowed: false,
    host_mounts_allowed: false,
    requires_approval: true,
  };
}

function readTabFromPath(pathname: string): Tab {
  if (pathname.endsWith("/installed")) {
    return "installed";
  }
  if (pathname.endsWith("/licensing")) {
    return "licensing";
  }
  return "catalog";
}

function formatActionError(error: unknown) {
  const message = readErrorMessage(error);
  if (message.includes("base_url must use https")) {
    return "HTTP manifest URL is allowed only for trusted origins. For local Inventory compose use http://inventory:4010 and add that origin in Platform configuration / Trusted origins.";
  }
  return message;
}

export function AppsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: context } = useContextQuery(true);
  const tenantId = context?.tenant.id ?? null;
  const canManageApps = hasPrivilege(context?.privileges ?? [], "platform.apps.manage");
  const { data: catalogData, isLoading: catalogLoading } = useAppCatalogQuery(canManageApps);
  const { data: catalogSourcesData, isLoading: catalogSourcesLoading } = useAppCatalogSourcesQuery(canManageApps);
  const { data: installedData, isLoading: installedLoading, error: installedError } = useInstalledAppsQuery(canManageApps);
  const { data: registryData } = useAppRegistryQuery(canManageApps);
  const createCatalogEntry = useCreateCatalogEntryFromManifestMutation();
  const createCatalogSource = useCreateCatalogSourceMutation();
  const setCatalogSourceEnabled = useSetCatalogSourceEnabledMutation();
  const syncCatalogSource = useSyncCatalogSourceMutation();
  const deleteCatalogEntry = useDeleteCatalogEntryMutation();
  const installCatalogEntry = useInstallCatalogEntryMutation();
  const setCatalogEntryPublication = useSetCatalogEntryPublicationMutation();
  const uninstallMutation = useUninstallAppMutation();
  const refreshArtifactMutation = useRefreshInstalledAppArtifactMutation();
  const setSelectionMutation = useSetSelectionMutation();
  const clearSelectionMutation = useClearSelectionMutation();
  const offlineIngestMutation = useOfflineIngestMutation();
  const startLicenseOAuth = useStartLicenseOAuthMutation(tenantId);

  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dismissedInstalledError, setDismissedInstalledError] = useState<string | null>(null);
  const [catalogForm, setCatalogForm] = useState({ base_url: "", summary: "", trust_status: "manual" as "dev" | "manual" | "unverified" });
  const [sourceForm, setSourceForm] = useState({ name: "", feed_url: "", trust_mode: "manual" as AppCatalogSource["trust_mode"] });
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [selectedEntitlementId, setSelectedEntitlementId] = useState("");
  const [offlineToken, setOfflineToken] = useState("");
  const [installDialog, setInstallDialog] = useState<InstallDialogState>({ status: "idle" });
  const [uninstallState, setUninstallState] = useState<UninstallState>({ status: "idle" });
  const [uninstallConfirmChecked, setUninstallConfirmChecked] = useState(false);

  const catalog = useMemo(() => catalogData?.items ?? [], [catalogData?.items]);
  const catalogSources = useMemo(() => catalogSourcesData?.items ?? [], [catalogSourcesData?.items]);
  const installed = useMemo(() => installedData?.items ?? [], [installedData?.items]);
  const installedByAppId = useMemo(() => new Map(installed.map((app) => [app.app_id, app])), [installed]);
  const registrySlugs = useMemo(() => new Set((registryData?.items ?? []).map((item) => item.slug)), [registryData?.items]);
  const effectiveSelectedAppId = selectedAppId ?? installed[0]?.app_id ?? null;
  const { data: entitlementsData } = useAppEntitlementsQuery(effectiveSelectedAppId, canManageApps);

  const licensedCatalogCount = catalog.filter((item) => item.license_required).length;
  const installableCount = catalog.filter((item) => !item.installed).length;
  const publishedCount = catalog.filter((item) => item.published).length;
  const activeTab = readTabFromPath(location.pathname);
  const installedErrorMessage = installedError ? formatActionError(installedError) : null;
  const visibleInstalledError = installedErrorMessage === dismissedInstalledError ? null : installedErrorMessage;
  const toastMessage = actionError ?? message ?? visibleInstalledError;
  const toastTone = actionError || visibleInstalledError ? "danger" : "success";

  const resetNotices = () => {
    setMessage(null);
    setActionError(null);
    setDismissedInstalledError(null);
  };

  const handleCreateCatalogEntry = async () => {
    resetNotices();
    try {
      const entry = await createCatalogEntry.mutateAsync({
        base_url: catalogForm.base_url.trim(),
        summary: catalogForm.summary.trim() || null,
        trust_status: catalogForm.trust_status,
      });
      setMessage(`Catalog entry ${entry.app_id} was refreshed.`);
      setCatalogForm((prev) => ({ ...prev, base_url: "", summary: "" }));
    } catch (error) {
      setActionError(formatActionError(error));
    }
  };

  const handleCreateCatalogSource = async () => {
    resetNotices();
    try {
      const source = await createCatalogSource.mutateAsync({
        name: sourceForm.name.trim(),
        feed_url: sourceForm.feed_url.trim(),
        trust_mode: sourceForm.trust_mode,
      });
      setMessage(`Catalog feed ${source.name} was saved.`);
      setSourceForm((prev) => ({ ...prev, name: "", feed_url: "" }));
    } catch (error) {
      setActionError(formatActionError(error));
    }
  };

  const handleSyncCatalogSource = async (source: AppCatalogSource) => {
    resetNotices();
    try {
      const result = await syncCatalogSource.mutateAsync(source.id);
      const suffix = result.skipped > 0 ? `, ${result.skipped} failed` : "";
      setMessage(`Catalog feed ${source.name} synced: ${result.imported}/${result.total} imported${suffix}.`);
    } catch (error) {
      setActionError(formatActionError(error));
    }
  };

  const handleSetCatalogSourceEnabled = async (source: AppCatalogSource, isEnabled: boolean) => {
    resetNotices();
    try {
      await setCatalogSourceEnabled.mutateAsync({ id: source.id, isEnabled });
      setMessage(`${source.name} was ${isEnabled ? "enabled" : "disabled"}.`);
    } catch (error) {
      setActionError(formatActionError(error));
    }
  };

  const openInstallDialog = (entry: AppCatalogEntry) => {
    resetNotices();
    const mode = "external";
    setInstallDialog({ status: "confirm", entry, mode, plan: buildCatalogDeploymentPlan(entry, mode) });
  };

  const setInstallMode = (mode: InstallCatalogEntryMode) => {
    setInstallDialog((prev) => {
      if (prev.status !== "confirm") {
        return prev;
      }
      return { ...prev, mode, plan: buildCatalogDeploymentPlan(prev.entry, mode) };
    });
  };

  const closeInstallDialog = () => {
    if (installDialog.status === "running") {
      return;
    }
    setInstallDialog({ status: "idle" });
  };

  const executeCatalogInstall = async () => {
    if (installDialog.status !== "confirm" && installDialog.status !== "error") {
      return;
    }

    const { entry, mode, plan } = installDialog;
    resetNotices();
    setInstallDialog({ status: "running", entry, mode, plan });

    try {
      const result = await installCatalogEntry.mutateAsync({ appId: entry.app_id, mode });
      const message =
        result.status === "staged"
          ? `${entry.app_name} was staged for installation.`
          : `${entry.app_name} was installed.`;
      setInstallDialog({ status: "result", entry, message, plan: result.deployment_plan });
      setMessage(message);
    } catch (error) {
      const formatted = formatActionError(error);
      setActionError(formatted);
      setInstallDialog({ status: "error", entry, mode, error: formatted, plan });
    }
  };

  const handleDeleteCatalogEntry = async (entry: AppCatalogEntry) => {
    resetNotices();
    try {
      await deleteCatalogEntry.mutateAsync(entry.app_id);
      setMessage(`${entry.app_name} was removed from catalog.`);
    } catch (error) {
      setActionError(formatActionError(error));
    }
  };

  const handleSetCatalogEntryPublication = async (entry: AppCatalogEntry, published: boolean) => {
    resetNotices();
    try {
      const updated = await setCatalogEntryPublication.mutateAsync({ appId: entry.app_id, published });
      setMessage(`${updated.app_name} was ${updated.published ? "published to" : "removed from"} this instance feed.`);
    } catch (error) {
      setActionError(formatActionError(error));
    }
  };

  const handleActivateLicense = async (entry: AppCatalogEntry) => {
    resetNotices();
    if (!entry.license_issuer_url) {
      setSelectedAppId(entry.app_id);
      navigate("/core/apps/licensing");
      return;
    }

    try {
      const result = await startLicenseOAuth.mutateAsync({
        issuer: entry.license_issuer_url,
        app_id: entry.app_id,
        license_mode: "instance_bound",
        auto_select: true,
      });
      window.location.assign(result.redirect_url);
    } catch (error) {
      setActionError(formatActionError(error));
    }
  };

  const executeUninstall = async (app: InstalledApp) => {
    resetNotices();
    setUninstallState({ status: "running", app });

    try {
      await uninstallMutation.mutateAsync(app.app_id);
      setUninstallState({ status: "success" });
      setMessage(`${pickAppDisplayName(app)} was uninstalled.`);
    } catch (error) {
      const formatted = formatActionError(error);
      setActionError(formatted);
      setUninstallState({ status: "error", app, error: formatted });
    }
  };

  const resetUninstallState = () => {
    if (uninstallState.status === "running") {
      return;
    }
    setUninstallState({ status: "idle" });
    setUninstallConfirmChecked(false);
  };

  const handleRefreshArtifact = async (app: InstalledApp) => {
    resetNotices();
    try {
      await refreshArtifactMutation.mutateAsync(app.app_id);
      setMessage(`${pickAppDisplayName(app)} artifact was refreshed.`);
    } catch (error) {
      setActionError(formatActionError(error));
    }
  };

  const handleSetSelection = async () => {
    if (!effectiveSelectedAppId || !selectedEntitlementId) {
      return;
    }
    resetNotices();
    try {
      await setSelectionMutation.mutateAsync({ app_id: effectiveSelectedAppId, entitlement_id: selectedEntitlementId });
      setMessage("License selection was updated.");
    } catch (error) {
      setActionError(formatActionError(error));
    }
  };

  const handleClearSelection = async () => {
    if (!effectiveSelectedAppId) {
      return;
    }
    resetNotices();
    try {
      await clearSelectionMutation.mutateAsync({ app_id: effectiveSelectedAppId });
      setMessage("License selection was cleared.");
    } catch (error) {
      setActionError(formatActionError(error));
    }
  };

  const handleIngestOffline = async () => {
    if (!offlineToken.trim()) {
      return;
    }
    resetNotices();
    try {
      const result = await offlineIngestMutation.mutateAsync({ token: offlineToken.trim() });
      setOfflineToken("");
      setMessage(`Offline token ingest OK (${result.verification_result}).`);
    } catch (error) {
      setActionError(formatActionError(error));
    }
  };

  if (!canManageApps) {
    return (
      <Card>
        <div className="text-lg font-semibold">Apps</div>
        <div className="mt-2 text-sm text-hc-muted">Nemáš oprávnění pro správu aplikací.</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <ToastNotice
        message={toastMessage}
        tone={toastTone}
        onDismiss={() => {
          if (toastMessage && toastMessage === installedErrorMessage) {
            setDismissedInstalledError(installedErrorMessage);
          }
          setMessage(null);
          setActionError(null);
        }}
      />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-hc-muted">Admin</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal">Applications</h1>
          <p className="mt-1 text-sm text-hc-muted">Catalog discovery, instance installation, and tenant license activation.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-right">
          <Metric label="Catalog" value={catalog.length} />
          <Metric label="Installable" value={installableCount} />
          <Metric label="Published" value={publishedCount} />
        </div>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-hc-outline">
        {([
          ["catalog", "Catalog"],
          ["installed", "Installed"],
          ["licensing", "Licensing"],
        ] as Array<[Tab, string]>).map(([tab, label]) => (
          <button
            key={tab}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
              activeTab === tab
                ? "border-hc-primary text-hc-text"
                : "border-transparent text-hc-muted hover:text-hc-text"
            }`}
            onClick={() => navigate(tab === "catalog" ? "/core/apps" : `/core/apps/${tab}`)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "catalog" && (
        <div className="space-y-5">
          <CatalogSourcesPanel
            sources={catalogSources}
            isLoading={catalogSourcesLoading}
            form={sourceForm}
            setForm={setSourceForm}
            onCreate={handleCreateCatalogSource}
            onSync={handleSyncCatalogSource}
            onSetEnabled={handleSetCatalogSourceEnabled}
            isMutating={createCatalogSource.isPending || syncCatalogSource.isPending || setCatalogSourceEnabled.isPending}
          />

          <Card className="rounded-hc-md">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-72 flex-1">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-hc-muted">Manifest base URL</label>
                <Input
                  placeholder="https://apps.example.com/inventory"
                  value={catalogForm.base_url}
                  onChange={(event) => setCatalogForm((prev) => ({ ...prev, base_url: event.target.value }))}
                />
              </div>
              <div className="min-w-64 flex-1">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-hc-muted">Summary</label>
                <Input
                  placeholder="Short operator-facing note"
                  value={catalogForm.summary}
                  onChange={(event) => setCatalogForm((prev) => ({ ...prev, summary: event.target.value }))}
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-hc-muted">Trust</label>
                <Select
                  value={catalogForm.trust_status}
                  onChange={(event) =>
                    setCatalogForm((prev) => ({ ...prev, trust_status: event.target.value as "dev" | "manual" | "unverified" }))
                  }
                >
                  <option value="manual">manual</option>
                  <option value="dev">dev</option>
                  <option value="unverified">unverified</option>
                </Select>
              </div>
              <Button
                onClick={() => void handleCreateCatalogEntry()}
                disabled={!catalogForm.base_url.trim() || createCatalogEntry.isPending}
              >
                {createCatalogEntry.isPending ? "Fetching..." : "Add to catalog"}
              </Button>
            </div>
          </Card>

          <Card id="catalog" className="rounded-hc-md p-0">
            <div className="flex items-center justify-between border-b border-hc-outline px-5 py-4">
              <div>
                <div className="text-sm font-semibold">Available applications</div>
                <div className="mt-1 text-xs text-hc-muted">{licensedCatalogCount} require a tenant license.</div>
              </div>
              <Badge>{catalogLoading ? "Loading" : `${catalog.length} entries`}</Badge>
            </div>
            <CatalogTable
              entries={catalog}
              installedByAppId={installedByAppId}
              isLoading={catalogLoading}
              onInstall={openInstallDialog}
              onLicense={(appId) => {
                setSelectedAppId(appId);
                navigate("/core/apps/licensing");
              }}
              onActivateLicense={handleActivateLicense}
              onDelete={handleDeleteCatalogEntry}
              onSetPublication={handleSetCatalogEntryPublication}
              isMutating={
                installCatalogEntry.isPending ||
                deleteCatalogEntry.isPending ||
                setCatalogEntryPublication.isPending ||
                startLicenseOAuth.isPending
              }
            />
          </Card>
        </div>
      )}

      {activeTab === "installed" && (
        <Card id="installed" className="rounded-hc-md p-0">
          <div className="flex items-center justify-between border-b border-hc-outline px-5 py-4">
            <div>
              <div className="text-sm font-semibold">Installed applications</div>
              <div className="mt-1 text-xs text-hc-muted">Runtime state for this Core instance.</div>
            </div>
            <Badge>{installedLoading ? "Loading" : `${installed.length} installed`}</Badge>
          </div>
          <InstalledTable
            apps={installed}
            registrySlugs={registrySlugs}
            isLoading={installedLoading}
            onLicense={(appId) => {
              setSelectedAppId(appId);
              navigate("/core/apps/licensing");
            }}
            onRefreshArtifact={handleRefreshArtifact}
            onUninstall={(app) => {
              setUninstallConfirmChecked(false);
              setUninstallState({ status: "confirm", app });
            }}
            isMutating={refreshArtifactMutation.isPending}
          />
        </Card>
      )}

      {activeTab === "licensing" && (
        <Card id="licensing" className="rounded-hc-md">
          <div className="grid gap-5 lg:grid-cols-[minmax(260px,360px)_1fr]">
            <section>
              <div className="text-sm font-semibold">Tenant license selection</div>
              <div className="mt-3">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-hc-muted">Application</label>
                <Select
                  value={effectiveSelectedAppId ?? ""}
                  onChange={(event) => {
                    setSelectedAppId(event.target.value || null);
                    setSelectedEntitlementId("");
                  }}
                >
                  <option value="">Select app</option>
                  {installed.map((app) => (
                    <option key={app.app_id} value={app.app_id}>
                      {pickAppDisplayName(app)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="mt-3">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-hc-muted">Stored license</label>
                <Select
                  value={selectedEntitlementId}
                  onChange={(event) => setSelectedEntitlementId(event.target.value)}
                >
                  <option value="">Fallback selection</option>
                  {(entitlementsData?.items ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.source} / {item.tier} / {formatDate(item.valid_to)}
                      {entitlementsData?.selected_entitlement_id === item.id ? " [selected]" : ""}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => void handleSetSelection()} disabled={!selectedEntitlementId || setSelectionMutation.isPending}>
                  Set selection
                </Button>
                <Button variant="outlined" onClick={() => void handleClearSelection()} disabled={!effectiveSelectedAppId || clearSelectionMutation.isPending}>
                  Clear
                </Button>
              </div>
            </section>

            <section>
              <div className="text-sm font-semibold">Offline import</div>
              <textarea
                className="mt-3 min-h-40 w-full rounded-hc-md border border-hc-outline bg-hc-surface px-3 py-2 text-sm text-hc-text placeholder:text-hc-muted focus:border-hc-primary focus:outline-none focus:ring-2 focus:ring-hc-primary/20"
                value={offlineToken}
                onChange={(event) => setOfflineToken(event.target.value)}
                placeholder="Paste license bundle or token"
              />
              <div className="mt-3 flex justify-end">
                <Button onClick={() => void handleIngestOffline()} disabled={!offlineToken.trim() || offlineIngestMutation.isPending}>
                  {offlineIngestMutation.isPending ? "Importing..." : "Import license"}
                </Button>
              </div>
            </section>
          </div>
        </Card>
      )}

      <UninstallDialog
        state={uninstallState}
        confirmChecked={uninstallConfirmChecked}
        setConfirmChecked={setUninstallConfirmChecked}
        onClose={resetUninstallState}
        onConfirm={executeUninstall}
      />
      <CatalogInstallDialog
        state={installDialog}
        onModeChange={setInstallMode}
        onClose={closeInstallDialog}
        onConfirm={executeCatalogInstall}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-24 rounded-hc-md border border-hc-outline bg-hc-surface px-3 py-2">
      <div className="text-lg font-semibold leading-none">{value}</div>
      <div className="mt-1 text-xs text-hc-muted">{label}</div>
    </div>
  );
}

function CatalogSourcesPanel({
  sources,
  isLoading,
  form,
  setForm,
  onCreate,
  onSync,
  onSetEnabled,
  isMutating,
}: {
  sources: AppCatalogSource[];
  isLoading: boolean;
  form: { name: string; feed_url: string; trust_mode: AppCatalogSource["trust_mode"] };
  setForm: React.Dispatch<React.SetStateAction<{ name: string; feed_url: string; trust_mode: AppCatalogSource["trust_mode"] }>>;
  onCreate: () => Promise<void>;
  onSync: (source: AppCatalogSource) => Promise<void>;
  onSetEnabled: (source: AppCatalogSource, isEnabled: boolean) => Promise<void>;
  isMutating: boolean;
}) {
  return (
    <Card id="catalog-feeds" className="rounded-hc-md p-0">
      <div className="flex items-center justify-between border-b border-hc-outline px-5 py-4">
        <div>
          <div className="text-sm font-semibold">Catalog feeds</div>
          <div className="mt-1 text-xs text-hc-muted">Remote feeds that can populate the local catalog.</div>
        </div>
        <Badge>{isLoading ? "Loading" : `${sources.length} sources`}</Badge>
      </div>

      <div className="grid gap-3 border-b border-hc-outline px-5 py-4 lg:grid-cols-[minmax(180px,260px)_1fr_auto_auto]">
        <Input
          placeholder="Feed name"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
        />
        <Input
          placeholder="https://catalog.example/.well-known/hc/app-catalog.json"
          value={form.feed_url}
          onChange={(event) => setForm((prev) => ({ ...prev, feed_url: event.target.value }))}
        />
        <select
          className="h-10 rounded-hc-md border border-hc-outline bg-hc-surface px-3 text-sm text-hc-text"
          value={form.trust_mode}
          onChange={(event) => setForm((prev) => ({ ...prev, trust_mode: event.target.value as AppCatalogSource["trust_mode"] }))}
        >
          <option value="manual">manual</option>
          <option value="dev">dev</option>
          <option value="verified">verified</option>
          <option value="official">official</option>
        </select>
        <Button onClick={() => void onCreate()} disabled={!form.name.trim() || !form.feed_url.trim() || isMutating}>
          Add feed
        </Button>
      </div>

      {sources.length === 0 ? (
        <div className="px-5 py-5 text-sm text-hc-muted">No feed sources yet.</div>
      ) : (
        <div className="divide-y divide-hc-outline/70">
          {sources.map((source) => (
            <div key={source.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-medium">{source.name}</div>
                  <Badge tone={source.is_enabled ? "good" : "neutral"}>{source.is_enabled ? "enabled" : "disabled"}</Badge>
                  <Badge>{source.trust_mode}</Badge>
                </div>
                <div className="mt-1 break-all text-xs text-hc-muted">{source.feed_url}</div>
                <div className="mt-1 text-xs text-hc-muted">
                  Last sync: {formatDate(source.last_sync_at)}
                  {source.last_error ? ` / ${source.last_error}` : ""}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outlined" disabled={!source.is_enabled || isMutating} onClick={() => void onSync(source)}>
                  Sync
                </Button>
                <Button
                  variant="ghost"
                  disabled={isMutating}
                  onClick={() => void onSetEnabled(source, !source.is_enabled)}
                >
                  {source.is_enabled ? "Disable" : "Enable"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function CatalogTable({
  entries,
  installedByAppId,
  isLoading,
  onInstall,
  onLicense,
  onActivateLicense,
  onDelete,
  onSetPublication,
  isMutating,
}: {
  entries: AppCatalogEntry[];
  installedByAppId: Map<string, InstalledApp>;
  isLoading: boolean;
  onInstall: (entry: AppCatalogEntry) => void;
  onLicense: (appId: string) => void;
  onActivateLicense: (entry: AppCatalogEntry) => Promise<void>;
  onDelete: (entry: AppCatalogEntry) => Promise<void>;
  onSetPublication: (entry: AppCatalogEntry, published: boolean) => Promise<void>;
  isMutating: boolean;
}) {
  if (isLoading) {
    return <div className="px-5 py-6 text-sm text-hc-muted">Loading catalog...</div>;
  }

  if (entries.length === 0) {
    return <div className="px-5 py-6 text-sm text-hc-muted">No catalog entries yet.</div>;
  }

  return (
    <Table className="rounded-none shadow-none">
      <thead className="border-b border-hc-outline text-xs uppercase tracking-wide text-hc-muted">
        <tr>
          <th className="px-5 py-3 font-semibold">Application</th>
          <th className="px-5 py-3 font-semibold">Source</th>
          <th className="px-5 py-3 font-semibold">License</th>
          <th className="px-5 py-3 font-semibold">Status</th>
          <th className="px-5 py-3 font-semibold">Actions</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => {
          const installed = installedByAppId.get(entry.app_id);
          const runtimeStatus = getCatalogRuntimeStatus(entry);
          const needsLicenseAction =
            Boolean(entry.installed) && entry.license_state.required && !entry.license_state.selected_active_license;
          const canPublish = Boolean(installed?.enabled !== false && installed);
          return (
            <tr key={entry.app_id} className="border-b border-hc-outline/70 align-top last:border-b-0">
              <td className="px-5 py-4">
                <div className="font-medium">{entry.app_name}</div>
                <div className="mt-1 text-xs text-hc-muted">{entry.app_id}</div>
                {entry.summary && <div className="mt-2 max-w-xl text-xs text-hc-muted">{entry.summary}</div>}
              </td>
              <td className="px-5 py-4 text-sm">
                <div>{entry.source_type}</div>
                <div className="mt-1 text-xs text-hc-muted">{entry.namespace ?? "no namespace"}</div>
              </td>
              <td className="px-5 py-4">
                {entry.license_required ? <Badge tone="warn">required</Badge> : <Badge tone="good">free</Badge>}
              </td>
              <td className="px-5 py-4">
                <div className="flex flex-col gap-2">
                  <Badge tone={entry.trust_status === "official" || entry.trust_status === "verified" ? "good" : "neutral"}>
                    {entry.trust_status}
                  </Badge>
                  <div>
                    <Badge tone={runtimeStatus.tone}>{runtimeStatus.label}</Badge>
                    {runtimeStatus.detail && <div className="mt-1 max-w-48 text-xs text-hc-muted">{runtimeStatus.detail}</div>}
                  </div>
                  {entry.published ? <Badge tone="good">feed</Badge> : <Badge>{entry.publish_status}</Badge>}
                </div>
              </td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap gap-2">
                  {installed ? (
                    needsLicenseAction ? (
                      <Button
                        variant="tonal"
                        disabled={isMutating}
                        onClick={() => {
                          if (entry.license_issuer_url) {
                            void onActivateLicense(entry);
                            return;
                          }
                          onLicense(entry.app_id);
                        }}
                      >
                        {entry.license_issuer_url ? "Activate" : "Licensing"}
                      </Button>
                    ) : (
                      <Button variant="outlined" disabled>
                        Installed
                      </Button>
                    )
                  ) : (
                    <Button variant="outlined" disabled={isMutating} onClick={() => onInstall(entry)}>
                      Install...
                    </Button>
                  )}
                  <Button
                    variant={entry.published ? "tonal" : "outlined"}
                    disabled={isMutating || (!entry.published && !canPublish)}
                    onClick={() => void onSetPublication(entry, !entry.published)}
                  >
                    {entry.published ? "Unpublish" : "Publish"}
                  </Button>
                  <Button variant="ghost" disabled={isMutating} onClick={() => void onDelete(entry)}>
                    Remove
                  </Button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

function InstalledTable({
  apps,
  registrySlugs,
  isLoading,
  onLicense,
  onRefreshArtifact,
  onUninstall,
  isMutating,
}: {
  apps: InstalledApp[];
  registrySlugs: Set<string>;
  isLoading: boolean;
  onLicense: (appId: string) => void;
  onRefreshArtifact: (app: InstalledApp) => Promise<void>;
  onUninstall: (app: InstalledApp) => void;
  isMutating: boolean;
}) {
  if (isLoading) {
    return <div className="px-5 py-6 text-sm text-hc-muted">Loading installed apps...</div>;
  }

  if (apps.length === 0) {
    return <div className="px-5 py-6 text-sm text-hc-muted">No installed apps.</div>;
  }

  return (
    <Table className="rounded-none shadow-none">
      <thead className="border-b border-hc-outline text-xs uppercase tracking-wide text-hc-muted">
        <tr>
          <th className="px-5 py-3 font-semibold">Application</th>
          <th className="px-5 py-3 font-semibold">Runtime</th>
          <th className="px-5 py-3 font-semibold">Entitlement</th>
          <th className="px-5 py-3 font-semibold">Actions</th>
        </tr>
      </thead>
      <tbody>
        {apps.map((app) => {
          const status = getInstalledStatus(app, registrySlugs);
          return (
            <tr key={app.app_id} className="border-b border-hc-outline/70 align-top last:border-b-0">
              <td className="px-5 py-4">
                <div className="font-medium">{pickAppDisplayName(app)}</div>
                <div className="mt-1 text-xs text-hc-muted">{app.app_id}</div>
              </td>
              <td className="px-5 py-4">
                <Badge tone={status.tone}>{status.label}</Badge>
                {status.detail && <div className="mt-2 max-w-md text-xs text-hc-muted">{status.detail}</div>}
              </td>
              <td className="px-5 py-4 text-sm">
                {app.resolved_entitlement ? (
                  <div>
                    <div>{app.resolved_entitlement.tier}</div>
                    <div className="mt-1 text-xs text-hc-muted">valid to {formatDate(app.resolved_entitlement.valid_to)}</div>
                  </div>
                ) : (
                  <span className="text-hc-muted">none selected</span>
                )}
              </td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap gap-2">
                  <Button variant="tonal" onClick={() => onLicense(app.app_id)}>
                    Licensing
                  </Button>
                  <Button variant="outlined" disabled={isMutating} onClick={() => void onRefreshArtifact(app)}>
                    Refresh artifact
                  </Button>
                  <Button variant="outlined" onClick={() => onUninstall(app)}>
                    Uninstall
                  </Button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

function CatalogInstallDialog({
  state,
  onModeChange,
  onClose,
  onConfirm,
}: {
  state: InstallDialogState;
  onModeChange: (mode: InstallCatalogEntryMode) => void;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  if (state.status === "idle") {
    return null;
  }

  const entry = state.entry;
  const plan = state.plan;
  const mode = state.status === "result" ? undefined : state.mode;
  const isRunning = state.status === "running";

  return (
    <Dialog open title="Install app" disableClose={isRunning} onClose={onClose}>
      <div>
        <div className="text-lg font-semibold">Install {entry.app_name}</div>
        <div className="mt-3 rounded-hc-md border border-hc-outline bg-hc-surface-variant p-3">
          <div className="text-sm font-medium">{entry.app_id}</div>
          <div className="mt-1 text-xs text-hc-muted">{entry.base_url}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {entry.license_required ? <Badge tone="warn">license required</Badge> : <Badge tone="good">free</Badge>}
            <Badge>{entry.trust_status}</Badge>
          </div>
        </div>

        {state.status !== "result" && (
          <div className="mt-4 grid gap-2">
            {[
              ["external", "External service", "Install the app registry record and use its existing base URL."],
              ["stage_only", "Stage only", "Save the selected plan without installing the runtime registry entry."],
              ["compose", "Core-managed compose", "Let Core approve and run the app compose bundle when runtime support exists."],
            ].map(([value, label, description]) => (
              <label
                key={value}
                className={`flex cursor-pointer items-start gap-3 rounded-hc-md border p-3 text-sm transition ${
                  mode === value ? "border-hc-primary bg-hc-primary/5" : "border-hc-outline bg-hc-surface"
                }`}
              >
                <input
                  type="radio"
                  className="mt-1"
                  checked={mode === value}
                  onChange={() => onModeChange(value as InstallCatalogEntryMode)}
                  disabled={isRunning}
                />
                <span>
                  <span className="block font-medium">{label}</span>
                  <span className="mt-1 block text-xs text-hc-muted">{description}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="mt-4 rounded-hc-md border border-hc-outline bg-hc-surface p-3 text-xs">
          <div className="font-semibold uppercase tracking-wide text-hc-muted">Deployment plan</div>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            <PlanItem label="Mode" value={plan.mode} />
            <PlanItem label="Service" value={plan.service_name} />
            <PlanItem label="Internal URL" value={plan.internal_base_url} />
            <PlanItem label="Compose project" value={plan.compose_project} />
            <PlanItem label="Compose file" value={plan.compose_file ?? "not declared"} />
            <PlanItem label="Host access" value={plan.host_mounts_allowed ? "allowed" : "blocked"} />
          </dl>
        </div>

        {state.status === "running" && <div className="mt-4 text-sm text-hc-muted">Installation is running...</div>}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isRunning}>
            {state.status === "result" ? "Close" : "Cancel"}
          </Button>
          {state.status !== "result" && (
            <Button onClick={() => void onConfirm()} disabled={isRunning}>
              {isRunning ? "Running..." : "Approve"}
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}

function PlanItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-hc-muted">{label}</dt>
      <dd className="mt-1 break-words font-medium text-hc-text">{value}</dd>
    </div>
  );
}

function UninstallDialog({
  state,
  confirmChecked,
  setConfirmChecked,
  onClose,
  onConfirm,
}: {
  state: UninstallState;
  confirmChecked: boolean;
  setConfirmChecked: (value: boolean) => void;
  onClose: () => void;
  onConfirm: (app: InstalledApp) => Promise<void>;
}) {
  return (
    <Dialog open={state.status !== "idle"} title="Uninstall app" disableClose={state.status === "running"} onClose={onClose}>
      {state.status === "confirm" && (
        <div>
          <div className="text-lg font-semibold">Confirm uninstall</div>
          <div className="mt-3 rounded-hc-md border border-hc-outline bg-hc-surface-variant p-3 text-sm">
            <div className="font-medium">{pickAppDisplayName(state.app)}</div>
            <div className="mt-1 text-xs text-hc-muted">{state.app.app_id}</div>
          </div>
          <label className="mt-4 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={confirmChecked}
              onChange={(event) => setConfirmChecked(event.target.checked)}
            />
            <span>Remove this app from the runtime installation registry.</span>
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="danger" disabled={!confirmChecked} onClick={() => void onConfirm(state.app)}>
              Uninstall
            </Button>
          </div>
        </div>
      )}

      {state.status === "running" && <div className="text-sm text-hc-muted">Uninstall is running...</div>}

      {state.status === "success" && (
        <div>
          <div className="text-lg font-semibold">Uninstall completed</div>
          <div className="mt-5 flex justify-end">
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      )}

      {state.status === "error" && (
        <div>
          <div className="text-lg font-semibold text-hc-danger">Uninstall failed</div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button variant="danger" onClick={() => void onConfirm(state.app)}>
              Retry
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
