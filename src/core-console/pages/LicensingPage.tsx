import { useMemo, useState } from "react";

import { useContextQuery } from "../../data/api/context";
import {
  useHandleLicenseOAuthCallbackMutation,
  useImportLicenseMutation,
  usePlatformInstanceIdQuery,
  useSelectLicenseMutation,
  useStartLicenseOAuthMutation,
  useTenantLicensesQuery,
  useValidateLicenseMutation,
} from "../../data/api/licensing";
import { readErrorMessage } from "../../data/api/read-error-message";
import { Button } from "../../ui-kit/components/Button";
import { Card } from "../../ui-kit/components/Card";
import { Input } from "../../ui-kit/components/Input";

export function LicensingPage() {
  const { data: context } = useContextQuery(true);
  const tenantId = context?.tenant.id ?? null;

  const [appId, setAppId] = useState("talpaversum/inventory");
  const [licenseJws, setLicenseJws] = useState("");
  const [authorCertJws, setAuthorCertJws] = useState("");
  const [issuerUrl, setIssuerUrl] = useState("");
  const [licenseMode, setLicenseMode] = useState<"portable" | "instance_bound">("portable");
  const [oauthCode, setOauthCode] = useState("");
  const [oauthState, setOauthState] = useState("");
  const [selectedJti, setSelectedJti] = useState("");
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
    () => licensesData?.items.find((item) => item.jti === licensesData.selected_license_jti) ?? null,
    [licensesData],
  );

  const handleValidate = async () => {
    setMessage(null);
    setError(null);
    try {
      const result = await validateMutation.mutateAsync({
        license_jws: licenseJws,
        author_cert_jws: authorCertJws || undefined,
      });
      setMessage(`Validate: ${result.status}${result.errors.length ? ` (${result.errors.join("; ")})` : ""}`);
    } catch (e) {
      setError(readErrorMessage(e));
    }
  };

  const handleImport = async () => {
    setMessage(null);
    setError(null);
    try {
      const result = await importMutation.mutateAsync({
        license_jws: licenseJws,
        author_cert_jws: authorCertJws || undefined,
      });
      setMessage(`Imported: ${result.item.jti} (${result.item.status})`);
      setSelectedJti(result.item.jti);
    } catch (e) {
      setError(readErrorMessage(e));
    }
  };

  const handleSelect = async () => {
    if (!selectedJti) {
      return;
    }
    setMessage(null);
    setError(null);
    try {
      await selectMutation.mutateAsync({ app_id: appId, license_jti: selectedJti });
      setMessage("License selected.");
    } catch (e) {
      setError(readErrorMessage(e));
    }
  };

  const handleOauthStart = async () => {
    setMessage(null);
    setError(null);
    try {
      const result = await startOauthMutation.mutateAsync({
        issuer: issuerUrl,
        app_id: appId,
        license_mode: licenseMode,
        auto_select: false,
      });
      setOauthState(result.state);
      setMessage(`OAuth redirect URL generated. Open this URL in browser: ${result.redirect_url}`);
    } catch (e) {
      setError(readErrorMessage(e));
    }
  };

  const handleOauthCallback = async () => {
    setMessage(null);
    setError(null);
    try {
      const result = await callbackMutation.mutateAsync({ code: oauthCode, state: oauthState });
      setMessage(`OAuth import OK: ${result.item.jti}`);
      setSelectedJti(result.item.jti);
    } catch (e) {
      setError(readErrorMessage(e));
    }
  };

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-wide text-hc-muted">Licensing</div>
        <div className="mt-1 text-2xl font-semibold">Tenant Licenses</div>
        <div className="mt-1 text-sm text-hc-muted">Manage import/validate/select + OAuth activation</div>
      </div>

      <div className="grid gap-6">
        <Card>
          <div className="text-sm font-semibold">Platform instance</div>
          <div className="mt-2 text-xs text-hc-muted">Use this ID for instance-bound purchase/issuance.</div>
          <div className="mt-3 rounded-hc-sm border border-hc-outline bg-hc-surface-variant p-3 font-mono text-xs">
            {instanceData?.platform_instance_id ?? "loading..."}
          </div>
        </Card>

        <Card>
          <div className="text-sm font-semibold">App + list</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Input value={appId} onChange={(event) => setAppId(event.target.value)} placeholder="author_id/slug" />
            <Input value={selectedJti} onChange={(event) => setSelectedJti(event.target.value)} placeholder="license_jti for selection" />
          </div>
          <div className="mt-3 text-xs text-hc-muted">Selected active license: {selectedLicense?.jti ?? "none"}</div>
          {isLoading ? (
            <div className="mt-3 text-sm">Loading licenses...</div>
          ) : (
            <div className="mt-3 space-y-2">
              {(licensesData?.items ?? []).map((item) => (
                <div key={item.jti} className="rounded-hc-sm border border-hc-outline p-2 text-xs">
                  <div className="font-mono">{item.jti}</div>
                  <div>
                    {item.status} | {item.license_mode} | {item.valid_to ?? "no-exp"}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3">
            <Button onClick={() => void handleSelect()} disabled={!selectedJti || selectMutation.isPending}>
              Select license
            </Button>
          </div>
        </Card>

        <Card>
          <div className="text-sm font-semibold">Validate / import</div>
          <div className="mt-3 grid gap-3">
            <textarea
              className="min-h-[120px] rounded-hc-md border border-hc-outline bg-transparent px-3 py-2 text-xs"
              value={licenseJws}
              onChange={(event) => setLicenseJws(event.target.value)}
              placeholder="license_jws"
            />
            <textarea
              className="min-h-[100px] rounded-hc-md border border-hc-outline bg-transparent px-3 py-2 text-xs"
              value={authorCertJws}
              onChange={(event) => setAuthorCertJws(event.target.value)}
              placeholder="author_cert_jws"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="outlined" onClick={() => void handleValidate()} disabled={validateMutation.isPending}>
              Validate
            </Button>
            <Button onClick={() => void handleImport()} disabled={importMutation.isPending}>
              Import
            </Button>
          </div>
        </Card>

        <Card>
          <div className="text-sm font-semibold">Activate via Vendor OAuth</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Input value={issuerUrl} onChange={(event) => setIssuerUrl(event.target.value)} placeholder="https://issuer.example" />
            <select
              className="w-full rounded-hc-md border border-hc-outline bg-transparent px-3 py-2 text-sm"
              value={licenseMode}
              onChange={(event) => setLicenseMode(event.target.value as "portable" | "instance_bound")}
            >
              <option value="portable">portable</option>
              <option value="instance_bound">instance_bound</option>
            </select>
            <Input value={oauthCode} onChange={(event) => setOauthCode(event.target.value)} placeholder="callback code" />
            <Input value={oauthState} onChange={(event) => setOauthState(event.target.value)} placeholder="callback state" />
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="outlined" onClick={() => void handleOauthStart()} disabled={startOauthMutation.isPending || !issuerUrl}>
              Start OAuth
            </Button>
            <Button onClick={() => void handleOauthCallback()} disabled={callbackMutation.isPending || !oauthCode || !oauthState}>
              Complete callback
            </Button>
          </div>
        </Card>

        {message && <div className="text-sm text-hc-primary">{message}</div>}
        {error && <div className="text-sm text-hc-danger">{error}</div>}
      </div>
    </div>
  );
}
