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
  useRefreshCatalogEntryFromInstalledMutation,
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
  useCheckInstalledAppUpdateMutation,
  useClearInstalledAppUpdateSignalMutation,
  useIssueInstalledAppTokenMutation,
  useInstalledAppsQuery,
  useRefreshInstalledAppArtifactMutation,
  useUninstallAppMutation,
  type IssueInstalledAppTokenResponse,
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
import { Field, MetricStrip, PageHeader, SectionHeader } from "../../ui-kit/components/Page";
import { Select } from "../../ui-kit/components/Select";
import { Table } from "../../ui-kit/components/Table";
import { TabBar } from "../../ui-kit/components/TabBar";
import { Textarea } from "../../ui-kit/components/Textarea";
import { ToastNotice } from "../../ui-kit/components/ToastNotice";

type Tab = "catalog" | "feeds" | "installed" | "licensing";

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

type AppTokenDialogState =
  | { status: "idle" }
  | { status: "issued"; app: InstalledApp; token: IssueInstalledAppTokenResponse };

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
  if (pathname.startsWith("/core/apps/feeds")) {
    return "feeds";
  }
  if (pathname.startsWith("/core/apps/installed")) {
    return "installed";
  }
  if (pathname.endsWith("/licensing")) {
    return "licensing";
  }
  return "catalog";
}

function readCatalogDetailId(pathname: string) {
  const marker = "/core/apps/catalog/";
  if (!pathname.startsWith(marker)) return null;
  return decodeURIComponent(pathname.slice(marker.length).split("/")[0] ?? "") || null;
}

