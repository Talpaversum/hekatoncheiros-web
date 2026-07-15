import { useMemo, useState } from "react";

import {
  useAuthorRegistryTrustQuery,
  useAuthorsQuery,
  useOnboardAuthorMutation,
  useRotateAuthorKeysMutation,
  useSyncAuthorRegistryTrustMutation,
  type AuthorOnboarding,
  type PublicJwks,
} from "../../data/api/authors";
import { readErrorMessage } from "../../data/api/read-error-message";
import { Button } from "../../ui-kit/components/Button";
import { Card } from "../../ui-kit/components/Card";
import { Input } from "../../ui-kit/components/Input";
import { Field, MetricStrip, SectionHeader, StatusBadge } from "../../ui-kit/components/Page";
import { Table } from "../../ui-kit/components/Table";
import { Textarea } from "../../ui-kit/components/Textarea";
import { ToastNotice } from "../../ui-kit/components/ToastNotice";
import { useLocalization, type Translate } from "../../localization/LocalizationProvider";

const emptyJwks = '{\n  "keys": []\n}';

function parseJwks(value: string, t: Translate): PublicJwks {
  const parsed = JSON.parse(value) as Partial<PublicJwks>;
  if (!Array.isArray(parsed.keys) || parsed.keys.length === 0) {
    throw new Error(t("authors.jwksRequired"));
  }
  return { keys: parsed.keys };
}

function countRevocations(value: unknown) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  return 0;
}

function formatDate(value: string | null | undefined, t: Translate) {
  return value ? new Date(value).toLocaleString() : t("config.never");
}

