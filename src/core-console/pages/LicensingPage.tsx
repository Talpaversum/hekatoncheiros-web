import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

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
import { Field, PageHeader, SectionHeader, StatusBadge } from "../../ui-kit/components/Page";
import { Select } from "../../ui-kit/components/Select";
import { ToastNotice } from "../../ui-kit/components/ToastNotice";
import { Textarea } from "../../ui-kit/components/Textarea";

type LicensingSection = "inventory" | "import" | "activation";

function readSection(pathname: string): LicensingSection {
  if (pathname.endsWith("/import")) return "import";
  if (pathname.endsWith("/activation")) return "activation";
  return "inventory";
}

export function LicensingPage() {
  const location = useLocation();
  const section = readSection(location.pathname);
  const { data: context } = useContextQuery(true);
  const tenantId = context?.tenant.id ?? null;
  const { t } = useLocalization();

  const [appId, setAppId] = useState("talpaversum/inventory");
  const [licenseJws, setLicenseJws] = useState("");
  const [authorCertJws, setAuthorCertJws] = useState("");
  const [issuerUrl, setIssuerUrl] = useState("");
  const [licenseMode, setLicenseMode] = useState<"portable" | "instance_bound">("portable");
  const [oauthCode, setOauthCode] = useState("");
  const [oauthState, setOauthState] = useState("");
  const [oauthRedirectUrl, setOauthRedirectUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: instanceData } = usePlatformInstanceIdQuery(tenantId, Boolean(tenantId));
  const { data: licensesData, isLoading } = useTenantLicensesQuery(tenantId, appId, Boolean(tenantId));

  const validateMutation = useValidateLicenseMutation(tenantId);
  const importMutation = useImportLicenseMutation(tenantId);
  const selectMutation = useSelectLicenseMutation(tenantId);
  const startOauthMutation = useStartLicenseOAuthMutation(tenantId);
  const callbackMutation = useHandleLicenseOAuthCallbackMutation(tenantId);

  const selectedLicense = useMemo(
    () => licensesData?.items.find((item) => item.jti === licensesData.selected_entitlement_id) ?? null,
    [licensesData],
  );

  const clearNotice = () => {
    setMessage(null);
    setError(null);
  };

  const handleValidate = async () => {
    clearNotice();
    try {
      const result = await validateMutation.mutateAsync({
        license_jws: licenseJws,
        author_cert_jws: authorCertJws || undefined,
      });
      setMessage(t("licensing.validationResult", { status: result.status, errors: result.errors.length ? ` (${result.errors.join("; ")})` : "" }));
    } catch (e) {
      setError(readErrorMessage(e));
    }
  };

  const handleImport = async () => {
    clearNotice();
    try {
      const result = await importMutation.mutateAsync({
        license_jws: licenseJws,
        author_cert_jws: authorCertJws || undefined,
      });
      setMessage(t("licensing.imported", { id: result.item.jti, status: result.item.status }));
    } catch (e) {
      setError(readErrorMessage(e));
    }
  };

  const handleSelect = async (entitlementId: string) => {
    clearNotice();
    try {
      await selectMutation.mutateAsync({ app_id: appId, entitlement_id: entitlementId });
      setMessage(t("licensing.selected"));
    } catch (e) {
      setError(readErrorMessage(e));
    }
  };

  const handleOauthStart = async () => {
    clearNotice();
    try {
      const result = await startOauthMutation.mutateAsync({
        issuer: issuerUrl,
        app_id: appId,
        license_mode: licenseMode,
        auto_select: false,
      });
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

  const sectionMeta = {
    inventory: [t("nav.licenseInventory"), t("licensing.inventoryDescription")],
    import: [t("nav.offlineImport"), t("licensing.importDescription")],
    activation: [t("nav.oauthActivation"), t("licensing.activationDescription")],
  }[section];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow={t("nav.licensing")} title={sectionMeta[0]} description={sectionMeta[1]} />

      <Card className="my-4 grid gap-3 border border-hc-outline p-3 shadow-none md:grid-cols-[minmax(16rem,1fr)_minmax(18rem,1.4fr)] md:items-end">
        <Field label={t("licensing.application")}>
          <Input value={appId} onChange={(event) => setAppId(event.target.value)} placeholder="author_id/slug" />
        </Field>
        <div className="min-w-0">
          <div className="text-xs font-medium text-hc-muted">{t("licensing.platformInstanceId")}</div>
          <div className="mt-1 truncate rounded-hc-sm bg-hc-surface-variant px-3 py-2 font-mono text-xs" title={instanceData?.platform_instance_id}>
            {instanceData?.platform_instance_id ?? t("common.loading")}
          </div>
        </div>
      </Card>

      {section === "inventory" && (
        <Card className="overflow-hidden p-0">
          <SectionHeader title={t("licensing.entitlements")} description={selectedLicense ? t("licensing.activeEntitlement", { id: selectedLicense.jti }) : t("licensing.noActiveEntitlement")} meta={<StatusBadge>{t("common.total", { count: licensesData?.items.length ?? 0 })}</StatusBadge>} />
          <div className="overflow-x-auto border-t border-hc-outline">
            <div className="min-w-[680px]">
              <div className="grid grid-cols-[minmax(16rem,1.5fr)_8rem_9rem_10rem_5rem] gap-3 bg-hc-surface-variant/40 px-4 py-2 text-xs font-semibold uppercase text-hc-muted">
                <div>{t("licensing.entitlement")}</div>
                <div>{t("common.status")}</div>
                <div>{t("licensing.mode")}</div>
                <div>{t("licensing.validUntil")}</div>
                <div className="text-right">{t("common.actions")}</div>
              </div>
              {isLoading && <div className="px-4 py-6 text-center text-sm text-hc-muted">{t("licensing.loading")}</div>}
              {!isLoading && (licensesData?.items.length ?? 0) === 0 && (
                <div className="px-4 py-8 text-center text-sm text-hc-muted">{t("licensing.noneFound")}</div>
              )}
              {(licensesData?.items ?? []).map((item) => (
                <LicenseRow
                  key={item.jti}
                  item={item}
                  selected={item.jti === licensesData?.selected_entitlement_id}
                  busy={selectMutation.isPending}
                  onSelect={() => void handleSelect(item.jti)}
                />
              ))}
            </div>
          </div>
        </Card>
      )}

      {section === "import" && (
        <Card className="p-0">
          <SectionHeader title={t("licensing.signedBundle")} description={t("licensing.signedBundleDescription")} />
          <div className="grid gap-4 border-t border-hc-outline p-4">
            <Field label={t("licensing.licenseJws")}>
              <Textarea
                className="min-h-36 font-mono text-xs"
                value={licenseJws}
                onChange={(event) => setLicenseJws(event.target.value)}
                placeholder={t("licensing.pasteLicenseJws")}
              />
            </Field>
            <Field label={t("licensing.authorCertificateOptional")}>
              <Textarea
                className="min-h-24 font-mono text-xs"
                value={authorCertJws}
                onChange={(event) => setAuthorCertJws(event.target.value)}
                placeholder={t("licensing.pasteAuthorCertificate")}
              />
            </Field>
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
              <Field label={t("licensing.issuerUrl")}>
                <Input value={issuerUrl} onChange={(event) => setIssuerUrl(event.target.value)} placeholder="https://issuer.example" />
              </Field>
              <Field label={t("licensing.licenseMode")}>
                <Select value={licenseMode} onChange={(event) => setLicenseMode(event.target.value as "portable" | "instance_bound")}>
                  <option value="portable">{t("licensing.portable")}</option>
                  <option value="instance_bound">{t("licensing.instanceBound")}</option>
                </Select>
              </Field>
              <Button onClick={() => void handleOauthStart()} disabled={startOauthMutation.isPending || !issuerUrl}>{t("licensing.startActivation")}</Button>
            </div>

            {oauthRedirectUrl && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-y border-hc-outline bg-hc-surface-variant/40 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-xs font-medium">{t("licensing.authorizationReady")}</div>
                  <div className="mt-0.5 truncate text-xs text-hc-muted">{t("licensing.authorizationReadyDescription")}</div>
                </div>
                <a className="rounded-hc-md bg-hc-primary px-3 py-2 text-sm font-semibold text-hc-on-primary" href={oauthRedirectUrl} target="_blank" rel="noreferrer">
                  {t("licensing.openVendor")}
                </a>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <Field label={t("licensing.callbackCode")}>
                <Input value={oauthCode} onChange={(event) => setOauthCode(event.target.value)} placeholder={t("licensing.authorizationCode")} />
              </Field>
              <Field label={t("licensing.oauthState")}>
                <Input value={oauthState} onChange={(event) => setOauthState(event.target.value)} placeholder={t("licensing.state")} />
              </Field>
              <Button variant="outlined" onClick={() => void handleOauthCallback()} disabled={callbackMutation.isPending || !oauthCode || !oauthState}>
                {t("licensing.completeCallback")}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <ToastNotice message={error ?? message} tone={error ? "danger" : "success"} onDismiss={clearNotice} />
    </div>
  );
}

function LicenseRow({ item, selected, busy, onSelect }: { item: TenantLicenseItem; selected: boolean; busy: boolean; onSelect: () => void }) {
  const { t } = useLocalization();
  return (
    <div className="grid grid-cols-[minmax(16rem,1.5fr)_8rem_9rem_10rem_5rem] items-center gap-3 border-t border-hc-outline px-4 py-2.5 text-sm">
      <div className="min-w-0">
        <div className="truncate font-mono text-xs" title={item.jti}>{item.jti}</div>
        <div className="mt-0.5 text-xs text-hc-muted">{new Date(item.created_at).toLocaleDateString()}</div>
      </div>
      <div><LicenseStatusBadge status={item.status} /></div>
      <div className="text-xs">{item.license_mode === "instance_bound" ? t("licensing.instanceBound") : t("licensing.portable")}</div>
      <div className="text-xs">{item.valid_to ? new Date(item.valid_to).toLocaleDateString() : t("licensing.noExpiration")}</div>
      <Button className="px-2 py-1 text-xs" variant={selected ? "tonal" : "ghost"} onClick={onSelect} disabled={selected || busy}>
        {selected ? t("common.active") : t("licensing.select")}
      </Button>
    </div>
  );
}

function LicenseStatusBadge({ status }: { status: string }) {
  const { t } = useLocalization();
  const tone = status === "active" || status === "valid" ? "bg-hc-success/10 text-hc-success" : "bg-hc-surface-variant text-hc-muted";
  const key = `licensing.status.${status}`;
  const translated = t(key);
  return <span className={`rounded-hc-sm px-2 py-1 text-xs ${tone}`}>{translated === key ? status : translated}</span>;
}
