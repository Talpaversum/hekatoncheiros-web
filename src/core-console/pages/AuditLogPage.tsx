import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { hasPrivilege } from "../../access/privileges";
import { useAuditEventsQuery, useAuditFilterOptionsQuery, type AuditEvent } from "../../data/api/audit";
import { useContextQuery } from "../../data/api/context";
import { useLocalization } from "../../localization/LocalizationProvider";
import { Button } from "../../ui-kit/components/Button";
import { Card } from "../../ui-kit/components/Card";
import { Field, PageHeader, StatusBadge } from "../../ui-kit/components/Page";
import { Table } from "../../ui-kit/components/Table";

const inputClass = "min-h-9 rounded-hc-md border border-hc-outline bg-hc-surface px-2.5 py-1.5 text-sm text-hc-text";

export function AuditLogPage() {
  const { t } = useLocalization();
  const { data: context } = useContextQuery(true);
  const privileges = context?.privileges ?? [];
  const canPlatform = hasPrivilege(privileges, "platform.audit.read");
  const canRead = canPlatform || hasPrivilege(privileges, "core.audit.read.tenant") || hasPrivilege(privileges, "core.audit.read.own");
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const search = useMemo(() => {
    const next = new URLSearchParams(params);
    next.set("limit", "50");
    return next.toString();
  }, [params]);
  const events = useAuditEventsQuery(search, canRead);
  const options = useAuditFilterOptionsQuery(canRead);

  if (context && !canRead) return <Card>{t("audit.forbidden")}</Card>;
  const update = (key: string, values: string[]) => {
    const next = new URLSearchParams(params);
    if (values.length) next.set(key, values.join(",")); else next.delete(key);
    next.delete("cursor");
    setParams(next, { replace: true });
  };
  const values = (key: string) => (params.get(key) ?? "").split(",").filter(Boolean);
  const labelValue = (value: string) => t(`audit.value.${value}`) === `audit.value.${value}` ? value : t(`audit.value.${value}`);
  const eventLabel = (value: string) => {
    const translated = t(`audit.event.${value}`);
    return translated === `audit.event.${value}` ? value : translated;
  };
  const showTenant = canPlatform;

  return <div className="space-y-4">
    <PageHeader eyebrow={t("audit.eyebrow")} title={t("audit.title")} description={t("audit.description")} />
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold">{t("audit.filters")}</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field label={t("audit.from")}><input className={inputClass} type="datetime-local" value={params.get("from")?.slice(0, 16) ?? ""} onChange={(e) => update("from", e.target.value ? [new Date(e.target.value).toISOString()] : [])} /></Field>
        <Field label={t("audit.to")}><input className={inputClass} type="datetime-local" value={params.get("to")?.slice(0, 16) ?? ""} onChange={(e) => update("to", e.target.value ? [new Date(e.target.value).toISOString()] : [])} /></Field>
        <Multi label={t("audit.severity")} name="severity" selected={values("severity")} options={options.data?.severities ?? []} update={update} display={labelValue} />
        <Multi label={t("audit.outcome")} name="outcome" selected={values("outcome")} options={options.data?.outcomes ?? []} update={update} display={labelValue} />
        <Multi label={t("audit.eventType")} name="event_type" selected={values("event_type")} options={options.data?.event_types ?? []} update={update} display={eventLabel} />
        <Multi label={t("audit.category")} name="category" selected={values("category")} options={options.data?.categories ?? []} update={update} />
        <Multi label={t("audit.users")} name="user_id" selected={values("user_id")} options={options.data?.users ?? []} update={update} />
        <Multi label={t("audit.applications")} name="application_id" selected={values("application_id")} options={options.data?.applications ?? []} update={update} />
        {showTenant && <Multi label={t("audit.tenants")} name="tenant_id" selected={values("tenant_id")} options={options.data?.tenants ?? []} update={update} />}
        {canPlatform && <Multi label={t("audit.platformEvents")} name="scope" selected={values("scope")} options={["user", "tenant", "platform"]} update={update} display={labelValue} />}
      </div>
      <Button variant="outlined" onClick={() => setParams({}, { replace: true })}>{t("audit.clear")}</Button>
    </Card>

    {events.isLoading ? <Card>{t("audit.loading")}</Card> : <Table><thead><tr>
      <th>{t("audit.time")}</th><th>{t("audit.severity")}</th><th>{t("audit.outcome")}</th><th>{t("audit.actor")}</th>
      {showTenant && <th>{t("audit.tenant")}</th>}<th>{t("audit.application")}</th><th>{t("audit.action")}</th><th>{t("audit.resource")}</th><th>{t("audit.message")}</th>
    </tr></thead><tbody>{events.data?.items.map((event) => <tr key={event.id} className="cursor-pointer hover:bg-hc-surface-variant/30" onClick={() => setSelected(event)}>
      <td className="whitespace-nowrap">{new Date(event.occurred_at).toLocaleString()}</td><td><StatusBadge tone={event.severity === "error" || event.severity === "critical" ? "danger" : event.severity === "warning" ? "warning" : "neutral"}>{labelValue(event.severity)}</StatusBadge></td>
      <td>{labelValue(event.outcome)}</td><td>{event.effective_user_id ?? event.actor_user_id ?? event.actor_type}</td>{showTenant && <td>{event.tenant_id ?? "-"}</td>}
      <td>{event.application_id ?? "-"}</td><td>{event.action}</td><td>{[event.resource_type, event.resource_id].filter(Boolean).join(": ") || event.object_ref}</td><td>{eventLabel(event.event_type)}</td>
    </tr>)}</tbody></Table>}
    {!events.isLoading && !events.data?.items.length && <Card>{t("audit.empty")}</Card>}
    {events.data?.next_cursor && <Button onClick={() => update("cursor", [events.data!.next_cursor!])}>{t("audit.loadMore")}</Button>}
    {selected && <AuditDetail event={selected} close={() => setSelected(null)} showTenant={showTenant} />}
  </div>;
}

