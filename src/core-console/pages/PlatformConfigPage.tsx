import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import {
  usePlatformInstanceSettingsQuery,
  useUpdatePlatformInstanceSettingsMutation,
} from "../../data/api/configuration";
import { readErrorMessage } from "../../data/api/read-error-message";
import {
  useCreateTrustedOriginMutation,
  useDeleteTrustedOriginMutation,
  useTrustedOriginsQuery,
  useUpdateTrustedOriginMutation,
  type TrustedOrigin,
} from "../../data/api/trusted-origins";
import { Button } from "../../ui-kit/components/Button";
import { Card } from "../../ui-kit/components/Card";
import { Input } from "../../ui-kit/components/Input";
import { Switch } from "../../ui-kit/components/Switch";

function StatusBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-hc-sm border border-hc-outline bg-hc-surface-variant px-2 py-1 text-xs text-hc-muted">
      {children}
    </span>
  );
}

export function PlatformConfigPage() {
  const location = useLocation();
  const { data, isLoading } = useTrustedOriginsQuery(true);
  const { data: platformInstance } = usePlatformInstanceSettingsQuery(true);
  const updatePlatformInstance = useUpdatePlatformInstanceSettingsMutation();
  const createMutation = useCreateTrustedOriginMutation();
  const updateMutation = useUpdateTrustedOriginMutation();
  const deleteMutation = useDeleteTrustedOriginMutation();

  const [origin, setOrigin] = useState("");
  const [note, setNote] = useState("");
  const [allowHttp, setAllowHttp] = useState(false);
  const [instanceName, setInstanceName] = useState<string | null>(null);
  const [publicBaseUrl, setPublicBaseUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const origins = data?.items ?? [];
  const section = location.pathname.split("/").pop() ?? "";
  const effectiveInstanceName = instanceName ?? platformInstance?.name ?? "";
  const effectivePublicBaseUrl = publicBaseUrl ?? platformInstance?.public_base_url ?? "";

  const httpOriginDetected = useMemo(() => {
    try {
      return new URL(origin).protocol === "http:";
    } catch {
      return false;
    }
  }, [origin]);

  const handleCreate = async () => {
    setMessage(null);
    setError(null);

    const normalized = origin.trim();
    if (!normalized) {
      setError("Origin je povinný.");
      return;
    }

    if (httpOriginDetected && !allowHttp) {
      setError("Pro http:// origin musíš explicitně potvrdit Allow HTTP.");
      return;
    }

    try {
      await createMutation.mutateAsync({ origin: normalized, note: note.trim() || null });
      setMessage("Trusted origin byl přidán.");
      setOrigin("");
      setNote("");
      setAllowHttp(false);
    } catch (err) {
      setError(readErrorMessage(err));
    }
  };

  const handleSaveInstance = async () => {
    setMessage(null);
    setError(null);
    try {
      await updatePlatformInstance.mutateAsync({
        name: effectiveInstanceName.trim(),
        public_base_url: effectivePublicBaseUrl.trim() || null,
      });
      setInstanceName(null);
      setPublicBaseUrl(null);
      setMessage("Platform instance settings were updated.");
    } catch (err) {
      setError(readErrorMessage(err));
    }
  };

  const handleToggle = async (item: TrustedOrigin) => {
    setMessage(null);
    setError(null);
    try {
      await updateMutation.mutateAsync({ id: item.id, is_enabled: !item.is_enabled });
    } catch (err) {
      setError(readErrorMessage(err));
    }
  };

  const handleDelete = async (item: TrustedOrigin) => {
    setMessage(null);
    setError(null);
    try {
      await deleteMutation.mutateAsync(item.id);
    } catch (err) {
      setError(readErrorMessage(err));
    }
  };

  const handleNoteSave = async (item: TrustedOrigin, nextNote: string) => {
    setMessage(null);
    setError(null);
    try {
      await updateMutation.mutateAsync({ id: item.id, note: nextNote.trim() || null });
    } catch (err) {
      setError(readErrorMessage(err));
    }
  };

  return (
    <div className="space-y-5">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-wide text-hc-muted">Configuration</div>
        <div className="mt-1 text-2xl font-semibold">Platform configuration</div>
        <div className="mt-1 text-sm text-hc-muted">Instance-wide controls for trust, app distribution, and platform governance.</div>
      </div>

      {(section === "platform" || section === "") && <section className="grid gap-4 lg:grid-cols-4">
        <Card className="rounded-hc-md">
          <div className="text-sm font-semibold">Trusted origins</div>
          <div className="mt-3 text-2xl font-semibold">{origins.length}</div>
          <div className="mt-1 text-xs text-hc-muted">Origins allowed for local/dev HTTP app metadata.</div>
        </Card>
        <Card className="rounded-hc-md">
          <div className="text-sm font-semibold">Instance</div>
          <div className="mt-3 text-2xl font-semibold">{platformInstance?.name ?? "Core"}</div>
          <div className="mt-1 text-xs text-hc-muted">{platformInstance?.instance_id ?? "Loading..."}</div>
        </Card>
        <Card className="rounded-hc-md">
          <div className="text-sm font-semibold">Feed export</div>
          <div className="mt-3 text-2xl font-semibold">Active</div>
          <div className="mt-1 text-xs text-hc-muted">Public feed is served from `/.well-known/hc/app-catalog.json`.</div>
        </Card>
        <Card className="rounded-hc-md">
          <div className="text-sm font-semibold">Publish tokens</div>
          <div className="mt-3 text-2xl font-semibold">Planned</div>
          <div className="mt-1 text-xs text-hc-muted">Future pre-approval for trusted submitters and CI.</div>
        </Card>
        <Card className="rounded-hc-md">
          <div className="text-sm font-semibold">Tenant mode</div>
          <div className="mt-3 text-2xl font-semibold">Core-owned</div>
          <div className="mt-1 text-xs text-hc-muted">Configured by deployment and backend policy.</div>
        </Card>
      </section>}

      <div className="grid gap-4">
        {section === "instance" && <Card className="rounded-hc-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Platform instance</div>
              <div className="mt-2 text-xs text-hc-muted">Public identity used by feeds, operators, and future trust metadata.</div>
            </div>
            <StatusBadge>active</StatusBadge>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-hc-muted">Instance name</label>
              <Input value={effectiveInstanceName} onChange={(event) => setInstanceName(event.target.value)} />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-hc-muted">Public base URL</label>
              <Input value={effectivePublicBaseUrl} onChange={(event) => setPublicBaseUrl(event.target.value)} placeholder="https://core.example.com" />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => void handleSaveInstance()} disabled={!effectiveInstanceName.trim() || updatePlatformInstance.isPending}>
              Save instance
            </Button>
          </div>
        </Card>}

        {section === "trusted-origins" && <Card className="rounded-hc-md">
          <div className="text-sm font-semibold">Trusted install origins</div>
          <div className="mt-2 text-xs text-hc-muted">
            Exact-match allowlist originů (scheme+host+port) pro install/fetch manifest.
          </div>

          <div className="mt-4 grid gap-3 rounded-hc-md border border-hc-outline p-3">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-wide text-hc-muted">Origin</label>
              <Input placeholder="http://127.0.0.1:4010" value={origin} onChange={(e) => setOrigin(e.target.value)} />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-wide text-hc-muted">Poznámka</label>
              <Input placeholder="Local inventory app" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            {httpOriginDetected && (
              <label className="flex items-center gap-2 text-sm text-hc-danger">
                <input type="checkbox" checked={allowHttp} onChange={(e) => setAllowHttp(e.target.checked)} />
                Allow HTTP for this origin (unsecured transport)
              </label>
            )}

            <div className="flex justify-end">
              <Button onClick={() => void handleCreate()} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Adding…" : "Add trusted origin"}
              </Button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {isLoading && <div className="text-sm text-hc-muted">Načítám trusted origins…</div>}
            {!isLoading && origins.length === 0 && <div className="text-sm text-hc-muted">Žádné trusted origins.</div>}

            {origins.map((item) => (
              <TrustedOriginRow
                key={item.id}
                item={item}
                onToggle={() => void handleToggle(item)}
                onDelete={() => void handleDelete(item)}
                onSaveNote={(nextNote) => void handleNoteSave(item, nextNote)}
                busy={updateMutation.isPending || deleteMutation.isPending}
              />
            ))}
          </div>

          {message && <div className="mt-3 text-sm text-hc-primary">{message}</div>}
          {error && <div className="mt-3 text-sm text-hc-danger">{error}</div>}
        </Card>}

        {section === "app-distribution" && <Card className="rounded-hc-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">App distribution governance</div>
              <div className="mt-2 text-xs text-hc-muted">
                Catalog feed import/export is managed in Applications. This platform area owns the policy around it.
              </div>
            </div>
            <StatusBadge>partly active</StatusBadge>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <ConfigTile title="Public feed" status="active" detail="Only admin-published installed apps are exported." />
            <ConfigTile title="Publish requests" status="planned" detail="User/developer proposals awaiting admin approval." />
            <ConfigTile title="Publish tokens" status="planned" detail="Admin-issued pre-approval for namespaces, apps, or CI pipelines." />
          </div>
        </Card>}

        {section === "identity" && <Card className="rounded-hc-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Identity and tenancy</div>
              <div className="mt-2 text-xs text-hc-muted">Instance tenants, users, and delegation policies will live here once backend APIs exist.</div>
            </div>
            <StatusBadge>planned</StatusBadge>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <ConfigTile title="Users" status="planned" detail="Create, disable, and inspect platform users." />
            <ConfigTile title="Tenants" status="planned" detail="Manage tenant records and primary domains." />
            <ConfigTile title="Delegation" status="planned" detail="Control impersonation and delegated administration." />
          </div>
        </Card>}

        {section === "automation" && <Card className="rounded-hc-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Automation</div>
              <div className="mt-2 text-xs text-hc-muted">Scheduled feed sync and controlled runtime actions belong here.</div>
            </div>
            <StatusBadge>planned</StatusBadge>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <ConfigTile title="Scheduled feed sync" status="planned" detail="Periodic sync for selected catalog sources." />
            <ConfigTile title="Compose runtime manager" status="planned" detail="Start/stop/update app compose bundles with audit." />
            <ConfigTile title="Policy audit" status="planned" detail="Review feed and runtime decisions over time." />
          </div>
        </Card>}
      </div>
    </div>
  );
}

