import { useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { hasPrivilege } from "../../access/privileges";
import { useAppCatalogQuery } from "../../data/api/app-catalog";
import { useAppRegistryQuery } from "../../data/api/app-registry";
import { useContextQuery } from "../../data/api/context";
import {
  useHandleLicenseOAuthCallbackMutation,
  useImportLicenseMutation,
  usePlatformInstanceIdQuery,
  useSelectLicenseMutation,
  useStartLicenseOAuthMutation,
  useTenantLicensesQuery,
  useValidateLicenseMutation,
  type TenantLicenseItem,
} from "../../data/api/licensing";
import { readErrorMessage } from "../../data/api/read-error-message";
import { useLocalization } from "../../localization/LocalizationProvider";
import { Button } from "../../ui-kit/components/Button";
import { Card } from "../../ui-kit/components/Card";
import { Input } from "../../ui-kit/components/Input";
import { EmptyState, Field, MetricStrip, PageHeader, SectionHeader, StatusBadge } from "../../ui-kit/components/Page";
import { Select } from "../../ui-kit/components/Select";
import { ToastNotice } from "../../ui-kit/components/ToastNotice";
import { Textarea } from "../../ui-kit/components/Textarea";

type LicensingSection = "overview" | "entitlements" | "import" | "activation" | "selections";

function readSection(pathname: string): LicensingSection {
  if (pathname.endsWith("/entitlements")) return "entitlements";
  if (pathname.endsWith("/import")) return "import";
  if (pathname.endsWith("/activation")) return "activation";
  if (pathname.endsWith("/selections")) return "selections";
  return "overview";
}

export function LicensingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const section = readSection(location.pathname);
  const { data: context } = useContextQuery(true);
  const tenantId = context?.tenant.id ?? null;
  const canManageApps = hasPrivilege(context?.privileges ?? [], "platform.apps.manage");
  const { data: registryData } = useAppRegistryQuery(true);
  const { data: catalogData } = useAppCatalogQuery(canManageApps);
  const { t } = useLocalization();

  const appOptions = useMemo(() => {
    const options = new Map<string, { id: string; name: string; installed: boolean }>();
    for (const app of catalogData?.items ?? []) {
      options.set(app.app_id, { id: app.app_id, name: app.app_name, installed: Boolean(app.installed) });
    }
    for (const app of registryData?.items ?? []) {
      options.set(app.app_id, { id: app.app_id, name: app.app_name ?? app.app_id, installed: true });
    }
    return [...options.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [catalogData?.items, registryData?.items]);

  const requestedAppId = searchParams.get("app") ?? "";
  const appId = requestedAppId || appOptions[0]?.id || "";
  const selectedCatalogApp = catalogData?.items.find((app) => app.app_id === appId);
  const selectedRegistryApp = registryData?.items.find((app) => app.app_id === appId);
  const [licenseJws, setLicenseJws] = useState("");
  const [authorCertJws, setAuthorCertJws] = useState("");
  const [issuerUrl, setIssuerUrl] = useState("");
  const [licenseMode, setLicenseMode] = useState<"portable" | "instance_bound">("portable");
  const [oauthCode, setOauthCode] = useState("");
  const [oauthState, setOauthState] = useState("");
  const [oauthRedirectUrl, setOauthRedirectUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTime] = useState(() => Date.now());

  const { data: instanceData } = usePlatformInstanceIdQuery(tenantId, Boolean(tenantId));
  const { data: licensesData, isLoading } = useTenantLicensesQuery(tenantId, appId || null, Boolean(tenantId && appId));
  const validateMutation = useValidateLicenseMutation(tenantId);
  const importMutation = useImportLicenseMutation(tenantId);
  const selectMutation = useSelectLicenseMutation(tenantId);
  const startOauthMutation = useStartLicenseOAuthMutation(tenantId);
  const callbackMutation = useHandleLicenseOAuthCallbackMutation(tenantId);

  const selectedLicense = useMemo(
    () => licensesData?.items.find((item) => item.jti === licensesData.selected_entitlement_id) ?? null,
    [licensesData],
  );
  const invalidLicenses = (licensesData?.items ?? []).filter((item) => ["invalid", "expired", "revoked"].includes(item.status)).length;
  const expiringSoon = (licensesData?.items ?? []).filter((item) => {
    if (!item.valid_to || ["invalid", "expired", "revoked"].includes(item.status)) return false;
    const remaining = new Date(item.valid_to).getTime() - currentTime;
    return remaining >= 0 && remaining <= 30 * 24 * 60 * 60 * 1000;
  }).length;
  const appsRequiringLicense = canManageApps ? (catalogData?.items ?? []).filter((app) => app.license_required).length : null;

  const clearNotice = () => {
    setMessage(null);
    setError(null);
  };

  const navigateTo = (path: string) => {
    navigate(appId ? `${path}?app=${encodeURIComponent(appId)}` : path);
  };

  const selectApp = (nextAppId: string) => {
    const next = new URLSearchParams(searchParams);
    if (nextAppId) next.set("app", nextAppId);
    else next.delete("app");
    setSearchParams(next);
    setIssuerUrl(catalogData?.items.find((app) => app.app_id === nextAppId)?.license_issuer_url ?? "");
  };

  const handleValidate = async () => {
    clearNotice();
    try {
      const result = await validateMutation.mutateAsync({ license_jws: licenseJws, author_cert_jws: authorCertJws || undefined });
      setMessage(t("licensing.validationResult", { status: result.status, errors: result.errors.length ? ` (${result.errors.join("; ")})` : "" }));
    } catch (e) {
      setError(readErrorMessage(e));
    }
  };

  const handleImport = async () => {
    clearNotice();
    try {
      const result = await importMutation.mutateAsync({ license_jws: licenseJws, author_cert_jws: authorCertJws || undefined });
      setMessage(t("licensing.imported", { id: result.item.jti, status: result.item.status }));
      selectApp(result.item.app_id);
    } catch (e) {
      setError(readErrorMessage(e));
    }
  };

  const handleSelect = async (entitlementId: string) => {
    if (!appId) return;
    clearNotice();
    try {
      await selectMutation.mutateAsync({ app_id: appId, entitlement_id: entitlementId });
      setMessage(t("licensing.selected"));
    } catch (e) {
      setError(readErrorMessage(e));
    }
  };

  const handleOauthStart = async () => {
    const effectiveIssuerUrl = issuerUrl || selectedCatalogApp?.license_issuer_url || "";
    if (!appId || !effectiveIssuerUrl) return;
    clearNotice();
    try {
      const result = await startOauthMutation.mutateAsync({ issuer: effectiveIssuerUrl, app_id: appId, license_mode: licenseMode, auto_select: false });
      setOauthState(result.state);
      setOauthRedirectUrl(result.redirect_url);
      setMessage(t("licensing.authorizationCreated"));
    } catch (e) {
      setError(readErrorMessage(e));
    }
  };

  const handleOauthCallback = async () => {
    clearNotice();
    try {
      const result = await callbackMutation.mutateAsync({ code: oauthCode, state: oauthState });
      setMessage(t("licensing.vendorImported", { id: result.item.jti }));
    } catch (e) {
      setError(readErrorMessage(e));
    }
  };

  const sectionMeta: Record<LicensingSection, [string, string]> = {
    overview: [t("licensing.overview"), t("licensing.overviewDescription")],
    entitlements: [t("nav.entitlements"), t("licensing.inventoryDescription")],
    import: [t("nav.importOfflineLicense"), t("licensing.importDescription")],
    activation: [t("nav.activateFromVendor"), t("licensing.activationDescription")],
    selections: [t("nav.activeSelections"), t("licensing.selectionsDescription")],
  };

  const detailPath = selectedRegistryApp
    ? `/core/apps/installed/${encodeURIComponent(appId)}`
    : selectedCatalogApp
      ? `/core/apps/catalog/${encodeURIComponent(appId)}`
      : null;

  const overviewMetrics = [
    { label: t("licensing.activeEntitlementMetric"), value: selectedLicense ? t("common.active") : t("common.none"), tone: selectedLicense ? "success" as const : "warning" as const },
    { label: t("licensing.appsRequiringLicense"), value: appsRequiringLicense ?? "-", tone: appsRequiringLicense ? "warning" as const : "neutral" as const },
    { label: t("licensing.expiringSoon"), value: expiringSoon, tone: expiringSoon > 0 ? "warning" as const : "neutral" as const },
    { label: t("licensing.invalidLicenses"), value: invalidLicenses, tone: invalidLicenses > 0 ? "danger" as const : "neutral" as const },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={t("nav.licensing")}
        title={sectionMeta[section][0]}
        description={sectionMeta[section][1]}
        actions={<MetricStrip items={overviewMetrics} />}
      />

      <Card className="grid gap-3 p-3 shadow-none md:grid-cols-[minmax(16rem,1fr)_minmax(18rem,1fr)_auto] md:items-end">
        <Field label={t("licensing.application")} hint={t("licensing.applicationPickerHint")}>
          <Select value={appOptions.some((option) => option.id === appId) ? appId : ""} onChange={(event) => selectApp(event.target.value)}>
            <option value="">{t("licensing.selectApplication")}</option>
            {appOptions.map((app) => <option key={app.id} value={app.id}>{app.name}{app.installed ? ` · ${t("apps.installed")}` : ""}</option>)}
          </Select>
        </Field>
        <div className="min-w-0">
          <div className="text-xs font-medium text-hc-muted">{t("licensing.platformInstanceId")}</div>
          <div className="mt-1 truncate rounded-hc-sm bg-hc-surface-variant px-3 py-2 font-mono text-xs" title={instanceData?.platform_instance_id}>
            {instanceData?.platform_instance_id ?? t("common.loading")}
          </div>
        </div>
        {detailPath && <Button variant="ghost" onClick={() => navigate(detailPath)}>{t("licensing.openAppDetail")}</Button>}
        <details className="md:col-span-3">
          <summary className="cursor-pointer text-xs font-medium text-hc-muted">{t("common.advanced")}</summary>
          <Field label={t("licensing.manualApplicationId")} hint={t("licensing.manualApplicationIdHint")} className="mt-2 max-w-xl">
            <Input value={appId} onChange={(event) => selectApp(event.target.value)} placeholder="author_id/slug" />
          </Field>
        </details>
      </Card>

      {section === "overview" && <>
        <Card className="overflow-hidden p-0">
          <SectionHeader
            title={(selectedCatalogApp?.app_name ?? selectedRegistryApp?.app_name ?? appId) || t("licensing.noApplicationSelected")}
            description={selectedLicense ? t("licensing.activeEntitlement", { id: selectedLicense.jti }) : t("licensing.noActiveEntitlement")}
            meta={<StatusBadge tone={selectedLicense ? "success" : "warning"}>{selectedLicense ? t("common.active") : t("common.attention")}</StatusBadge>}
          />
          <div className="flex flex-wrap justify-end gap-2 border-t border-hc-outline px-4 py-3">
            <Button variant="outlined" onClick={() => navigateTo("/core/licensing/entitlements")}>{t("licensing.reviewEntitlements")}</Button>
            <Button variant="ghost" onClick={() => navigateTo("/core/licensing/selections")}>{t("licensing.manageSelection")}</Button>
          </div>
        </Card>
      </>}

      {(section === "entitlements" || section === "selections") && (
        <LicenseInventory
          items={licensesData?.items ?? []}
          selectedEntitlementId={licensesData?.selected_entitlement_id ?? null}
          isLoading={isLoading}
          busy={selectMutation.isPending}
          onSelect={handleSelect}
        />
      )}

      {section === "import" && (
        <Card className="p-0">
          <SectionHeader title={t("licensing.signedBundle")} description={t("licensing.signedBundleDescription")} />
          <div className="grid gap-4 border-t border-hc-outline p-4">
            <Field label={t("licensing.licenseJws")}><Textarea className="min-h-36 font-mono text-xs" value={licenseJws} onChange={(event) => setLicenseJws(event.target.value)} placeholder={t("licensing.pasteLicenseJws")} /></Field>
            <Field label={t("licensing.authorCertificateOptional")}><Textarea className="min-h-24 font-mono text-xs" value={authorCertJws} onChange={(event) => setAuthorCertJws(event.target.value)} placeholder={t("licensing.pasteAuthorCertificate")} /></Field>
            <div className="flex justify-end gap-2">
              <Button variant="outlined" onClick={() => void handleValidate()} disabled={!licenseJws || validateMutation.isPending}>{t("licensing.validate")}</Button>
              <Button onClick={() => void handleImport()} disabled={!licenseJws || importMutation.isPending}>{t("licensing.import")}</Button>
            </div>
          </div>
        </Card>
      )}

      {section === "activation" && (
        <Card className="p-0">
          <SectionHeader title={t("licensing.vendorAuthorization")} description={t("licensing.vendorAuthorizationDescription")} />
          <div className="grid gap-4 border-t border-hc-outline p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_14rem_auto] md:items-end">
              <Field label={t("licensing.issuerUrl")} hint={selectedCatalogApp?.license_issuer_url ? t("licensing.issuerFromCatalog") : t("licensing.issuerUrlHint")}>
                <Input value={issuerUrl || selectedCatalogApp?.license_issuer_url || ""} onChange={(event) => setIssuerUrl(event.target.value)} placeholder="https://issuer.example" />
              </Field>
              <Field label={t("licensing.licenseMode")}><Select value={licenseMode} onChange={(event) => setLicenseMode(event.target.value as "portable" | "instance_bound")}><option value="portable">{t("licensing.portable")}</option><option value="instance_bound">{t("licensing.instanceBound")}</option></Select></Field>
              <Button onClick={() => void handleOauthStart()} disabled={startOauthMutation.isPending || !appId || !(issuerUrl || selectedCatalogApp?.license_issuer_url)}>{t("licensing.startActivation")}</Button>
            </div>
            {oauthRedirectUrl && <div className="flex flex-wrap items-center justify-between gap-3 border-y border-hc-outline bg-hc-surface-variant/40 px-3 py-2"><div><div className="text-xs font-medium">{t("licensing.authorizationReady")}</div><div className="mt-0.5 text-xs text-hc-muted">{t("licensing.authorizationReadyDescription")}</div></div><a className="rounded-hc-md bg-hc-primary px-3 py-2 text-sm font-semibold text-hc-on-primary" href={oauthRedirectUrl} target="_blank" rel="noreferrer">{t("licensing.openVendor")}</a></div>}
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <Field label={t("licensing.callbackCode")}><Input value={oauthCode} onChange={(event) => setOauthCode(event.target.value)} placeholder={t("licensing.authorizationCode")} /></Field>
              <Field label={t("licensing.oauthState")}><Input value={oauthState} onChange={(event) => setOauthState(event.target.value)} placeholder={t("licensing.state")} /></Field>
              <Button variant="outlined" onClick={() => void handleOauthCallback()} disabled={callbackMutation.isPending || !oauthCode || !oauthState}>{t("licensing.completeCallback")}</Button>
            </div>
          </div>
        </Card>
      )}

      <ToastNotice message={error ?? message} tone={error ? "danger" : "success"} onDismiss={clearNotice} />
    </div>
  );
}

function LicenseInventory({ items, selectedEntitlementId, isLoading, busy, onSelect }: { items: TenantLicenseItem[]; selectedEntitlementId: string | null; isLoading: boolean; busy: boolean; onSelect: (id: string) => Promise<void> }) {
  const { t } = useLocalization();
  return (
    <Card className="overflow-hidden p-0">
      <SectionHeader title={t("licensing.entitlements")} description={selectedEntitlementId ? t("licensing.activeEntitlement", { id: selectedEntitlementId }) : t("licensing.noActiveEntitlement")} meta={<StatusBadge>{t("common.total", { count: items.length })}</StatusBadge>} />
      <div className="overflow-x-auto border-t border-hc-outline">
        <div className="min-w-[680px]">
          <div className="grid grid-cols-[minmax(16rem,1.5fr)_8rem_9rem_10rem_5rem] gap-3 bg-hc-surface-variant/40 px-4 py-2 text-xs font-semibold uppercase text-hc-muted"><div>{t("licensing.entitlement")}</div><div>{t("common.status")}</div><div>{t("licensing.mode")}</div><div>{t("licensing.validUntil")}</div><div className="text-right">{t("common.actions")}</div></div>
          {isLoading && <div className="px-4 py-6 text-center text-sm text-hc-muted">{t("licensing.loading")}</div>}
          {!isLoading && items.length === 0 && <EmptyState>{t("licensing.noneFound")}</EmptyState>}
          {items.map((item) => <LicenseRow key={item.jti} item={item} selected={item.jti === selectedEntitlementId} busy={busy} onSelect={() => void onSelect(item.jti)} />)}
        </div>
      </div>
    </Card>
  );
}

function LicenseRow({ item, selected, busy, onSelect }: { item: TenantLicenseItem; selected: boolean; busy: boolean; onSelect: () => void }) {
  const { t } = useLocalization();
  return (
    <div className="grid grid-cols-[minmax(16rem,1.5fr)_8rem_9rem_10rem_5rem] items-center gap-3 border-t border-hc-outline px-4 py-2.5 text-sm">
      <div className="min-w-0"><div className="truncate font-mono text-xs" title={item.jti}>{item.jti}</div><div className="mt-0.5 text-xs text-hc-muted">{new Date(item.created_at).toLocaleDateString()}</div></div>
      <div><LicenseStatusBadge status={item.status} /></div>
      <div className="text-xs">{item.license_mode === "instance_bound" ? t("licensing.instanceBound") : t("licensing.portable")}</div>
      <div className="text-xs">{item.valid_to ? new Date(item.valid_to).toLocaleDateString() : t("licensing.noExpiration")}</div>
      <Button className="px-2 py-1 text-xs" variant={selected ? "tonal" : "ghost"} onClick={onSelect} disabled={selected || busy}>{selected ? t("common.active") : t("licensing.select")}</Button>
    </div>
  );
}

function LicenseStatusBadge({ status }: { status: string }) {
  const { t } = useLocalization();
  const tone = status === "active" || status === "valid" ? "success" : status === "invalid" || status === "revoked" ? "danger" : status === "expired" ? "warning" : "neutral";
  const key = `licensing.status.${status}`;
  const translated = t(key);
  return <StatusBadge tone={tone}>{translated === key ? status : translated}</StatusBadge>;
}