function Multi({ label, name, selected, options, update, display = (value) => value }: { label: string; name: string; selected: string[]; options: string[]; update(key: string, values: string[]): void; display?(value: string): string }) {
  return <Field label={label}><select className={`${inputClass} min-h-24`} multiple value={selected} onChange={(event) => update(name, Array.from(event.currentTarget.selectedOptions, (option) => option.value))}>
    {options.map((option) => <option key={option} value={option}>{display(option)}</option>)}
  </select></Field>;
}

function AuditDetail({ event, close, showTenant }: { event: AuditEvent; close(): void; showTenant: boolean }) {
  const { t } = useLocalization();
  const rows: Array<[string, unknown]> = [[t("audit.id"), event.id], [t("audit.eventType"), event.event_type], [t("audit.category"), event.category], [t("audit.time"), new Date(event.occurred_at).toLocaleString()], [t("audit.actor"), event.actor_user_id ?? event.actor_type], [t("audit.effectiveUser"), event.effective_user_id], ...(showTenant ? [[t("audit.tenant"), event.tenant_id] as [string, unknown]] : []), [t("audit.application"), event.application_id], [t("audit.sourceService"), event.source_service], [t("audit.action"), event.action], [t("audit.resource"), [event.resource_type, event.resource_id].filter(Boolean).join(": ")], [t("audit.outcome"), event.outcome], [t("audit.severity"), event.severity], [t("audit.correlationId"), event.correlation_id], [t("audit.requestId"), event.request_id], [t("audit.ipAddress"), event.ip_address], [t("audit.userAgent"), event.user_agent]];
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/30" role="dialog" aria-modal="true"><Card className="h-full w-full max-w-xl overflow-auto rounded-none p-5">
    <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{t("audit.detail")}</h2><Button variant="ghost" onClick={close}>{t("audit.closeDetail")}</Button></div>
    <dl className="mt-4 grid gap-2">{rows.map(([label, value]) => <div key={label} className="grid grid-cols-[9rem_1fr] gap-3 border-b border-hc-outline py-2"><dt className="text-xs text-hc-muted">{label}</dt><dd className="break-all text-sm">{String(value ?? "-")}</dd></div>)}</dl>
    <h3 className="mt-5 text-sm font-semibold">{t("audit.metadata")}</h3><pre className="mt-2 overflow-auto rounded-hc-md bg-hc-bg p-3 text-xs">{JSON.stringify(event.metadata, null, 2)}</pre>
  </Card></div>;
}