function readInstalledDetailId(pathname: string) {
  const marker = "/core/apps/installed/";
  if (!pathname.startsWith(marker)) return null;
  return decodeURIComponent(pathname.slice(marker.length).split("/")[0] ?? "") || null;
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
  const refreshCatalogFromInstalled = useRefreshCatalogEntryFromInstalledMutation();
  const createCatalogSource = useCreateCatalogSourceMutation();
  const setCatalogSourceEnabled = useSetCatalogSourceEnabledMutation();
  const syncCatalogSource = useSyncCatalogSourceMutation();
  const deleteCatalogEntry = useDeleteCatalogEntryMutation();
  const installCatalogEntry = useInstallCatalogEntryMutation();
  const setCatalogEntryPublication = useSetCatalogEntryPublicationMutation();
  const uninstallMutation = useUninstallAppMutation();
  const refreshArtifactMutation = useRefreshInstalledAppArtifactMutation();
  const checkUpdateMutation = useCheckInstalledAppUpdateMutation();
  const clearUpdateSignalMutation = useClearInstalledAppUpdateSignalMutation();
  const issueAppTokenMutation = useIssueInstalledAppTokenMutation();
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
  const [appTokenDialog, setAppTokenDialog] = useState<AppTokenDialogState>({ status: "idle" });
  const [uninstallState, setUninstallState] = useState<UninstallState>({ status: "idle" });
  const [uninstallConfirmChecked, setUninstallConfirmChecked] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [installedSearch, setInstalledSearch] = useState("");

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
  const availableCatalogUpdates = installed.filter((item) => item.catalog_update?.state === "available");
  const staleCatalogSnapshots = installed.filter((item) => item.catalog_update?.state === "stale");
  const reportedUpdateSignals = installed.filter((item) => item.update_signal);
  const hasUpdateSignals =
    availableCatalogUpdates.length > 0 || staleCatalogSnapshots.length > 0 || reportedUpdateSignals.length > 0;
  const activeTab = readTabFromPath(location.pathname);
  const catalogDetailId = readCatalogDetailId(location.pathname);
  const installedDetailId = readInstalledDetailId(location.pathname);
  const catalogDetail = catalog.find((entry) => entry.app_id === catalogDetailId) ?? null;
  const installedDetail = installed.find((app) => app.app_id === installedDetailId) ?? null;
  const filteredCatalog = useMemo(() => {
    const query = catalogSearch.trim().toLowerCase();
    if (!query) return catalog;
    return catalog.filter((entry) => [entry.app_id, entry.app_name, entry.summary ?? "", entry.namespace ?? ""].some((value) => value.toLowerCase().includes(query)));
  }, [catalog, catalogSearch]);
  const filteredInstalled = useMemo(() => {
    const query = installedSearch.trim().toLowerCase();
    if (!query) return installed;
    return installed.filter((app) => [app.app_id, pickAppDisplayName(app), app.slug].some((value) => value.toLowerCase().includes(query)));
  }, [installed, installedSearch]);
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

  const handleCheckUpdate = async (app: InstalledApp) => {
    resetNotices();
    try {
      const result = await checkUpdateMutation.mutateAsync(app.app_id);
      if (result.update_available === true) {
        setMessage(
          `${pickAppDisplayName(app)} has an update available (${result.installed.app_version ?? "unknown"} -> ${result.fetched.app_version}).`,
        );
      } else if (result.update_available === false) {
        setMessage(`${pickAppDisplayName(app)} is up to date (${result.fetched.app_version}).`);
      } else {
        setMessage(`${pickAppDisplayName(app)} update state is unknown. Refresh artifact once to store a baseline manifest hash.`);
      }
    } catch (error) {
      setActionError(formatActionError(error));
    }
  };

  const handleRefreshCatalogFromInstalled = async (app: InstalledApp) => {
    resetNotices();
    try {
      const entry = await refreshCatalogFromInstalled.mutateAsync(app.app_id);
      setMessage(`${entry.app_name} catalog entry was refreshed from installed app.`);
    } catch (error) {
      setActionError(formatActionError(error));
    }
  };

  const handleClearUpdateSignal = async (app: InstalledApp) => {
    resetNotices();
    try {
      await clearUpdateSignalMutation.mutateAsync(app.app_id);
      setMessage(`${pickAppDisplayName(app)} update signal was cleared.`);
    } catch (error) {
      setActionError(formatActionError(error));
    }
  };

  const handleIssueAppToken = async (app: InstalledApp) => {
    resetNotices();
    try {
      const token = await issueAppTokenMutation.mutateAsync(app.app_id);
      setAppTokenDialog({ status: "issued", app, token });
      setMessage(`${pickAppDisplayName(app)} app token was issued.`);
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
        <div className="mt-2 text-sm text-hc-muted">You do not have permission to manage applications.</div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
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

      <PageHeader
        eyebrow="Admin"
        title="Applications"
        description="Catalog discovery, instance installation, and tenant license activation."
        actions={<MetricStrip items={[
          { label: "Catalog", value: catalog.length },
          { label: "Installable", value: installableCount },
          { label: "Published", value: publishedCount },
        ]} />}
      />

      {hasUpdateSignals && (
        <Card className="rounded-hc-md border-hc-primary/25 bg-hc-primary/5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-semibold">Application update attention</div>
                {reportedUpdateSignals.length > 0 && (
                  <Badge tone="warn">{reportedUpdateSignals.length} app signal reported</Badge>
                )}
                {availableCatalogUpdates.length > 0 && (
                  <Badge tone="warn">{availableCatalogUpdates.length} catalog update available</Badge>
                )}
                {staleCatalogSnapshots.length > 0 && (
                  <Badge tone="neutral">{staleCatalogSnapshots.length} catalog snapshot stale</Badge>
                )}
              </div>
              <div className="mt-2 max-w-3xl text-sm text-hc-muted">
                Installed apps can report update signals, and Core compares them with matching catalog entries. Review
                signals before refreshing artifacts; clear signals that are informational or already handled.
              </div>
            </div>
            <Button variant="outlined" onClick={() => navigate("/core/apps/installed")}>
              Review installed apps
            </Button>
          </div>
        </Card>
      )}

      <TabBar
        active={activeTab}
        items={[
          { id: "catalog", label: "Catalog", count: catalog.length },
          { id: "feeds", label: "Feed sources", count: catalogSources.length },
          { id: "installed", label: "Installed", count: installed.length },
          { id: "licensing", label: "Licensing" },
        ]}
        onChange={(tab) => navigate(tab === "catalog" ? "/core/apps" : `/core/apps/${tab}`)}
      />

      {activeTab === "feeds" && (
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
      )}

      {activeTab === "catalog" && (
        catalogDetailId ? (
          catalogDetail ? <CatalogAppDetail
            entry={catalogDetail}
            installed={installedByAppId.get(catalogDetail.app_id)}
            onBack={() => navigate("/core/apps")}
            onInstall={openInstallDialog}
            onLicense={(appId) => { setSelectedAppId(appId); navigate("/core/apps/licensing"); }}
            onActivateLicense={handleActivateLicense}
            onDelete={handleDeleteCatalogEntry}
            onSetPublication={handleSetCatalogEntryPublication}
            isMutating={installCatalogEntry.isPending || deleteCatalogEntry.isPending || setCatalogEntryPublication.isPending || startLicenseOAuth.isPending}
          /> : <Card><div className="text-sm text-hc-muted">Application not found.</div></Card>
        ) : <div className="space-y-4">
          <Card className="overflow-hidden p-0">
            <SectionHeader title="Add application" description="Fetch an application manifest directly into the local catalog." />
            <div className="flex flex-wrap items-end gap-3 border-t border-hc-outline p-4">
              <Field label="Manifest base URL" className="min-w-72 flex-1">
                <Input
                  placeholder="https://apps.example.com/inventory"
                  value={catalogForm.base_url}
                  onChange={(event) => setCatalogForm((prev) => ({ ...prev, base_url: event.target.value }))}
                />
              </Field>
              <Field label="Summary" className="min-w-64 flex-1">
                <Input
                  placeholder="Short operator-facing note"
                  value={catalogForm.summary}
                  onChange={(event) => setCatalogForm((prev) => ({ ...prev, summary: event.target.value }))}
                />
              </Field>
              <Field label="Trust">
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
              </Field>
              <Button
                onClick={() => void handleCreateCatalogEntry()}
                disabled={!catalogForm.base_url.trim() || createCatalogEntry.isPending}
              >
                {createCatalogEntry.isPending ? "Fetching..." : "Add to catalog"}
              </Button>
            </div>
          </Card>

          <Card id="catalog" className="rounded-hc-md p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hc-outline px-4 py-3">
              <div>
                <div className="text-sm font-semibold">Available applications</div>
                <div className="mt-1 text-xs text-hc-muted">{licensedCatalogCount} require a tenant license.</div>
              </div>
              <Badge>{catalogLoading ? "Loading" : `${catalog.length} entries`}</Badge>
            </div>
            <div className="border-b border-hc-outline p-3"><Input value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Search catalog" /></div>
            <CatalogTable
              entries={filteredCatalog}
              installedByAppId={installedByAppId}
              isLoading={catalogLoading}
              onInstall={openInstallDialog}
              onOpen={(entry) => navigate(`/core/apps/catalog/${encodeURIComponent(entry.app_id)}`)}
              isMutating={installCatalogEntry.isPending}
            />
          </Card>
        </div>
      )}

      {activeTab === "installed" && (
        installedDetailId ? (
          installedDetail ? <InstalledAppDetail
            app={installedDetail}
            registrySlugs={registrySlugs}
            onBack={() => navigate("/core/apps/installed")}
            onLicense={(appId) => { setSelectedAppId(appId); navigate("/core/apps/licensing"); }}
            onCheckUpdate={handleCheckUpdate}
            onClearUpdateSignal={handleClearUpdateSignal}
            onIssueAppToken={handleIssueAppToken}
            onRefreshCatalog={handleRefreshCatalogFromInstalled}
            onRefreshArtifact={handleRefreshArtifact}
            onUninstall={(app) => { setUninstallConfirmChecked(false); setUninstallState({ status: "confirm", app }); }}
            isMutating={checkUpdateMutation.isPending || clearUpdateSignalMutation.isPending || issueAppTokenMutation.isPending || refreshArtifactMutation.isPending || refreshCatalogFromInstalled.isPending}
          /> : <Card><div className="text-sm text-hc-muted">Installed application not found.</div></Card>
        ) : <Card id="installed" className="rounded-hc-md p-0">
          <div className="flex items-center justify-between border-b border-hc-outline px-5 py-4">
            <div>
              <div className="text-sm font-semibold">Installed applications</div>
              <div className="mt-1 text-xs text-hc-muted">Runtime state for this Core instance.</div>
            </div>
            <Badge>{installedLoading ? "Loading" : `${installed.length} installed`}</Badge>
          </div>
          <div className="border-b border-hc-outline p-3"><Input value={installedSearch} onChange={(event) => setInstalledSearch(event.target.value)} placeholder="Search installed applications" /></div>
          <InstalledTable
            apps={filteredInstalled}
            registrySlugs={registrySlugs}
            isLoading={installedLoading}
            onLicense={(appId) => {
              setSelectedAppId(appId);
              navigate("/core/apps/licensing");
            }}
            onOpen={(app) => navigate(`/core/apps/installed/${encodeURIComponent(app.app_id)}`)}
          />
        </Card>
      )}

      {activeTab === "licensing" && (
        <Card id="licensing" className="rounded-hc-md">
          <div className="grid gap-5 lg:grid-cols-[minmax(260px,360px)_1fr]">
            <section>
              <div className="text-sm font-semibold">Tenant license selection</div>
              <Field label="Application" className="mt-3">
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
              </Field>
              <Field label="Stored license" className="mt-3">
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
              </Field>
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
              <Textarea
                className="mt-3 min-h-40"
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
      <AppTokenDialog
        state={appTokenDialog}
        onClose={() => setAppTokenDialog({ status: "idle" })}
      />
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

function CatalogAppDetail({
  entry,
  installed,
  onBack,
  onInstall,
  onLicense,
  onActivateLicense,
  onDelete,
  onSetPublication,
  isMutating,
}: {
  entry: AppCatalogEntry;
  installed?: InstalledApp;
  onBack: () => void;
  onInstall: (entry: AppCatalogEntry) => void;
  onLicense: (appId: string) => void;
  onActivateLicense: (entry: AppCatalogEntry) => Promise<void>;
  onDelete: (entry: AppCatalogEntry) => Promise<void>;
  onSetPublication: (entry: AppCatalogEntry, published: boolean) => Promise<void>;
  isMutating: boolean;
}) {
  const runtimeStatus = getCatalogRuntimeStatus(entry);
  const needsLicenseAction = Boolean(installed) && entry.license_state.required && !entry.license_state.selected_active_license;
  const canPublish = Boolean(installed?.enabled !== false && installed);

  return (
    <Card className="overflow-hidden p-0">
      <SectionHeader
        title={entry.app_name}
        description={entry.app_id}
        meta={<Button size="sm" variant="outlined" onClick={onBack}>Back to catalog</Button>}
      />
      <div className="flex flex-wrap gap-1.5 border-t border-hc-outline px-4 py-3">
        <Badge tone={entry.trust_status === "official" || entry.trust_status === "verified" ? "good" : "neutral"}>{entry.trust_status}</Badge>
        <Badge tone={runtimeStatus.tone}>{runtimeStatus.label}</Badge>
        {entry.license_required ? <Badge tone="warn">license required</Badge> : <Badge tone="good">free</Badge>}
        {entry.published ? <Badge tone="good">published to feed</Badge> : <Badge>{entry.publish_status}</Badge>}
      </div>
      <dl className="grid border-t border-hc-outline md:grid-cols-2">
        <DetailCell label="Source" value={`${entry.source_type} · ${entry.namespace ?? "no namespace"}`} />
        <DetailCell label="Runtime" value={runtimeStatus.detail ?? runtimeStatus.label} />
        <DetailCell label="Summary" value={entry.summary ?? "No summary"} />
        <DetailCell label="License issuer" value={entry.license_issuer_url ?? "Not configured"} />
      </dl>
      <div className="flex flex-wrap justify-end gap-2 border-t border-hc-outline px-4 py-3">
        {!installed && <Button variant="outlined" disabled={isMutating} onClick={() => onInstall(entry)}>Install application</Button>}
        {installed && needsLicenseAction && <Button variant="tonal" disabled={isMutating} onClick={() => entry.license_issuer_url ? void onActivateLicense(entry) : onLicense(entry.app_id)}>{entry.license_issuer_url ? "Activate license" : "Open licensing"}</Button>}
        <Button variant={entry.published ? "tonal" : "outlined"} disabled={isMutating || (!entry.published && !canPublish)} onClick={() => void onSetPublication(entry, !entry.published)}>{entry.published ? "Unpublish" : "Publish"}</Button>
        <Button variant="ghost" disabled={isMutating} onClick={() => void onDelete(entry).then(onBack)}>Remove from catalog</Button>
      </div>
    </Card>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-hc-outline px-4 py-3 last:border-b-0 md:odd:border-r">
      <dt className="text-xs font-medium text-hc-muted">{label}</dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  );
}

function CatalogTable({
  entries,
  installedByAppId,
  isLoading,
  onInstall,
  onOpen,
  isMutating,
}: {
  entries: AppCatalogEntry[];
  installedByAppId: Map<string, InstalledApp>;
  isLoading: boolean;
  onInstall: (entry: AppCatalogEntry) => void;
  onOpen: (entry: AppCatalogEntry) => void;
  isMutating: boolean;
}) {
  if (isLoading) {
    return <div className="px-5 py-6 text-sm text-hc-muted">Loading catalog...</div>;
  }

  if (entries.length === 0) {
    return <div className="px-5 py-6 text-sm text-hc-muted">No catalog entries yet.</div>;
  }

  return (
    <Table className="rounded-none border-0 shadow-none">
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
          return (
            <tr key={entry.app_id}>
              <td>
                <div className="font-medium">{entry.app_name}</div>
                <div className="truncate text-xs text-hc-muted" title={entry.app_id}>{entry.app_id}</div>
              </td>
              <td className="text-sm">
                <span>{entry.source_type}</span><span className="ml-2 text-xs text-hc-muted">{entry.namespace ?? "no namespace"}</span>
              </td>
              <td>
                {entry.license_required ? <Badge tone="warn">required</Badge> : <Badge tone="good">free</Badge>}
              </td>
              <td>
                <div className="flex flex-wrap gap-1.5" title={runtimeStatus.detail ?? undefined}>
                  <Badge tone={entry.trust_status === "official" || entry.trust_status === "verified" ? "good" : "neutral"}>
                    {entry.trust_status}
                  </Badge>
                  <Badge tone={runtimeStatus.tone}>{runtimeStatus.label}</Badge>
                  {entry.published ? <Badge tone="good">feed</Badge> : <Badge>{entry.publish_status}</Badge>}
                </div>
              </td>
              <td>
                <div className="flex justify-end gap-1.5">
                  {!installed && <Button size="sm" variant="outlined" disabled={isMutating} onClick={() => onInstall(entry)}>Install</Button>}
                  <Button size="sm" variant="ghost" onClick={() => onOpen(entry)}>Open</Button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

function InstalledAppDetail({
  app,
  registrySlugs,
  onBack,
  onLicense,
  onCheckUpdate,
  onClearUpdateSignal,
  onIssueAppToken,
  onRefreshCatalog,
  onRefreshArtifact,
  onUninstall,
  isMutating,
}: {
  app: InstalledApp;
  registrySlugs: Set<string>;
  onBack: () => void;
  onLicense: (appId: string) => void;
  onCheckUpdate: (app: InstalledApp) => Promise<void>;
  onClearUpdateSignal: (app: InstalledApp) => Promise<void>;
  onIssueAppToken: (app: InstalledApp) => Promise<void>;
  onRefreshCatalog: (app: InstalledApp) => Promise<void>;
  onRefreshArtifact: (app: InstalledApp) => Promise<void>;
  onUninstall: (app: InstalledApp) => void;
  isMutating: boolean;
}) {
  const status = getInstalledStatus(app, registrySlugs);

  return (
    <Card className="overflow-hidden p-0">
      <SectionHeader title={pickAppDisplayName(app)} description={app.app_id} meta={<Button size="sm" variant="outlined" onClick={onBack}>Back to installed apps</Button>} />
      <div className="flex flex-wrap gap-1.5 border-t border-hc-outline px-4 py-3">
        <Badge tone={status.tone}>{status.label}</Badge>
        {app.app_version && <Badge>{app.app_version}</Badge>}
        {app.update_signal && <Badge tone="warn">update signal</Badge>}
        {app.catalog_update?.state === "available" && <Badge tone="warn">catalog update available</Badge>}
      </div>
      <dl className="grid border-t border-hc-outline md:grid-cols-2">
        <DetailCell label="Runtime" value={status.detail ?? status.label} />
        <DetailCell label="Entitlement" value={app.resolved_entitlement ? `${app.resolved_entitlement.tier}, valid to ${formatDate(app.resolved_entitlement.valid_to)}` : "No active entitlement"} />
        <DetailCell label="UI URL" value={app.ui_url} />
        <DetailCell label="Catalog state" value={app.catalog_update ? `${app.catalog_update.state} · ${app.catalog_update.source_type} / ${app.catalog_update.trust_status}` : "Not checked"} />
      </dl>
      {app.update_signal && <div className="border-t border-hc-warning/30 bg-hc-warning/10 px-4 py-3 text-sm">
        <div className="font-semibold text-hc-warning">Update reported by {app.update_signal.source}</div>
        <div className="mt-1 text-xs text-hc-muted">{app.update_signal.note ?? "No note"} · {formatDate(app.update_signal.reported_at)}</div>
      </div>}
      <div className="flex flex-wrap justify-end gap-2 border-t border-hc-outline px-4 py-3">
        <Button variant="tonal" onClick={() => onLicense(app.app_id)}>Licensing</Button>
        <Button variant="outlined" disabled={isMutating} onClick={() => void onCheckUpdate(app)}>Check update</Button>
        {app.update_signal && <Button variant="ghost" disabled={isMutating} onClick={() => void onClearUpdateSignal(app)}>Clear signal</Button>}
        <Button variant="outlined" disabled={isMutating} onClick={() => void onIssueAppToken(app)}>Issue token</Button>
        <Button variant="outlined" disabled={isMutating} onClick={() => void onRefreshCatalog(app)}>Refresh catalog</Button>
        <Button variant="outlined" disabled={isMutating} onClick={() => void onRefreshArtifact(app)}>Refresh artifact</Button>
        <Button variant="ghost" onClick={() => onUninstall(app)}>Uninstall</Button>
      </div>
    </Card>
  );
}

function InstalledTable({
  apps,
  registrySlugs,
  isLoading,
  onLicense,
  onOpen,
}: {
  apps: InstalledApp[];
  registrySlugs: Set<string>;
  isLoading: boolean;
  onLicense: (appId: string) => void;
  onOpen: (app: InstalledApp) => void;
}) {
  if (isLoading) {
    return <div className="px-5 py-6 text-sm text-hc-muted">Loading installed apps...</div>;
  }

  if (apps.length === 0) {
    return <div className="px-5 py-6 text-sm text-hc-muted">No installed apps.</div>;
  }

  return (
    <Table className="rounded-none border-0 shadow-none">
      <thead className="border-b border-hc-outline text-xs uppercase tracking-wide text-hc-muted">
        <tr>
          <th className="px-5 py-3 font-semibold">Application</th>
          <th className="px-5 py-3 font-semibold">Runtime</th>
          <th className="px-5 py-3 font-semibold">Entitlement</th>
          <th className="px-5 py-3 font-semibold">Updates</th>
          <th className="px-5 py-3 font-semibold">Actions</th>
        </tr>
      </thead>
      <tbody>
        {apps.map((app) => {
          const status = getInstalledStatus(app, registrySlugs);
          return (
            <tr key={app.app_id}>
              <td>
                <div className="font-medium">{pickAppDisplayName(app)}</div>
                <div className="truncate text-xs text-hc-muted" title={app.app_id}>{app.app_id}{app.app_version ? ` · ${app.app_version}` : ""}</div>
              </td>
              <td title={status.detail ?? undefined}>
                <Badge tone={status.tone}>{status.label}</Badge>
              </td>
              <td className="text-sm">
                {app.resolved_entitlement ? (
                  <span>{app.resolved_entitlement.tier} <span className="text-xs text-hc-muted">to {formatDate(app.resolved_entitlement.valid_to)}</span></span>
                ) : (
                  <span className="text-hc-muted">none selected</span>
                )}
              </td>
              <td>
                <div className="flex flex-wrap gap-1.5">
                  {app.update_signal && <Badge tone="warn">signal</Badge>}
                  {app.catalog_update?.state === "available" && <Badge tone="warn">available</Badge>}
                  {app.catalog_update?.state === "same" && <Badge tone="good">current</Badge>}
                  {!app.update_signal && !app.catalog_update && <span className="text-xs text-hc-muted">not checked</span>}
                </div>
              </td>
              <td>
                <div className="flex justify-end gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => onLicense(app.app_id)}>Licensing</Button>
                  <Button size="sm" variant="ghost" onClick={() => onOpen(app)}>Open</Button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

function AppTokenDialog({
  state,
  onClose,
}: {
  state: AppTokenDialogState;
  onClose: () => void;
}) {
  if (state.status === "idle") {
    return null;
  }

  const copyToken = () => {
    void navigator.clipboard?.writeText(state.token.access_token);
  };

  return (
    <Dialog open title="App token" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <div className="text-lg font-semibold">{pickAppDisplayName(state.app)}</div>
          <div className="mt-1 text-sm text-hc-muted">
            Short-lived app token for Core app-auth endpoints. Expires {formatDate(state.token.expires_at)}.
          </div>
        </div>
        <Textarea
          readOnly
          className="min-h-36 font-mono text-xs"
          value={state.token.access_token}
        />
        <div className="flex justify-end gap-2">
          <Button variant="outlined" onClick={copyToken}>
            Copy token
          </Button>
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Dialog>
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
            <span>
              Remove this app from Core. Core-managed containers will also be removed; external runtimes are not
              affected.
            </span>
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
