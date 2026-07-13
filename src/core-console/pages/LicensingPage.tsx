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
      setMessage(`Validation: ${result.status}${result.errors.length ? ` (${result.errors.join("; ")})` : ""}`);
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
      setMessage(`Imported ${result.item.jti} (${result.item.status}).`);
    } catch (e) {
      setError(readErrorMessage(e));
    }
  };

  const handleSelect = async (entitlementId: string) => {
    clearNotice();
    try {
      await selectMutation.mutateAsync({ app_id: appId, entitlement_id: entitlementId });
      setMessage("Entitlement selected.");
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
      setMessage("Authorization request created.");
    } catch (e) {
      setError(readErrorMessage(e));
    }
  };

  const handleOauthCallback = async () => {
    clearNotice();
    try {
      const result = await callbackMutation.mutateAsync({ code: oauthCode, state: oauthState });
      setMessage(`Imported ${result.item.jti} from the vendor.`);
    } catch (e) {
      setError(readErrorMessage(e));
    }
  };

  const sectionMeta = {
    inventory: ["License inventory", "Review entitlements and choose the active license for an app."],
    import: ["Offline import", "Validate or import a signed license bundle."],
    activation: ["OAuth activation", "Request a license from a vendor and complete its callback."],
  }[section];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Licensing" title={sectionMeta[0]} description={sectionMeta[1]} />

      <Card className="my-4 grid gap-3 border border-hc-outline p-3 shadow-none md:grid-cols-[minmax(16rem,1fr)_minmax(18rem,1.4fr)] md:items-end">
        <Field label="Application">
          <Input value={appId} onChange={(event) => setAppId(event.target.value)} placeholder="author_id/slug" />
        </Field>
        <div className="min-w-0">
          <div className="text-xs font-medium text-hc-muted">Platform instance ID</div>
          <div className="mt-1 truncate rounded-hc-sm bg-hc-surface-variant px-3 py-2 font-mono text-xs" title={instanceData?.platform_instance_id}>
            {instanceData?.platform_instance_id ?? "Loading..."}
          </div>
        </div>
      </Card>

      {section === "inventory" && (
        <Card className="overflow-hidden p-0">
          <SectionHeader title="Entitlements" description={selectedLicense ? `Active: ${selectedLicense.jti}` : "No active entitlement"} meta={<StatusBadge>{licensesData?.items.length ?? 0} total</StatusBadge>} />
          <div className="overflow-x-auto border-t border-hc-outline">
            <div className="min-w-[680px]">
              <div className="grid grid-cols-[minmax(16rem,1.5fr)_8rem_9rem_10rem_5rem] gap-3 bg-hc-surface-variant/40 px-4 py-2 text-xs font-semibold uppercase text-hc-muted">
                <div>Entitlement</div>
                <div>Status</div>
                <div>Mode</div>
                <div>Valid until</div>
                <div className="text-right">Action</div>
              </div>
              {isLoading && <div className="px-4 py-6 text-center text-sm text-hc-muted">Loading licenses...</div>}
              {!isLoading && (licensesData?.items.length ?? 0) === 0 && (
                <div className="px-4 py-8 text-center text-sm text-hc-muted">No licenses found for this application.</div>
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
          <SectionHeader title="Signed bundle" description="The author certificate is optional when its key is already trusted." />
          <div className="grid gap-4 border-t border-hc-outline p-4">
            <Field label="License JWS">
              <Textarea
                className="min-h-36 font-mono text-xs"
                value={licenseJws}
                onChange={(event) => setLicenseJws(event.target.value)}
                placeholder="Paste license_jws"
              />
            </Field>
            <Field label="Author certificate JWS (optional)">
              <Textarea
                className="min-h-24 font-mono text-xs"
                value={authorCertJws}
                onChange={(event) => setAuthorCertJws(event.target.value)}
                placeholder="Paste author_cert_jws"
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outlined" onClick={() => void handleValidate()} disabled={!licenseJws || validateMutation.isPending}>Validate</Button>
              <Button onClick={() => void handleImport()} disabled={!licenseJws || importMutation.isPending}>Import</Button>
            </div>
          </div>
        </Card>
      )}

      {section === "activation" && (
        <Card className="p-0">
          <SectionHeader title="Vendor authorization" description="The vendor issues a portable or instance-bound entitlement." />
          <div className="grid gap-4 border-t border-hc-outline p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_14rem_auto] md:items-end">
              <Field label="Issuer URL">
                <Input value={issuerUrl} onChange={(event) => setIssuerUrl(event.target.value)} placeholder="https://issuer.example" />
              </Field>
              <Field label="License mode">
                <Select value={licenseMode} onChange={(event) => setLicenseMode(event.target.value as "portable" | "instance_bound")}>
                  <option value="portable">Portable</option>
                  <option value="instance_bound">Instance-bound</option>
                </Select>
              </Field>
              <Button onClick={() => void handleOauthStart()} disabled={startOauthMutation.isPending || !issuerUrl}>Start activation</Button>
            </div>

            {oauthRedirectUrl && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-y border-hc-outline bg-hc-surface-variant/40 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-xs font-medium">Authorization is ready</div>
                  <div className="mt-0.5 truncate text-xs text-hc-muted">Continue at the vendor, then enter the returned code below.</div>
                </div>
                <a className="rounded-hc-md bg-hc-primary px-3 py-2 text-sm font-semibold text-hc-on-primary" href={oauthRedirectUrl} target="_blank" rel="noreferrer">
                  Open vendor
                </a>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <Field label="Callback code">
                <Input value={oauthCode} onChange={(event) => setOauthCode(event.target.value)} placeholder="Authorization code" />
              </Field>
              <Field label="OAuth state">
                <Input value={oauthState} onChange={(event) => setOauthState(event.target.value)} placeholder="State" />
              </Field>
              <Button variant="outlined" onClick={() => void handleOauthCallback()} disabled={callbackMutation.isPending || !oauthCode || !oauthState}>
                Complete callback
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
  return (
    <div className="grid grid-cols-[minmax(16rem,1.5fr)_8rem_9rem_10rem_5rem] items-center gap-3 border-t border-hc-outline px-4 py-2.5 text-sm">
      <div className="min-w-0">
        <div className="truncate font-mono text-xs" title={item.jti}>{item.jti}</div>
        <div className="mt-0.5 text-xs text-hc-muted">{new Date(item.created_at).toLocaleDateString()}</div>
      </div>
      <div><LicenseStatusBadge status={item.status} /></div>
      <div className="text-xs">{item.license_mode === "instance_bound" ? "Instance-bound" : "Portable"}</div>
      <div className="text-xs">{item.valid_to ? new Date(item.valid_to).toLocaleDateString() : "No expiration"}</div>
      <Button className="px-2 py-1 text-xs" variant={selected ? "tonal" : "ghost"} onClick={onSelect} disabled={selected || busy}>
        {selected ? "Active" : "Select"}
      </Button>
    </div>
  );
}

function LicenseStatusBadge({ status }: { status: string }) {
  const tone = status === "active" || status === "valid" ? "bg-hc-success/10 text-hc-success" : "bg-hc-surface-variant text-hc-muted";
  return <span className={`rounded-hc-sm px-2 py-1 text-xs ${tone}`}>{status}</span>;
}
