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
  useSetCatalogSourceAutoRefreshMutation,
  useSetCatalogSourceEnabledMutation,
  useSetCatalogEntryPublicationMutation,
  useSyncCatalogSourceMutation,
  useUpdateManagedAppRuntimeMutation,
  type AppCatalogEntry,
  type AppCatalogSource,
  type AppRuntimeStartApproval,
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
  useRotateManagedAppRuntimeTokenMutation,
  useRunAppDiagnosticsMutation,
  useStopManagedAppRuntimeMutation,
  useUninstallAppMutation,
  type IssueInstalledAppTokenResponse,
  type InstalledApp,
} from "../../data/api/installed-apps";
import { selectInstalledAppAvailability } from "../../data/installed-app-availability";
import { readErrorMessage } from "../../data/api/read-error-message";
import { useContextQuery } from "../../data/api/context";
import { useLocalization, type Translate } from "../../localization/LocalizationProvider";
import { getLocaleLabel } from "../../localization/resources";
import {
  useAppEntitlementsQuery,
  useClearSelectionMutation,
  useSetSelectionMutation,
  useStartLicenseOAuthMutation,
} from "../../data/api/licensing";
import { Button } from "../../ui-kit/components/Button";
import { Card } from "../../ui-kit/components/Card";
import { Dialog } from "../../ui-kit/components/Dialog";
import { Input } from "../../ui-kit/components/Input";
import { Field, MetricStrip, PageHeader, SectionHeader } from "../../ui-kit/components/Page";
import { Select } from "../../ui-kit/components/Select";
import { Switch } from "../../ui-kit/components/Switch";
import { Table } from "../../ui-kit/components/Table";
import { TabBar } from "../../ui-kit/components/TabBar";
import { Textarea } from "../../ui-kit/components/Textarea";
import { ToastNotice } from "../../ui-kit/components/ToastNotice";

type Tab = "catalog" | "feeds" | "installed" | "license-binding";

type UninstallState =
  | { status: "idle" }
  | { status: "confirm"; app: InstalledApp }
  | { status: "running"; app: InstalledApp }
  | { status: "success" }
  | { status: "error"; app: InstalledApp; error: string };

type InstallDialogState =
  | { status: "idle" }
  | { status: "confirm"; operation: "install" | "update"; entry: AppCatalogEntry; mode: InstallCatalogEntryMode; plan: CatalogDeploymentPlan }
  | { status: "running"; operation: "install" | "update"; entry: AppCatalogEntry; mode: InstallCatalogEntryMode; plan: CatalogDeploymentPlan }
  | { status: "result"; operation: "install" | "update"; entry: AppCatalogEntry; message: string; plan: CatalogDeploymentPlan }
  | { status: "error"; operation: "install" | "update"; entry: AppCatalogEntry; mode: InstallCatalogEntryMode; error: string; plan: CatalogDeploymentPlan };

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

function readAppLocalization(app: InstalledApp) {
  const localization = app.manifest?.["localization"] as
    | { default_locale?: unknown; supported_locales?: unknown }
    | undefined;
  const supportedLocales = Array.isArray(localization?.supported_locales)
    ? localization.supported_locales.filter((value): value is string => typeof value === "string")
    : ["en"];
  const defaultLocale = typeof localization?.default_locale === "string" ? localization.default_locale : "en";
  return { defaultLocale, supportedLocales: supportedLocales.length > 0 ? supportedLocales : [defaultLocale] };
}

function getInstalledStatus(app: InstalledApp, registrySlugs: Set<string>, t: Translate) {
  const state = selectInstalledAppAvailability(app);
  const reason = !registrySlugs.has(app.slug) && state.reason === null ? "ui_missing" : state.reason;
  const availability = reason === "ui_missing" ? "unavailable" : state.availability;
  const tone = availability === "available" ? "good" as const : availability === "degraded" || availability === "blocked" ? "warn" as const : "danger" as const;
  return { label: t(`apps.availability.${availability}`), tone, detail: reason ? t(`apps.reason.${reason}`) : null };
}

function getCatalogRuntimeStatus(entry: AppCatalogEntry, t: Translate) {
  if (!entry.installed) {
    return { label: t("apps.status.available"), tone: "neutral" as const, detail: null };
  }

  if (!entry.installed.enabled) {
    return { label: t("apps.status.disabled"), tone: "danger" as const, detail: t("apps.status.disabledDescription") };
  }

  if (entry.license_state.required && !entry.license_state.selected_active_license) {
    return {
      label: entry.license_state.has_any_license ? t("apps.status.licenseInactive") : t("apps.status.licenseMissing"),
      tone: "warn" as const,
      detail: entry.license_state.has_any_license
        ? t("apps.status.catalogLicenseInactive")
        : t("apps.status.catalogRuntimeBlocked"),
    };
  }

  return { label: t("apps.status.ready"), tone: "good" as const, detail: null };
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString();
}

function normalizePlanUrl(value: string, originOnly = false) {
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    return originOnly ? parsed.origin : parsed.toString();
  } catch {
    return value;
  }
}

function buildCatalogDeploymentPlan(entry: AppCatalogEntry, mode: InstallCatalogEntryMode = "external"): CatalogDeploymentPlan {
  const internalBaseUrl = entry.deployment.internal_base_url ?? entry.deployment.base_url ?? entry.base_url;
  return {
    app_id: entry.app_id,
    mode,
    service_name: entry.deployment.service_name ?? entry.slug,
    internal_base_url: normalizePlanUrl(internalBaseUrl, true),
    compose_project: entry.deployment.compose_project ?? "hekatoncheiros-core",
    compose_file: entry.deployment.compose_file ?? null,
    package_url: entry.deployment.package_url ? normalizePlanUrl(entry.deployment.package_url) : null,
    package_sha256: entry.deployment.package_sha256 ?? null,
    published_ports_allowed: false,
    host_mounts_allowed: false,
    requires_approval: mode === "compose",
  };
}

