import { useMemo, useState } from "react";

import { authFetch } from "../../data/auth/auth-fetch";
import { useInstalledAppsQuery } from "../../data/api/installed-apps";
import { Button } from "../../ui-kit/components/Button";
import { Card } from "../../ui-kit/components/Card";
import { Input } from "../../ui-kit/components/Input";

export function AppsPage() {
  const { data, refetch } = useInstalledAppsQuery(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [installForm, setInstallForm] = useState({
    app_id: "",
    base_url: "",
    ui_url: "",
    required_privileges: "",
    manifest: "{}",
  });

  const installed = data?.items ?? [];
  const canSubmit = useMemo(() => installForm.app_id && installForm.base_url && installForm.ui_url, [installForm]);

  const handleInstall = async () => {
    setMessage(null);
    setError(null);
    try {
      const manifest = JSON.parse(installForm.manifest || "{}");
      const required_privileges = installForm.required_privileges
        ? installForm.required_privileges.split(",").map((item) => item.trim()).filter(Boolean)
        : [];
      await authFetch("/apps/installed", {
        method: "POST",
        body: JSON.stringify({
          app_id: installForm.app_id,
          base_url: installForm.base_url,
          ui_url: installForm.ui_url,
          manifest,
          required_privileges,
        }),
      });
      setMessage("App nainstalována");
      setInstallForm((prev) => ({ ...prev, app_id: "", base_url: "", ui_url: "" }));
      await refetch();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleUninstall = async (appId: string) => {
    setMessage(null);
    setError(null);
    await authFetch(`/apps/installed/${appId}`, { method: "DELETE" });
    setMessage("App odinstalována. Data preserved.");
    await refetch();
  };

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-wide text-hc-muted">Admin</div>
        <div className="mt-1 text-2xl font-semibold">Apps</div>
        <div className="mt-1 text-sm text-hc-muted">Temporary Dev Installer UI</div>
      </div>

      <div className="grid gap-6">
        <Card>
          <div className="text-sm font-semibold">Installed apps</div>
          <div className="mt-4 flex flex-col gap-3">
            {installed.length === 0 && <div className="text-sm text-hc-muted">Žádné appky nejsou nainstalované.</div>}
            {installed.map((app) => (
              <div key={app.app_id} className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">{app.app_id}</div>
                  <div className="text-xs text-hc-muted">{app.ui_url}</div>
                </div>
                <Button variant="outlined" onClick={() => handleUninstall(app.app_id)}>Uninstall</Button>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-hc-muted">Data preserved.</div>
        </Card>

        <Card>
          <div className="text-sm font-semibold">Install (local/dev)</div>
          <div className="mt-4 grid gap-3">
            <Input
              placeholder="app_id"
              value={installForm.app_id}
              onChange={(event) => setInstallForm((prev) => ({ ...prev, app_id: event.target.value }))}
            />
            <Input
              placeholder="base_url (např. http://127.0.0.1:4010)"
              value={installForm.base_url}
              onChange={(event) => setInstallForm((prev) => ({ ...prev, base_url: event.target.value }))}
            />
            <Input
              placeholder="ui_url (např. http://127.0.0.1:4011/plugin.js)"
              value={installForm.ui_url}
              onChange={(event) => setInstallForm((prev) => ({ ...prev, ui_url: event.target.value }))}
            />
            <Input
              placeholder="required_privileges (comma separated)"
              value={installForm.required_privileges}
              onChange={(event) => setInstallForm((prev) => ({ ...prev, required_privileges: event.target.value }))}
            />
            <label className="text-xs text-hc-muted">Manifest JSON</label>
            <textarea
              className="min-h-[160px] rounded-hc-sm border border-hc-surface-variant bg-hc-surface px-3 py-2 text-sm"
              value={installForm.manifest}
              onChange={(event) => setInstallForm((prev) => ({ ...prev, manifest: event.target.value }))}
            />
            <Button onClick={handleInstall} disabled={!canSubmit}>
              Install
            </Button>
          </div>
        </Card>

        {message && <div className="text-sm text-hc-primary">{message}</div>}
        {error && <div className="text-sm text-hc-danger">{error}</div>}
      </div>
    </div>
  );
}