export function AuthorsPanel() {
  const { t } = useLocalization();
  const { data, isLoading } = useAuthorsQuery(true);
  const { data: trust } = useAuthorRegistryTrustQuery(true);
  const onboardAuthor = useOnboardAuthorMutation();
  const rotateKeys = useRotateAuthorKeysMutation();
  const syncTrust = useSyncAuthorRegistryTrustMutation();
  const authors = useMemo(() => data?.items ?? [], [data?.items]);

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedAuthor, setSelectedAuthor] = useState<AuthorOnboarding | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [jwks, setJwks] = useState(emptyJwks);
  const [ttlDays, setTtlDays] = useState("365");
  const [rotationJwks, setRotationJwks] = useState(emptyJwks);
  const [rotationTtlDays, setRotationTtlDays] = useState("365");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearNotice = () => {
    setMessage(null);
    setError(null);
  };

  const handleOnboard = async () => {
    clearNotice();
    try {
      const created = await onboardAuthor.mutateAsync({
        display_name: displayName.trim(),
        jwks: parseJwks(jwks, t),
        cert_ttl_days: Number(ttlDays),
      });
      setDisplayName("");
      setJwks(emptyJwks);
      setTtlDays("365");
      setShowOnboarding(false);
      setMessage(t("authors.onboarded", { name: created.display_name }));
    } catch (err) {
      setError(readErrorMessage(err));
    }
  };

  const handleRotate = async () => {
    if (!selectedAuthor) return;
    clearNotice();
    try {
      await rotateKeys.mutateAsync({
        authorId: selectedAuthor.author_id,
        jwks: parseJwks(rotationJwks, t),
        cert_ttl_days: Number(rotationTtlDays),
      });
      setRotationJwks(emptyJwks);
      setMessage(t("authors.rotated", { name: selectedAuthor.display_name }));
    } catch (err) {
      setError(readErrorMessage(err));
    }
  };

  const handleSyncTrust = async () => {
    clearNotice();
    try {
      await syncTrust.mutateAsync();
      setMessage(t("authors.synchronized"));
    } catch (err) {
      setError(readErrorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      <ToastNotice message={error ?? message} tone={error ? "danger" : "success"} onDismiss={clearNotice} />

      <MetricStrip items={[
        { label: t("authors.authors"), value: authors.length },
        { label: t("authors.rootKeys"), value: trust?.root_jwks_json.keys.length ?? 0 },
        { label: t("authors.revocations"), value: countRevocations(trust?.revocations_json) },
        { label: t("authors.trustSync"), value: t(trust ? "authors.current" : "authors.missing"), tone: trust ? "success" : "warning" },
      ]} />

      <Card className="overflow-hidden p-0">
        <SectionHeader
          title={t("authors.registryTrust")}
          description={trust?.registry_url ?? t("authors.noTrustSnapshot")}
          meta={<Button size="sm" variant="outlined" onClick={() => void handleSyncTrust()} disabled={syncTrust.isPending}>{t(syncTrust.isPending ? "authors.syncing" : "authors.syncTrust")}</Button>}
        />
        <dl className="grid border-t border-hc-outline md:grid-cols-3">
          <InfoCell label={t("authors.lastSynchronized")} value={formatDate(trust?.synced_at, t)} />
          <InfoCell label={t("authors.synchronizedBy")} value={trust?.synced_by ?? "-"} />
          <InfoCell label={t("authors.registry")} value={trust?.registry_url ?? t("common.notAvailable")} />
        </dl>
      </Card>

      <Card className="overflow-hidden p-0">
        <SectionHeader
          title={t("authors.title")}
          description={t("authors.description")}
          meta={<div className="flex items-center gap-2"><StatusBadge>{t("authors.count", { count: authors.length })}</StatusBadge><Button size="sm" onClick={() => setShowOnboarding((value) => !value)}>{t("authors.onboardAuthor")}</Button></div>}
        />
        {showOnboarding && <div className="grid gap-3 border-t border-hc-outline bg-hc-surface-variant/40 p-4 lg:grid-cols-[minmax(12rem,1fr)_minmax(18rem,2fr)_7rem_auto] lg:items-end">
          <Field label={t("authors.displayName")}><Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Example Software" /></Field>
          <Field label={t("authors.publicJwks")}><Textarea className="min-h-28 font-mono text-xs" value={jwks} onChange={(event) => setJwks(event.target.value)} /></Field>
          <Field label={t("authors.certificateTtl")}><Input type="number" min={1} max={3650} value={ttlDays} onChange={(event) => setTtlDays(event.target.value)} /></Field>
          <Button onClick={() => void handleOnboard()} disabled={!displayName.trim() || onboardAuthor.isPending}>{t(onboardAuthor.isPending ? "authors.onboarding" : "authors.onboard")}</Button>
        </div>}
        {isLoading ? <div className="border-t border-hc-outline px-4 py-6 text-sm text-hc-muted">{t("authors.loading")}</div> : (
          <AuthorsTable authors={authors} onOpen={(author) => {
            setSelectedAuthor(author);
            setRotationJwks(JSON.stringify(author.public_jwks_json, null, 2));
          }} />
        )}
      </Card>

      {selectedAuthor && <Card className="overflow-hidden p-0">
        <SectionHeader title={selectedAuthor.display_name} description={selectedAuthor.author_id} meta={<Button size="sm" variant="ghost" onClick={() => setSelectedAuthor(null)}>{t("common.close")}</Button>} />
        <dl className="grid border-t border-hc-outline md:grid-cols-3">
          <InfoCell label={t("authors.rootKey")} value={selectedAuthor.root_kid ?? t("authors.notReported")} />
          <InfoCell label={t("authors.publicKeys")} value={String(selectedAuthor.public_jwks_json.keys.length)} />
          <InfoCell label={t("authors.updated")} value={formatDate(selectedAuthor.updated_at, t)} />
        </dl>
        <div className="grid gap-3 border-t border-hc-outline p-4 lg:grid-cols-[minmax(18rem,2fr)_7rem_auto] lg:items-end">
          <Field label={t("authors.replacementJwks")}><Textarea className="min-h-28 font-mono text-xs" value={rotationJwks} onChange={(event) => setRotationJwks(event.target.value)} /></Field>
          <Field label={t("authors.certificateTtl")}><Input type="number" min={1} max={3650} value={rotationTtlDays} onChange={(event) => setRotationTtlDays(event.target.value)} /></Field>
          <Button variant="outlined" onClick={() => void handleRotate()} disabled={rotateKeys.isPending}>{t(rotateKeys.isPending ? "authors.rotating" : "authors.rotateKeys")}</Button>
        </div>
      </Card>}
    </div>
  );
}

function AuthorsTable({ authors, onOpen }: { authors: AuthorOnboarding[]; onOpen: (author: AuthorOnboarding) => void }) {
  const { t } = useLocalization();
  if (authors.length === 0) return <div className="border-t border-hc-outline px-4 py-8 text-center text-sm text-hc-muted">{t("authors.none")}</div>;
  return <Table className="rounded-none border-0 border-t shadow-none">
    <thead><tr><th>{t("authors.author")}</th><th>{t("authors.publicKeys")}</th><th>{t("authors.rootKey")}</th><th>{t("authors.updated")}</th><th className="text-right">{t("authors.action")}</th></tr></thead>
    <tbody>{authors.map((author) => <tr key={author.author_id}>
      <td><div className="font-medium">{author.display_name}</div><div className="font-mono text-xs text-hc-muted">{author.author_id}</div></td>
      <td>{author.public_jwks_json.keys.length}</td>
      <td className="font-mono text-xs">{author.root_kid ?? "-"}</td>
      <td className="text-sm">{formatDate(author.updated_at, t)}</td>
      <td className="text-right"><Button size="sm" variant="ghost" onClick={() => onOpen(author)}>{t("common.open")}</Button></td>
    </tr>)}</tbody>
  </Table>;
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 border-b border-hc-outline px-4 py-3 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
    <dt className="text-xs font-medium text-hc-muted">{label}</dt>
    <dd className="mt-1 truncate text-sm" title={value}>{value}</dd>
  </div>;
}
