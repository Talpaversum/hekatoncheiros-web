import { useMemo, useState } from "react";

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

const sections = ["Users", "Tenants", "Licenses & Entitlements", "Installed Apps Moderation"];

export function PlatformConfigPage() {
  const { data, isLoading } = useTrustedOriginsQuery(true);
  const createMutation = useCreateTrustedOriginMutation();
  const updateMutation = useUpdateTrustedOriginMutation();
  const deleteMutation = useDeleteTrustedOriginMutation();

  const [origin, setOrigin] = useState("");
  const [note, setNote] = useState("");
  const [allowHttp, setAllowHttp] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const origins = data?.items ?? [];

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
    <div>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-wide text-hc-muted">Configuration</div>
        <div className="mt-1 text-2xl font-semibold">Platform configuration</div>
      </div>

      <div className="grid gap-4">
        <Card>
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
        </Card>

        {sections.map((section) => (
          <Card key={section}>
            <div className="text-sm font-semibold">{section}</div>
            <div className="mt-2 text-xs text-hc-muted">Placeholder section</div>
          </Card>
        ))}
      </div>
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