function ConfigTile({ title, status, detail }: { title: string; status: string; detail: string }) {
  return (
    <div className="rounded-hc-md border border-hc-outline bg-hc-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">{title}</div>
        <StatusBadge>{status}</StatusBadge>
      </div>
      <div className="mt-2 text-xs text-hc-muted">{detail}</div>
    </div>
  );
}

function TrustedOriginRow({
  item,
  onToggle,
  onDelete,
  onSaveNote,
  busy,
}: {
  item: TrustedOrigin;
  onToggle: () => void;
  onDelete: () => void;
  onSaveNote: (nextNote: string) => void;
  busy: boolean;
}) {
  const [editingNote, setEditingNote] = useState(item.note ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="rounded-hc-md border border-hc-outline p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">{item.origin}</div>
          <div className="mt-1 text-xs text-hc-muted">Created {new Date(item.created_at).toLocaleString()}</div>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={item.is_enabled} onClick={onToggle} disabled={busy} />
          <Button variant="outlined" onClick={() => setConfirmDelete((prev) => !prev)} disabled={busy}>
            Delete
          </Button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Input value={editingNote} onChange={(e) => setEditingNote(e.target.value)} placeholder="Note" />
        <Button variant="tonal" onClick={() => onSaveNote(editingNote)} disabled={busy}>
          Save note
        </Button>
      </div>

      {confirmDelete && (
        <div className="mt-3 rounded-hc-sm border border-hc-danger/30 bg-hc-danger/10 p-3">
          <div className="text-sm text-hc-danger">Confirm delete trusted origin?</div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={onDelete} disabled={busy}>
              Confirm delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