function readTabFromPath(pathname: string): Tab {
  if (pathname.startsWith("/core/apps/feeds")) {
    return "feeds";
  }
  if (pathname.startsWith("/core/apps/installed")) {
    return "installed";
  }
  if (pathname.endsWith("/license-binding")) {
    return "license-binding";
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

function formatActionError(error: unknown, t: Translate) {
  const message = readErrorMessage(error);
  if (message.includes("base_url must use https")) {
    return t("apps.error.httpOrigin");
  }
  return message;
}

function translateAppValue(value: string, t: Translate) {
  const key = `apps.value.${value}`;
  const translated = t(key);
  return translated === key ? value : translated;
}

export function AppsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: context } = useContextQuery(true);
  const { t } = useLocalization();
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
  const setCatalogSourceAutoRefresh = useSetCatalogSourceAutoRefreshMutation();
  const syncCatalogSource = useSyncCatalogSourceMutation();
  const deleteCatalogEntry = useDeleteCatalogEntryMutation();
  const installCatalogEntry = useInstallCatalogEntryMutation();
  const updateManagedRuntime = useUpdateManagedAppRuntimeMutation();
  const setCatalogEntryPublication = useSetCatalogEntryPublicationMutation();
  const uninstallMutation = useUninstallAppMutation();
  const refreshArtifactMutation = useRefreshInstalledAppArtifactMutation();
  const checkUpdateMutation = useCheckInstalledAppUpdateMutation();
  const clearUpdateSignalMutation = useClearInstalledAppUpdateSignalMutation();
  const issueAppTokenMutation = useIssueInstalledAppTokenMutation();
  const stopManagedRuntime = useStopManagedAppRuntimeMutation();
  const rotateManagedRuntimeToken = useRotateManagedAppRuntimeTokenMutation();
  const setSelectionMutation = useSetSelectionMutation();
  const clearSelectionMutation = useClearSelectionMutation();
  const startLicenseOAuth = useStartLicenseOAuthMutation(tenantId);

  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dismissedInstalledError, setDismissedInstalledError] = useState<string | null>(null);
  const [catalogForm, setCatalogForm] = useState({ base_url: "", summary: "", trust_status: "manual" as "dev" | "manual" | "unverified" });
  const [sourceForm, setSourceForm] = useState({ name: "", feed_url: "", trust_mode: "manual" as AppCatalogSource["trust_mode"] });
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [selectedEntitlementId, setSelectedEntitlementId] = useState("");
  const [installDialog, setInstallDialog] = useState<InstallDialogState>({ status: "idle" });
  const [runtimeApprovalConfirmed, setRuntimeApprovalConfirmed] = useState(false);
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
  const installedErrorMessage = installedError ? formatActionError(installedError, t) : null;
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
      setMessage(t("apps.message.catalogRefreshed", { id: entry.app_id }));
      setCatalogForm((prev) => ({ ...prev, base_url: "", summary: "" }));
    } catch (error) {
      setActionError(formatActionError(error, t));
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
      setMessage(t("apps.message.feedSaved", { name: source.name }));
      setSourceForm((prev) => ({ ...prev, name: "", feed_url: "" }));
    } catch (error) {
      setActionError(formatActionError(error, t));
    }
  };

  const handleSyncCatalogSource = async (source: AppCatalogSource) => {
    resetNotices();
    try {
      const result = await syncCatalogSource.mutateAsync(source.id);
      const suffix = result.skipped > 0 ? t("apps.message.failedSuffix", { count: result.skipped }) : "";
      setMessage(t("apps.message.feedSynced", { name: source.name, imported: result.imported, total: result.total, suffix }));
    } catch (error) {
      setActionError(formatActionError(error, t));
    }
  };

  const handleSetCatalogSourceEnabled = async (source: AppCatalogSource, isEnabled: boolean) => {
    resetNotices();
    try {
      await setCatalogSourceEnabled.mutateAsync({ id: source.id, isEnabled });
      setMessage(t("apps.message.sourceState", { name: source.name, state: t(isEnabled ? "common.enable" : "common.disable") }));
    } catch (error) {
      setActionError(formatActionError(error, t));
    }
  };

  const handleSetCatalogSourceAutoRefresh = async (source: AppCatalogSource, autoRefreshEnabled: boolean) => {
    resetNotices();
    try {
      await setCatalogSourceAutoRefresh.mutateAsync({ id: source.id, autoRefreshEnabled });
      setMessage(t("apps.message.autoRefreshState", { name: source.name, state: t(autoRefreshEnabled ? "common.enable" : "common.disable") }));
    } catch (error) {
      setActionError(formatActionError(error, t));
    }
  };

  const openInstallDialog = (entry: AppCatalogEntry) => {
    resetNotices();
    setRuntimeApprovalConfirmed(false);
    const mode = "external";
    setInstallDialog({ status: "confirm", operation: "install", entry, mode, plan: buildCatalogDeploymentPlan(entry, mode) });
  };

  const openRuntimeUpdateDialog = (app: InstalledApp) => {
    resetNotices();
    const entry = catalog.find((item) => item.app_id === app.app_id);
    if (!entry) {
      setActionError(t("apps.message.runtimeCatalogRequired"));
      return;
    }
    setRuntimeApprovalConfirmed(false);
    setInstallDialog({
      status: "confirm",
      operation: "update",
      entry,
      mode: "compose",
      plan: buildCatalogDeploymentPlan(entry, "compose"),
    });
  };

  const setInstallMode = (mode: InstallCatalogEntryMode) => {
    setRuntimeApprovalConfirmed(false);
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
    setRuntimeApprovalConfirmed(false);
    setInstallDialog({ status: "idle" });
  };

  const executeCatalogInstall = async () => {
    if (installDialog.status !== "confirm" && installDialog.status !== "error") {
      return;
    }

    const { operation, entry, mode, plan } = installDialog;
    let approval: AppRuntimeStartApproval | undefined;
    if (mode === "compose") {
      if (!runtimeApprovalConfirmed || !plan.package_sha256 || !plan.package_url || !plan.compose_file) {
        return;
      }
      approval = {
        confirmed: true,
        expected_manifest_sha256: entry.manifest_hash,
        expected_package_sha256: plan.package_sha256,
        expected_deployment: {
          service_name: plan.service_name,
          internal_base_url: plan.internal_base_url,
          package_url: plan.package_url,
          compose_project: plan.compose_project,
          compose_file: plan.compose_file,
        },
      };
    }
    resetNotices();
    setInstallDialog({ status: "running", operation, entry, mode, plan });

    try {
      const result = operation === "update"
        ? await updateManagedRuntime.mutateAsync({ appId: entry.app_id, approval: approval! })
        : await installCatalogEntry.mutateAsync({ appId: entry.app_id, mode, approval });
      const message =
        operation === "update"
          ? t("apps.message.runtimeUpdated", { name: entry.app_name })
          : result.status === "staged"
          ? t("apps.message.staged", { name: entry.app_name })
          : t("apps.message.installed", { name: entry.app_name });
      setInstallDialog({ status: "result", operation, entry, message, plan: result.deployment_plan });
      setMessage(message);
    } catch (error) {
      const formatted = formatActionError(error, t);
      setActionError(formatted);
      setInstallDialog({ status: "error", operation, entry, mode, error: formatted, plan });
    }
  };

  const handleDeleteCatalogEntry = async (entry: AppCatalogEntry) => {
    resetNotices();
    try {
      await deleteCatalogEntry.mutateAsync(entry.app_id);
      setMessage(t("apps.message.removedCatalog", { name: entry.app_name }));
    } catch (error) {
      setActionError(formatActionError(error, t));
    }
  };

  const handleSetCatalogEntryPublication = async (entry: AppCatalogEntry, published: boolean) => {
    resetNotices();
    try {
      const updated = await setCatalogEntryPublication.mutateAsync({ appId: entry.app_id, published });
      setMessage(t("apps.message.publication", { name: updated.app_name, state: t(updated.published ? "apps.message.publishedTo" : "apps.message.removedFrom") }));
    } catch (error) {
      setActionError(formatActionError(error, t));
    }
  };

  const handleActivateLicense = async (entry: AppCatalogEntry) => {
    resetNotices();
    if (!entry.license_issuer_url) {
      setSelectedAppId(entry.app_id);
      navigate(`/core/licensing?app=${encodeURIComponent(entry.app_id)}`);
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
      setActionError(formatActionError(error, t));
    }
  };

  const executeUninstall = async (app: InstalledApp) => {
    resetNotices();
    setUninstallState({ status: "running", app });

    try {
      await uninstallMutation.mutateAsync(app.app_id);
      setUninstallState({ status: "success" });
      setMessage(t("apps.message.uninstalled", { name: pickAppDisplayName(app) }));
    } catch (error) {
      const formatted = formatActionError(error, t);
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
      setMessage(t("apps.message.artifactRefreshed", { name: pickAppDisplayName(app) }));
    } catch (error) {
      setActionError(formatActionError(error, t));
    }
  };

  const handleCheckUpdate = async (app: InstalledApp) => {
    resetNotices();
    try {
      const result = await checkUpdateMutation.mutateAsync(app.app_id);
      if (result.update_available === true) {
        setMessage(
          t("apps.message.updateAvailable", { name: pickAppDisplayName(app), from: result.installed.app_version ?? t("common.unknown"), to: result.fetched.app_version }),
        );
      } else if (result.update_available === false) {
        setMessage(t("apps.message.upToDate", { name: pickAppDisplayName(app), version: result.fetched.app_version }));
      } else {
        setMessage(t("apps.message.updateUnknown", { name: pickAppDisplayName(app) }));
      }
    } catch (error) {
      setActionError(formatActionError(error, t));
    }
  };

  const handleRefreshCatalogFromInstalled = async (app: InstalledApp) => {
    resetNotices();
    try {
      const entry = await refreshCatalogFromInstalled.mutateAsync(app.app_id);
      setMessage(t("apps.message.catalogFromInstalled", { name: entry.app_name }));
    } catch (error) {
      setActionError(formatActionError(error, t));
    }
  };

  const handleClearUpdateSignal = async (app: InstalledApp) => {
    resetNotices();
    try {
      await clearUpdateSignalMutation.mutateAsync(app.app_id);
      setMessage(t("apps.message.signalCleared", { name: pickAppDisplayName(app) }));
    } catch (error) {
      setActionError(formatActionError(error, t));
    }
  };

  const handleIssueAppToken = async (app: InstalledApp) => {
    resetNotices();
    try {
      const token = await issueAppTokenMutation.mutateAsync(app.app_id);
      setAppTokenDialog({ status: "issued", app, token });
      setMessage(t("apps.message.tokenIssued", { name: pickAppDisplayName(app) }));
    } catch (error) {
      setActionError(formatActionError(error, t));
    }
  };

  const handleStopManagedRuntime = async (app: InstalledApp) => {
    resetNotices();
    try {
      await stopManagedRuntime.mutateAsync(app.app_id);
      setMessage(t("apps.message.runtimeStopped", { name: pickAppDisplayName(app) }));
    } catch (error) {
      setActionError(formatActionError(error, t));
    }
  };

  const handleRotateManagedRuntimeToken = async (app: InstalledApp) => {
    resetNotices();
    try {
      const result = await rotateManagedRuntimeToken.mutateAsync(app.app_id);
      setMessage(t("apps.message.tokenRotated", { name: pickAppDisplayName(app), date: formatDate(result.expires_at) }));
    } catch (error) {
      setActionError(formatActionError(error, t));
    }
  };

  const handleSetSelection = async () => {
    if (!effectiveSelectedAppId || !selectedEntitlementId) {
      return;
    }
    resetNotices();
    try {
      await setSelectionMutation.mutateAsync({ app_id: effectiveSelectedAppId, entitlement_id: selectedEntitlementId });
      setMessage(t("apps.message.selectionUpdated"));
    } catch (error) {
      setActionError(formatActionError(error, t));
    }
  };

  const handleClearSelection = async () => {
    if (!effectiveSelectedAppId) {
      return;
    }
    resetNotices();
    try {
      await clearSelectionMutation.mutateAsync({ app_id: effectiveSelectedAppId });
      setMessage(t("apps.message.selectionCleared"));
    } catch (error) {
      setActionError(formatActionError(error, t));
    }
  };

  if (!canManageApps) {
    return (
      <Card>
        <div className="text-lg font-semibold">{t("apps.title")}</div>
        <div className="mt-2 text-sm text-hc-muted">{t("apps.permissionDenied")}</div>
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
        eyebrow={t("apps.admin")}
        title={t("apps.title")}
        description={t("apps.description")}
        actions={<MetricStrip items={[
          { label: t("nav.catalog"), value: catalog.length },
          { label: t("apps.installable"), value: installableCount },
          { label: t("apps.published"), value: publishedCount },
        ]} />}
      />

      {hasUpdateSignals && (
        <Card className="rounded-hc-md border-hc-primary/25 bg-hc-primary/5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-semibold">{t("apps.updateAttention")}</div>
                {reportedUpdateSignals.length > 0 && (
                  <Badge tone="warn">{t("apps.appSignals", { count: reportedUpdateSignals.length })}</Badge>
                )}
                {availableCatalogUpdates.length > 0 && (
                  <Badge tone="warn">{t("apps.catalogUpdates", { count: availableCatalogUpdates.length })}</Badge>
                )}
                {staleCatalogSnapshots.length > 0 && (
                  <Badge tone="neutral">{t("apps.staleSnapshots", { count: staleCatalogSnapshots.length })}</Badge>
                )}
              </div>
              <div className="mt-2 max-w-3xl text-sm text-hc-muted">
                {t("apps.updateAttentionDescription")}
              </div>
            </div>
            <Button variant="outlined" onClick={() => navigate("/core/apps/installed")}>
              {t("apps.reviewInstalled")}
            </Button>
          </div>
        </Card>
      )}

      <TabBar
        active={activeTab}
        items={[
          { id: "catalog", label: t("nav.catalog"), count: catalog.length },
          { id: "feeds", label: t("nav.feedSources"), count: catalogSources.length },
          { id: "installed", label: t("apps.installed"), count: installed.length },
          { id: "license-binding", label: t("nav.licenseBinding") },
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
          onSetAutoRefresh={handleSetCatalogSourceAutoRefresh}
          isMutating={createCatalogSource.isPending || syncCatalogSource.isPending || setCatalogSourceEnabled.isPending || setCatalogSourceAutoRefresh.isPending}
        />
      )}

      {activeTab === "catalog" && (
        catalogDetailId ? (
          catalogDetail ? <CatalogAppDetail
            entry={catalogDetail}
            installed={installedByAppId.get(catalogDetail.app_id)}
            onBack={() => navigate("/core/apps")}
            onInstall={openInstallDialog}
            onLicense={(appId) => navigate(`/core/licensing?app=${encodeURIComponent(appId)}`)}
            onActivateLicense={handleActivateLicense}
            onDelete={handleDeleteCatalogEntry}
            onSetPublication={handleSetCatalogEntryPublication}
            isMutating={installCatalogEntry.isPending || deleteCatalogEntry.isPending || setCatalogEntryPublication.isPending || startLicenseOAuth.isPending}
          /> : <Card><div className="text-sm text-hc-muted">{t("apps.notFound")}</div></Card>
        ) : <div className="space-y-4">
          <Card className="overflow-hidden p-0">
            <SectionHeader title={t("apps.addApplication")} description={t("apps.addApplicationDescription")} />
            <div className="flex flex-wrap items-end gap-3 border-t border-hc-outline p-4">
              <Field label={t("apps.manifestBaseUrl")} className="min-w-72 flex-1">
                <Input
                  placeholder="https://apps.example.com/inventory"
                  value={catalogForm.base_url}
                  onChange={(event) => setCatalogForm((prev) => ({ ...prev, base_url: event.target.value }))}
                />
              </Field>
              <Field label={t("apps.summary")} className="min-w-64 flex-1">
                <Input
                  placeholder={t("apps.summaryPlaceholder")}
                  value={catalogForm.summary}
                  onChange={(event) => setCatalogForm((prev) => ({ ...prev, summary: event.target.value }))}
                />
              </Field>
              <Field label={t("apps.trust")}>
                <Select
                  value={catalogForm.trust_status}
                  onChange={(event) =>
                    setCatalogForm((prev) => ({ ...prev, trust_status: event.target.value as "dev" | "manual" | "unverified" }))
                  }
                >
                  <option value="manual">{translateAppValue("manual", t)}</option>
                  <option value="dev">{translateAppValue("dev", t)}</option>
                  <option value="unverified">{translateAppValue("unverified", t)}</option>
                </Select>
              </Field>
              <Button
                onClick={() => void handleCreateCatalogEntry()}
                disabled={!catalogForm.base_url.trim() || createCatalogEntry.isPending}
              >
                {createCatalogEntry.isPending ? t("apps.fetching") : t("apps.addToCatalog")}
              </Button>
            </div>
          </Card>

          <Card id="catalog" className="rounded-hc-md p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hc-outline px-4 py-3">
              <div>
                <div className="text-sm font-semibold">{t("apps.availableApplications")}</div>
                <div className="mt-1 text-xs text-hc-muted">{t("apps.requireLicenseCount", { count: licensedCatalogCount })}</div>
              </div>
              <Badge>{catalogLoading ? t("common.loading") : t("apps.entriesCount", { count: catalog.length })}</Badge>
            </div>
            <div className="border-b border-hc-outline p-3"><Input value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder={t("apps.searchCatalog")} /></div>
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
            onLicense={(appId) => navigate(`/core/licensing?app=${encodeURIComponent(appId)}`)}
            onCheckUpdate={handleCheckUpdate}
            onClearUpdateSignal={handleClearUpdateSignal}
            onIssueAppToken={handleIssueAppToken}
            onStopRuntime={handleStopManagedRuntime}
            onRotateRuntimeToken={handleRotateManagedRuntimeToken}
            onUpdateRuntime={openRuntimeUpdateDialog}
            onRefreshCatalog={handleRefreshCatalogFromInstalled}
            onRefreshArtifact={handleRefreshArtifact}
            onUninstall={(app) => { setUninstallConfirmChecked(false); setUninstallState({ status: "confirm", app }); }}
            isMutating={checkUpdateMutation.isPending || clearUpdateSignalMutation.isPending || issueAppTokenMutation.isPending || refreshArtifactMutation.isPending || refreshCatalogFromInstalled.isPending || stopManagedRuntime.isPending || rotateManagedRuntimeToken.isPending || updateManagedRuntime.isPending}
          /> : <Card><div className="text-sm text-hc-muted">{t("apps.installedNotFound")}</div></Card>
        ) : <Card id="installed" className="rounded-hc-md p-0">
          <div className="flex items-center justify-between border-b border-hc-outline px-5 py-4">
            <div>
              <div className="text-sm font-semibold">{t("apps.installedApplications")}</div>
              <div className="mt-1 text-xs text-hc-muted">{t("apps.installedDescription")}</div>
            </div>
            <Badge>{installedLoading ? t("common.loading") : t("apps.installedCount", { count: installed.length })}</Badge>
          </div>
          <div className="border-b border-hc-outline p-3"><Input value={installedSearch} onChange={(event) => setInstalledSearch(event.target.value)} placeholder={t("apps.searchInstalled")} /></div>
          <InstalledTable
            apps={filteredInstalled}
            isLoading={installedLoading}
            onLicense={(appId) => {
              navigate(`/core/licensing?app=${encodeURIComponent(appId)}`);
            }}
            onOpen={(app) => navigate(`/core/apps/installed/${encodeURIComponent(app.app_id)}`)}
          />
        </Card>
      )}

      {activeTab === "license-binding" && (
        <Card id="license-binding" className="rounded-hc-md p-0">
          <SectionHeader
            title={t("apps.licenseBinding")}
            description={t("apps.licenseBindingDescription")}
            meta={<Button variant="outlined" onClick={() => navigate(effectiveSelectedAppId ? `/core/licensing?app=${encodeURIComponent(effectiveSelectedAppId)}` : "/core/licensing")}>{t("apps.openMainLicensing")}</Button>}
          />
          <div className="border-t border-hc-outline p-4">
            <section className="max-w-2xl">
              <div className="text-sm font-semibold">{t("apps.tenantLicenseSelection")}</div>
              <Field label={t("licensing.application")} className="mt-3">
                <Select
                  value={effectiveSelectedAppId ?? ""}
                  onChange={(event) => {
                    setSelectedAppId(event.target.value || null);
                    setSelectedEntitlementId("");
                  }}
                >
                  <option value="">{t("apps.selectApp")}</option>
                  {installed.map((app) => (
                    <option key={app.app_id} value={app.app_id}>
                      {pickAppDisplayName(app)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("apps.storedLicense")} className="mt-3">
                <Select
                  value={selectedEntitlementId}
                  onChange={(event) => setSelectedEntitlementId(event.target.value)}
                >
                  <option value="">{t("apps.fallbackSelection")}</option>
                  {(entitlementsData?.items ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.source} / {item.tier} / {formatDate(item.valid_to)}
                      {entitlementsData?.selected_entitlement_id === item.id ? ` [${t("apps.selectedSuffix")}]` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => void handleSetSelection()} disabled={!selectedEntitlementId || setSelectionMutation.isPending}>
                  {t("apps.setSelection")}
                </Button>
                <Button variant="outlined" onClick={() => void handleClearSelection()} disabled={!effectiveSelectedAppId || clearSelectionMutation.isPending}>
                  {t("apps.clear")}
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
        runtimeApprovalConfirmed={runtimeApprovalConfirmed}
        onRuntimeApprovalChange={setRuntimeApprovalConfirmed}
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
  onSetAutoRefresh,
  isMutating,
}: {
  sources: AppCatalogSource[];
  isLoading: boolean;
  form: { name: string; feed_url: string; trust_mode: AppCatalogSource["trust_mode"] };
  setForm: React.Dispatch<React.SetStateAction<{ name: string; feed_url: string; trust_mode: AppCatalogSource["trust_mode"] }>>;
  onCreate: () => Promise<void>;
  onSync: (source: AppCatalogSource) => Promise<void>;
  onSetEnabled: (source: AppCatalogSource, isEnabled: boolean) => Promise<void>;
  onSetAutoRefresh: (source: AppCatalogSource, autoRefreshEnabled: boolean) => Promise<void>;
  isMutating: boolean;
}) {
  const { t } = useLocalization();
  return (
    <Card id="catalog-feeds" className="rounded-hc-md p-0">
      <div className="flex items-center justify-between border-b border-hc-outline px-5 py-4">
        <div>
          <div className="text-sm font-semibold">{t("apps.catalogFeeds")}</div>
          <div className="mt-1 text-xs text-hc-muted">{t("apps.catalogFeedsDescription")}</div>
        </div>
        <Badge>{isLoading ? t("common.loading") : t("apps.sourcesCount", { count: sources.length })}</Badge>
      </div>

      <div className="grid gap-3 border-b border-hc-outline px-5 py-4 lg:grid-cols-[minmax(180px,260px)_1fr_auto_auto]">
        <Input
          placeholder={t("apps.feedName")}
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
          <option value="manual">{translateAppValue("manual", t)}</option>
          <option value="dev">{translateAppValue("dev", t)}</option>
          <option value="verified">{translateAppValue("verified", t)}</option>
          <option value="official">{translateAppValue("official", t)}</option>
        </select>
        <Button onClick={() => void onCreate()} disabled={!form.name.trim() || !form.feed_url.trim() || isMutating}>
          {t("apps.addFeed")}
        </Button>
      </div>

      {sources.length === 0 ? (
        <div className="px-5 py-5 text-sm text-hc-muted">{t("apps.noFeedSources")}</div>
      ) : (
        <div className="divide-y divide-hc-outline/70">
          {sources.map((source) => (
            <div key={source.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-medium">{source.name}</div>
                  <Badge tone={source.is_enabled ? "good" : "neutral"}>{t(source.is_enabled ? "common.on" : "common.off")}</Badge>
                  <Badge>{translateAppValue(source.trust_mode, t)}</Badge>
                </div>
                <div className="mt-1 break-all text-xs text-hc-muted">{source.feed_url}</div>
                <div className="mt-1 text-xs text-hc-muted">
                  {t("apps.lastSync", { date: formatDate(source.last_sync_at) })}
                  {source.last_error ? ` / ${source.last_error}` : ""}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className={`flex items-center gap-2 text-xs ${source.trust_mode === "verified" || source.trust_mode === "official" ? "text-hc-text" : "text-hc-muted"}`}>
                  <Switch
                    checked={source.auto_refresh_enabled}
                    disabled={isMutating || !source.is_enabled || (source.trust_mode !== "verified" && source.trust_mode !== "official")}
                    onClick={() => void onSetAutoRefresh(source, !source.auto_refresh_enabled)}
                  />
                  {t("apps.autoRefresh")}
                </label>
                <Button variant="outlined" disabled={!source.is_enabled || isMutating} onClick={() => void onSync(source)}>
                  {t("apps.sync")}
                </Button>
                <Button
                  variant="ghost"
                  disabled={isMutating}
                  onClick={() => void onSetEnabled(source, !source.is_enabled)}
                >
                  {t(source.is_enabled ? "common.disable" : "common.enable")}
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
  const { t } = useLocalization();
  const runtimeStatus = getCatalogRuntimeStatus(entry, t);
  const needsLicenseAction = Boolean(installed) && entry.license_state.required && !entry.license_state.selected_active_license;
  const canPublish = Boolean(installed?.enabled !== false && installed);

  return (
    <Card className="overflow-hidden p-0">
      <SectionHeader
        title={entry.app_name}
        description={entry.app_id}
        meta={<Button size="sm" variant="outlined" onClick={onBack}>{t("apps.backToCatalog")}</Button>}
      />
      <div className="flex flex-wrap gap-1.5 border-t border-hc-outline px-4 py-3">
        <Badge tone={entry.trust_status === "official" || entry.trust_status === "verified" ? "good" : "neutral"}>{translateAppValue(entry.trust_status, t)}</Badge>
        <Badge tone={runtimeStatus.tone}>{runtimeStatus.label}</Badge>
        {entry.license_required ? <Badge tone="warn">{t("apps.licenseRequired")}</Badge> : <Badge tone="good">{t("apps.free")}</Badge>}
        {entry.published ? <Badge tone="good">{t("apps.publishedToFeed")}</Badge> : <Badge>{translateAppValue(entry.publish_status, t)}</Badge>}
      </div>
      <dl className="grid border-t border-hc-outline md:grid-cols-2">
        <DetailCell label={t("apps.source")} value={`${translateAppValue(entry.source_type, t)} · ${entry.namespace ?? t("apps.noNamespace")}`} />
        <DetailCell label={t("apps.runtime")} value={runtimeStatus.detail ?? runtimeStatus.label} />
        <DetailCell label={t("apps.summary")} value={entry.summary ?? t("apps.noSummary")} />
        <DetailCell label={t("apps.licenseIssuer")} value={entry.license_issuer_url ?? t("common.notConfigured")} />
      </dl>
      <div className="flex flex-wrap justify-end gap-2 border-t border-hc-outline px-4 py-3">
        {!installed && <Button variant="outlined" disabled={isMutating} onClick={() => onInstall(entry)}>{t("apps.installApplication")}</Button>}
        {installed && needsLicenseAction && <Button variant="tonal" disabled={isMutating} onClick={() => entry.license_issuer_url ? void onActivateLicense(entry) : onLicense(entry.app_id)}>{t(entry.license_issuer_url ? "apps.activateLicense" : "apps.openLicensing")}</Button>}
        <Button variant={entry.published ? "tonal" : "outlined"} disabled={isMutating || (!entry.published && !canPublish)} onClick={() => void onSetPublication(entry, !entry.published)}>{t(entry.published ? "apps.unpublish" : "apps.publish")}</Button>
        <Button variant="ghost" disabled={isMutating} onClick={() => void onDelete(entry).then(onBack)}>{t("apps.removeFromCatalog")}</Button>
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
  const { t } = useLocalization();
  if (isLoading) {
    return <div className="px-5 py-6 text-sm text-hc-muted">{t("apps.loadingCatalog")}</div>;
  }

  if (entries.length === 0) {
    return <div className="px-5 py-6 text-sm text-hc-muted">{t("apps.noCatalogEntries")}</div>;
  }

  return (
    <Table className="rounded-none border-0 shadow-none">
      <thead className="border-b border-hc-outline text-xs uppercase tracking-wide text-hc-muted">
        <tr>
          <th className="px-5 py-3 font-semibold">{t("licensing.application")}</th>
          <th className="px-5 py-3 font-semibold">{t("apps.source")}</th>
          <th className="px-5 py-3 font-semibold">{t("apps.license")}</th>
          <th className="px-5 py-3 font-semibold">{t("common.status")}</th>
          <th className="px-5 py-3 font-semibold">{t("common.actions")}</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => {
          const installed = installedByAppId.get(entry.app_id);
          const runtimeStatus = getCatalogRuntimeStatus(entry, t);
          return (
            <tr key={entry.app_id}>
              <td>
                <div className="font-medium">{entry.app_name}</div>
                <div className="truncate text-xs text-hc-muted" title={entry.app_id}>{entry.app_id}</div>
              </td>
              <td className="text-sm">
                <span>{translateAppValue(entry.source_type, t)}</span><span className="ml-2 text-xs text-hc-muted">{entry.namespace ?? t("apps.noNamespace")}</span>
              </td>
              <td>
                {entry.license_required ? <Badge tone="warn">{t("apps.required")}</Badge> : <Badge tone="good">{t("apps.free")}</Badge>}
              </td>
              <td>
                <div className="flex flex-wrap gap-1.5" title={runtimeStatus.detail ?? undefined}>
                  <Badge tone={entry.trust_status === "official" || entry.trust_status === "verified" ? "good" : "neutral"}>
                    {translateAppValue(entry.trust_status, t)}
                  </Badge>
                  <Badge tone={runtimeStatus.tone}>{runtimeStatus.label}</Badge>
                  {entry.published ? <Badge tone="good">{t("apps.feed")}</Badge> : <Badge>{translateAppValue(entry.publish_status, t)}</Badge>}
                </div>
              </td>
              <td>
                <div className="flex justify-end gap-1.5">
                  {!installed && <Button size="sm" variant="outlined" disabled={isMutating} onClick={() => onInstall(entry)}>{t("apps.install")}</Button>}
                  <Button size="sm" variant="ghost" onClick={() => onOpen(entry)}>{t("common.open")}</Button>
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
  onStopRuntime,
  onRotateRuntimeToken,
  onUpdateRuntime,
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
  onStopRuntime: (app: InstalledApp) => Promise<void>;
  onRotateRuntimeToken: (app: InstalledApp) => Promise<void>;
  onUpdateRuntime: (app: InstalledApp) => void;
  onRefreshCatalog: (app: InstalledApp) => Promise<void>;
  onRefreshArtifact: (app: InstalledApp) => Promise<void>;
  onUninstall: (app: InstalledApp) => void;
  isMutating: boolean;
}) {
  const { locale, t } = useLocalization();
  const diagnostics = useRunAppDiagnosticsMutation();
  const status = getInstalledStatus(app, registrySlugs, t);
  const availability = selectInstalledAppAvailability(app);
  const localization = readAppLocalization(app);
  const effectiveLocale = localization.supportedLocales.includes(locale) ? locale : localization.defaultLocale;
  const runtimeTone = app.runtime_health.status === "healthy" ? "good" : app.runtime_health.status === "degraded" ? "warn" : "danger";

  return (
    <Card className="overflow-hidden p-0">
      <SectionHeader title={pickAppDisplayName(app)} description={app.app_id} meta={<Button size="sm" variant="outlined" onClick={onBack}>{t("apps.backToInstalled")}</Button>} />
      <div className="flex flex-wrap gap-1.5 border-t border-hc-outline px-4 py-3">
        <Badge tone={status.tone}>{status.label}</Badge>
        {app.app_version && <Badge>{app.app_version}</Badge>}
        {app.update_signal && <Badge tone="warn">{t("apps.updateSignal")}</Badge>}
        {app.catalog_update?.state === "available" && <Badge tone="warn">{t("apps.catalogUpdateAvailable")}</Badge>}
        {app.managed_runtime && <Badge>{t("apps.managedRuntime")}</Badge>}
        <Badge tone={runtimeTone}>{t(`runtime.status.${app.runtime_health.status}`)}</Badge>
        <Badge tone={effectiveLocale === locale ? "good" : "neutral"}>{getLocaleLabel(effectiveLocale)}</Badge>
      </div>
      <dl className="grid border-t border-hc-outline md:grid-cols-2">
        <DetailCell label={t("apps.installationStatus")} value={t(`apps.installation.${availability.installationStatus}`)} />
        <DetailCell label={t("apps.runtime")} value={t(`runtime.status.${availability.runtimeHealth}`)} />
        <DetailCell label={t("apps.licenseStatus")} value={t(`apps.licenseStatus.${availability.licenseStatus}`)} />
        <DetailCell label={t("apps.uiIntegration")} value={t(`apps.uiStatus.${availability.uiStatus}`)} />
        <DetailCell label={t("apps.lastHealthCheck")} value={formatDate(app.last_health_check?.checked_at ?? app.runtime_health.last_checked_at)} />
        <DetailCell label={t("apps.availabilityReason")} value={availability.reason ? t(`apps.reason.${availability.reason}`) : t("apps.reason.none")} />
        <DetailCell label={t("apps.runtimeOwner")} value={app.managed_runtime ? `${app.managed_runtime.compose_project} / ${app.managed_runtime.service_name}` : t("apps.external")} />
        <DetailCell label={t("apps.entitlement")} value={app.resolved_entitlement ? t("apps.validTo", { tier: app.resolved_entitlement.tier, date: formatDate(app.resolved_entitlement.valid_to) }) : t("apps.noActiveEntitlement")} />
        <DetailCell label={t("apps.languages")} value={localization.supportedLocales.map(getLocaleLabel).join(", ")} />
        <DetailCell label="UI URL" value={app.ui_url} />
        <DetailCell label={t("apps.catalogState")} value={app.catalog_update ? `${app.catalog_update.state} · ${app.catalog_update.source_type} / ${app.catalog_update.trust_status}` : t("apps.notChecked")} />
      </dl>
      {status.detail && <div className="border-t border-hc-warning/30 bg-hc-warning/10 px-4 py-3 text-sm text-hc-warning">{status.detail}</div>}
      {diagnostics.data && <div className="border-t border-hc-outline px-4 py-3"><div className="mb-2 text-sm font-semibold">{t("apps.diagnostics")}</div><div className="grid gap-2 md:grid-cols-2">{diagnostics.data.checks.map((check) => <div key={check.id} className="flex gap-2 text-sm"><Badge tone={check.status === "passed" ? "good" : check.status === "warning" ? "warn" : "danger"}>{t(`apps.diagnosticStatus.${check.status}`)}</Badge><div><div className="font-medium">{t(`apps.diagnostic.${check.id}`)}</div><div className="text-xs text-hc-muted">{check.message}</div></div></div>)}</div></div>}
      {app.update_signal && <div className="border-t border-hc-warning/30 bg-hc-warning/10 px-4 py-3 text-sm">
        <div className="font-semibold text-hc-warning">{t("apps.updateReportedBy", { source: app.update_signal.source })}</div>
        <div className="mt-1 text-xs text-hc-muted">{app.update_signal.note ?? t("apps.noNote")} · {formatDate(app.update_signal.reported_at)}</div>
      </div>}
      <div className="flex flex-wrap justify-end gap-2 border-t border-hc-outline px-4 py-3">
        <Button variant="tonal" disabled={diagnostics.isPending} onClick={() => diagnostics.mutate(app.app_id)}>{diagnostics.isPending ? t("apps.runningDiagnostics") : t("apps.runDiagnostics")}</Button>
        <Button variant="tonal" onClick={() => onLicense(app.app_id)}>{t("apps.manageLicense")}</Button>
        <Button variant="outlined" disabled={isMutating} onClick={() => void onCheckUpdate(app)}>{t("apps.checkUpdate")}</Button>
        {app.update_signal && <Button variant="ghost" disabled={isMutating} onClick={() => void onClearUpdateSignal(app)}>{t("apps.clearSignal")}</Button>}
        <Button variant="outlined" disabled={isMutating} onClick={() => void onIssueAppToken(app)}>{t("apps.issueToken")}</Button>
        {app.managed_runtime && <Button variant="outlined" disabled={isMutating} onClick={() => void onRotateRuntimeToken(app)}>{t("apps.rotateRuntimeToken")}</Button>}
        {app.managed_runtime && <Button variant="outlined" disabled={isMutating} onClick={() => onUpdateRuntime(app)}>{t("apps.updateRuntime")}</Button>}
        {app.managed_runtime && <Button variant="ghost" disabled={isMutating} onClick={() => void onStopRuntime(app)}>{t("apps.stopRuntime")}</Button>}
        <Button variant="outlined" disabled={isMutating} onClick={() => void onRefreshCatalog(app)}>{t("apps.refreshCatalog")}</Button>
        <Button variant="outlined" disabled={isMutating} onClick={() => void onRefreshArtifact(app)}>{t("apps.refreshArtifact")}</Button>
        <Button variant="ghost" onClick={() => onUninstall(app)}>{t("apps.uninstall")}</Button>
      </div>
    </Card>
  );
}

function InstalledTable({
  apps,
  isLoading,
  onLicense,
  onOpen,
}: {
  apps: InstalledApp[];
  isLoading: boolean;
  onLicense: (appId: string) => void;
  onOpen: (app: InstalledApp) => void;
}) {
  const { t } = useLocalization();
  if (isLoading) {
    return <div className="px-5 py-6 text-sm text-hc-muted">{t("apps.loadingInstalled")}</div>;
  }

  if (apps.length === 0) {
    return <div className="px-5 py-6 text-sm text-hc-muted">{t("apps.noInstalled")}</div>;
  }

  return (
    <Table className="rounded-none border-0 shadow-none">
      <thead className="border-b border-hc-outline text-xs uppercase tracking-wide text-hc-muted">
        <tr>
          <th className="px-5 py-3 font-semibold">{t("licensing.application")}</th>
          <th className="px-5 py-3 font-semibold">{t("apps.runtime")}</th>
          <th className="px-5 py-3 font-semibold">{t("apps.entitlement")}</th>
          <th className="px-5 py-3 font-semibold">{t("apps.updates")}</th>
          <th className="px-5 py-3 font-semibold">{t("common.actions")}</th>
        </tr>
      </thead>
      <tbody>
        {apps.map((app) => {
          const runtimeTone = app.runtime_health.status === "healthy" ? "good" : app.runtime_health.status === "degraded" ? "warn" : "danger";
          return (
            <tr key={app.app_id}>
              <td>
                <div className="font-medium">{pickAppDisplayName(app)}</div>
                <div className="truncate text-xs text-hc-muted" title={app.app_id}>{app.app_id}{app.app_version ? ` · ${app.app_version}` : ""}</div>
              </td>
              <td title={app.runtime_health.message ?? undefined}>
                <Badge tone={runtimeTone}>{t(`runtime.status.${app.runtime_health.status}`)}</Badge>
                {app.runtime_health.last_checked_at && <div className="mt-1 text-xs text-hc-muted">{formatDate(app.runtime_health.last_checked_at)}</div>}
              </td>
              <td className="text-sm">
                {app.resolved_entitlement ? (
                  <span>{t("apps.validTo", { tier: app.resolved_entitlement.tier, date: formatDate(app.resolved_entitlement.valid_to) })}</span>
                ) : (
                  <span className="text-hc-muted">{t("apps.noneSelected")}</span>
                )}
              </td>
              <td>
                <div className="flex flex-wrap gap-1.5">
                  {app.update_signal && <Badge tone="warn">{t("apps.signal")}</Badge>}
                  {app.catalog_update?.state === "available" && <Badge tone="warn">{t("apps.available")}</Badge>}
                  {app.catalog_update?.state === "same" && <Badge tone="good">{t("apps.current")}</Badge>}
                  {!app.update_signal && !app.catalog_update && <span className="text-xs text-hc-muted">{t("apps.notChecked")}</span>}
                </div>
              </td>
              <td>
                <div className="flex justify-end gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => onLicense(app.app_id)}>{t("apps.manageLicense")}</Button>
                  <Button size="sm" variant="ghost" onClick={() => onOpen(app)}>{t("common.open")}</Button>
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
  const { t } = useLocalization();
  if (state.status === "idle") {
    return null;
  }

  const copyToken = () => {
    void navigator.clipboard?.writeText(state.token.access_token);
  };

  return (
    <Dialog open title={t("apps.tokenTitle")} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <div className="text-lg font-semibold">{pickAppDisplayName(state.app)}</div>
          <div className="mt-1 text-sm text-hc-muted">
            {t("apps.tokenDescription", { date: formatDate(state.token.expires_at) })}
          </div>
        </div>
        <Textarea
          readOnly
          className="min-h-36 font-mono text-xs"
          value={state.token.access_token}
        />
        <div className="flex justify-end gap-2">
          <Button variant="outlined" onClick={copyToken}>
            {t("apps.copyToken")}
          </Button>
          <Button onClick={onClose}>{t("common.done")}</Button>
        </div>
      </div>
    </Dialog>
  );
}

function CatalogInstallDialog({
  state,
  runtimeApprovalConfirmed,
  onRuntimeApprovalChange,
  onModeChange,
  onClose,
  onConfirm,
}: {
  state: InstallDialogState;
  runtimeApprovalConfirmed: boolean;
  onRuntimeApprovalChange: (confirmed: boolean) => void;
  onModeChange: (mode: InstallCatalogEntryMode) => void;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const { t } = useLocalization();
  if (state.status === "idle") {
    return null;
  }

  const entry = state.entry;
  const plan = state.plan;
  const operation = state.operation;
  const mode = state.status === "result" ? undefined : state.mode;
  const isRunning = state.status === "running";
  const composeApprovalBlocked =
    mode === "compose" &&
    (!runtimeApprovalConfirmed || !plan.package_sha256 || !plan.package_url || !plan.compose_file);

  return (
    <Dialog open title={t(operation === "update" ? "apps.updateRuntime" : "apps.installApp")} disableClose={isRunning} onClose={onClose}>
      <div>
        <div className="text-lg font-semibold">{t(operation === "update" ? "apps.update" : "apps.install")} {entry.app_name}</div>
        <div className="mt-3 rounded-hc-md border border-hc-outline bg-hc-surface-variant p-3">
          <div className="text-sm font-medium">{entry.app_id}</div>
          <div className="mt-1 text-xs text-hc-muted">{entry.base_url}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {entry.license_required ? <Badge tone="warn">{t("apps.licenseRequired")}</Badge> : <Badge tone="good">{t("apps.free")}</Badge>}
            <Badge>{translateAppValue(entry.trust_status, t)}</Badge>
          </div>
        </div>

        {state.status !== "result" && operation === "install" && (
          <div className="mt-4 grid gap-2">
            {[
              ["external", t("apps.externalService"), t("apps.externalServiceDescription")],
              ["stage_only", t("apps.stageOnly"), t("apps.stageOnlyDescription")],
              ["compose", t("apps.managedCompose"), t("apps.managedComposeDescription")],
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
          <div className="font-semibold uppercase tracking-wide text-hc-muted">{t("apps.deploymentPlan")}</div>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            <PlanItem label={t("apps.mode")} value={translateAppValue(plan.mode, t)} />
            <PlanItem label={t("apps.service")} value={plan.service_name} />
            <PlanItem label={t("apps.internalUrl")} value={plan.internal_base_url} />
            <PlanItem label={t("apps.composeProject")} value={plan.compose_project} />
            <PlanItem label={t("apps.composeFile")} value={plan.compose_file ?? t("apps.notDeclared")} />
            <PlanItem label="Manifest SHA-256" value={entry.manifest_hash} />
            <PlanItem label="Package SHA-256" value={plan.package_sha256 ?? t("apps.notDeclared")} />
            <PlanItem label={t("apps.hostAccess")} value={t(plan.host_mounts_allowed ? "apps.allowed" : "apps.blocked")} />
          </dl>
        </div>

        {mode === "compose" && state.status !== "result" && (
          <label className="mt-4 flex items-start gap-3 rounded-hc-md border border-hc-warning/40 bg-hc-warning/5 p-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={runtimeApprovalConfirmed}
              onChange={(event) => onRuntimeApprovalChange(event.target.checked)}
              disabled={isRunning || !plan.package_sha256 || !plan.package_url || !plan.compose_file}
            />
            <span>
              <span className="block font-medium text-hc-text">{t("apps.approveManagedRuntime", { operation: t(operation === "update" ? "apps.update" : "apps.start") })}</span>
              <span className="mt-1 block text-xs text-hc-muted">
                {t("apps.approveManagedRuntimeDescription", { operation: t(operation === "update" ? "apps.replace" : "apps.start") })}
              </span>
              {(!plan.package_sha256 || !plan.package_url || !plan.compose_file) && (
                <span className="mt-2 block text-xs text-hc-danger">
                  {t("apps.approvalRequirements")}
                </span>
              )}
            </span>
          </label>
        )}

        {state.status === "running" && <div className="mt-4 text-sm text-hc-muted">{t(operation === "update" ? "apps.runtimeUpdateRunning" : "apps.installationRunning")}</div>}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isRunning}>
            {t(state.status === "result" ? "common.close" : "common.cancel")}
          </Button>
          {state.status !== "result" && (
            <Button onClick={() => void onConfirm()} disabled={isRunning || composeApprovalBlocked}>
              {t(isRunning ? "apps.running" : "apps.approve")}
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
  const { t } = useLocalization();
  return (
    <Dialog open={state.status !== "idle"} title={t("apps.uninstallTitle")} disableClose={state.status === "running"} onClose={onClose}>
      {state.status === "confirm" && (
        <div>
          <div className="text-lg font-semibold">{t("apps.confirmUninstall")}</div>
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
              {t("apps.uninstallDescription")}
            </span>
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" disabled={!confirmChecked} onClick={() => void onConfirm(state.app)}>
              {t("apps.uninstall")}
            </Button>
          </div>
        </div>
      )}

      {state.status === "running" && <div className="text-sm text-hc-muted">{t("apps.uninstallRunning")}</div>}

      {state.status === "success" && (
        <div>
          <div className="text-lg font-semibold">{t("apps.uninstallCompleted")}</div>
          <div className="mt-5 flex justify-end">
            <Button onClick={onClose}>{t("common.close")}</Button>
          </div>
        </div>
      )}

      {state.status === "error" && (
        <div>
          <div className="text-lg font-semibold text-hc-danger">{t("apps.uninstallFailed")}</div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              {t("common.close")}
            </Button>
            <Button variant="danger" onClick={() => void onConfirm(state.app)}>
              {t("apps.retry")}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
