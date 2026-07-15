import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { hasPrivilege } from "../../access/privileges";
import { useAppRegistryQuery } from "../../data/api/app-registry";
import { useAuditEventsQuery, useAuditFilterOptionsQuery, type AuditEvent } from "../../data/api/audit";
import { useContextQuery } from "../../data/api/context";
import { useLocalization } from "../../localization/LocalizationProvider";
import { Button } from "../../ui-kit/components/Button";
import { Card } from "../../ui-kit/components/Card";
import { EmptyState, PageHeader, StatusBadge } from "../../ui-kit/components/Page";
import { SearchableMultiSelect, type MultiSelectOption } from "../../ui-kit/components/SearchableMultiSelect";
import { Table } from "../../ui-kit/components/Table";
import { parseAuditTime } from "./audit-time";

type FilterKey = "severity" | "outcome" | "event_type" | "category" | "user_id" | "application_id" | "tenant_id" | "scope" | "resource_type" | "correlation_id";
const filterKeys: FilterKey[] = ["severity", "outcome", "event_type", "category", "user_id", "application_id", "tenant_id", "scope", "resource_type", "correlation_id"];
const quickRanges = ["15m", "1h", "6h", "24h", "7d", "30d"] as const;
const inputClass = "min-h-9 rounded-hc-md border border-hc-outline bg-hc-bg px-3 py-1.5 text-sm text-hc-text outline-none focus:ring-2 focus:ring-hc-primary/40";

function resolvedApiSearch(params: URLSearchParams) {
  const next = new URLSearchParams(params);
  if (!next.has("from")) next.set("from", "now-1h");
  if (!next.has("to")) next.set("to", "now");
  const now = new Date();
  for (const key of ["from", "to"] as const) {
    const value = next.get(key);
    if (value) next.set(key, parseAuditTime(value, now)?.toISOString() ?? value);
  }
  next.delete("detail");
  next.set("limit", "50");
  return next.toString();
}

export function AuditLogPage() {
  const { t } = useLocalization();
  const { data: context } = useContextQuery(true);
  const privileges = context?.privileges ?? [];
  const canPlatform = hasPrivilege(privileges, "platform.audit.read");
  const canRead = canPlatform || hasPrivilege(privileges, "core.audit.read.tenant") || hasPrivilege(privileges, "core.audit.read.own");
  const [params, setParams] = useSearchParams();
  const [draftFrom, setDraftFrom] = useState(params.get("from") ?? "now-1h");
  const [draftTo, setDraftTo] = useState(params.get("to") ?? "now");
  const [timeError, setTimeError] = useState<string | null>(null);
  const [addedFilters, setAddedFilters] = useState<FilterKey[]>(() => filterKeys.filter((key) => params.has(key)));
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const apiSearch = useMemo(() => resolvedApiSearch(params), [params]);
  const events = useAuditEventsQuery(apiSearch, canRead);
  const options = useAuditFilterOptionsQuery(canRead);
  const registry = useAppRegistryQuery(canRead);
  const selected = events.data?.items.find((event) => event.id === params.get("detail")) ?? null;

  useEffect(() => {
    if (!filterMenuOpen) return;
    const close = (event: MouseEvent) => { if (!filterMenuRef.current?.contains(event.target as Node)) setFilterMenuOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [filterMenuOpen]);

  if (context && !canRead) return <Card>{t("audit.forbidden")}</Card>;
  const values = (key: string) => (params.get(key) ?? "").split(",").filter(Boolean);
  const update = (key: string, nextValues: string[]) => {
    const next = new URLSearchParams(params);
    if (nextValues.length) next.set(key, nextValues.join(",")); else next.delete(key);
    next.delete("cursor");
    setParams(next, { replace: true });
  };
  const applyTime = () => {
    if (!parseAuditTime(draftFrom) || !parseAuditTime(draftTo)) { setTimeError(t("audit.timeInvalid")); return; }
    if (parseAuditTime(draftFrom)!.getTime() > parseAuditTime(draftTo)!.getTime()) { setTimeError(t("audit.timeOrderInvalid")); return; }
    setTimeError(null); updateParamsTogether(params, setParams, { from: draftFrom.trim(), to: draftTo.trim(), cursor: null });
  };
  const setQuickRange = (range: typeof quickRanges[number]) => {
    const from = `now-${range === "24h" ? "1d" : range}`;
    setDraftFrom(from); setDraftTo("now"); setTimeError(null);
    updateParamsTogether(params, setParams, { from, to: "now", cursor: null });
  };
  const activeQuick = draftTo === "now" ? quickRanges.find((range) => draftFrom === `now-${range === "24h" ? "1d" : range}`) : undefined;
  const labelValue = (value: string) => translatedOr(t, `audit.value.${value}`, value);
  const eventLabel = (value: string) => translatedOr(t, `audit.event.${value}`, humanize(value));
  const appNames = new Map((registry.data?.items ?? []).map((app) => [app.app_id, app.app_name ?? displayIdentifier(app.slug)]));
  const filterDefinitions = buildFilterDefinitions({ t, options: options.data, visibleEvents: events.data?.items ?? [], canPlatform, context, appNames, labelValue, eventLabel });
  const availableFilters = filterDefinitions.filter((definition) => !addedFilters.includes(definition.key));
  const openDetail = (event: AuditEvent) => updateParamsTogether(params, setParams, { detail: event.id });
  const closeDetail = () => updateParamsTogether(params, setParams, { detail: null });

  return <div className="space-y-4">
    <PageHeader eyebrow={t("audit.eyebrow")} title={t("audit.title")} description={t("audit.description")} />

    <Card className="space-y-3 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-2 text-xs font-semibold uppercase text-hc-muted">{t("audit.timeRange")}</span>
        {quickRanges.map((range) => <button key={range} type="button" className={`rounded-hc-sm px-2.5 py-1.5 text-xs font-medium transition ${activeQuick === range ? "bg-hc-primary text-hc-on-primary" : "bg-hc-surface-variant text-hc-muted hover:text-hc-text"}`} onClick={() => setQuickRange(range)}>{t(`audit.range.${range}`)}</button>)}
        <button type="button" className={`rounded-hc-sm px-2.5 py-1.5 text-xs font-medium ${!activeQuick ? "bg-hc-primary text-hc-on-primary" : "bg-hc-surface-variant text-hc-muted"}`}>{t("audit.range.custom")}</button>
      </div>
      <div className="grid items-start gap-2 md:grid-cols-[minmax(12rem,1fr)_minmax(12rem,1fr)_auto]">
        <TimeInput label={t("audit.from")} value={draftFrom} onChange={setDraftFrom} resolved={parseAuditTime(draftFrom)} onBlur={applyTime} />
        <TimeInput label={t("audit.to")} value={draftTo} onChange={setDraftTo} resolved={parseAuditTime(draftTo)} onBlur={applyTime} />
        <Button className="mt-5" onClick={applyTime}>{t("audit.apply")}</Button>
      </div>
      {timeError && <div className="text-xs text-hc-danger" role="alert">{timeError}</div>}
    </Card>

    <Card className="flex min-h-14 flex-wrap items-center gap-2 p-3">
      <span className="mr-1 text-xs font-semibold uppercase text-hc-muted">{t("audit.filters")}</span>
      {addedFilters.map((key) => {
        const definition = filterDefinitions.find((item) => item.key === key);
        if (!definition) return null;
        const current = values(key);
        return <div key={key} className="flex items-center gap-1 rounded-full border border-hc-outline bg-hc-surface-variant py-1 pl-2.5 pr-1">
          <span className="text-xs font-semibold">{definition.label}:</span>
          <SearchableMultiSelect className="w-44 [&>button]:min-h-7 [&>button]:border-0 [&>button]:bg-transparent [&>button]:px-1 [&>button]:py-0 [&>button]:text-xs" label={t("audit.chooseValues")} options={definition.options} value={current} onChange={(next) => update(key, next)} searchPlaceholder={t("audit.searchValues")} emptyLabel={t("audit.noValues")} doneLabel={t("common.done")} />
          <button type="button" className="rounded-full px-1.5 py-0.5 text-xs text-hc-muted hover:bg-hc-surface hover:text-hc-text focus:outline-none focus:ring-2 focus:ring-hc-primary/40" aria-label={t("audit.removeFilter", { filter: definition.label })} onClick={() => { update(key, []); setAddedFilters((items) => items.filter((item) => item !== key)); }}>×</button>
        </div>;
      })}
      <div ref={filterMenuRef} className="relative">
        <Button size="sm" variant="outlined" onClick={() => setFilterMenuOpen((open) => !open)} aria-expanded={filterMenuOpen}>+ {t("audit.addFilter")}</Button>
        {filterMenuOpen && <div className="absolute left-0 top-[calc(100%+0.35rem)] z-40 w-52 rounded-hc-md border border-hc-outline bg-hc-surface p-1.5 shadow-xl">
          {availableFilters.map((definition) => <button key={definition.key} type="button" className="w-full rounded-hc-sm px-3 py-2 text-left text-sm hover:bg-hc-surface-variant focus:outline-none focus:ring-2 focus:ring-inset focus:ring-hc-primary/40" onClick={() => { setAddedFilters((items) => [...items, definition.key]); setFilterMenuOpen(false); }}>{definition.label}</button>)}
          {!availableFilters.length && <div className="px-3 py-2 text-xs text-hc-muted">{t("audit.allFiltersAdded")}</div>}
        </div>}
      </div>
      {addedFilters.length > 0 && <Button size="sm" variant="ghost" onClick={() => { const next = new URLSearchParams(params); addedFilters.forEach((key) => next.delete(key)); next.delete("cursor"); setParams(next, { replace: true }); setAddedFilters([]); }}>{t("audit.clearAll")}</Button>}
    </Card>

    <div className="flex min-h-10 items-center justify-between gap-3 px-1">
      <div><span className="text-lg font-semibold">{events.data?.items.length ?? 0}</span> <span className="text-sm text-hc-muted">{t("audit.events")}</span></div>
      <Button size="sm" variant="outlined" onClick={() => events.refetch()} disabled={events.isFetching}>{events.isFetching ? t("audit.refreshing") : t("audit.refresh")}</Button>
    </div>

    <AuditResults events={events} showTenant={canPlatform} openDetail={openDetail} labelValue={labelValue} eventLabel={eventLabel} appNames={appNames} clearFilters={() => { const next = new URLSearchParams(); next.set("from", draftFrom); next.set("to", draftTo); setParams(next); setAddedFilters([]); }} t={t} />
    {events.data?.next_cursor && <Button onClick={() => update("cursor", [events.data!.next_cursor!])}>{t("audit.loadMore")}</Button>}
    {selected && <AuditDetail event={selected} close={closeDetail} showTenant={canPlatform} eventLabel={eventLabel} appName={selected.application_id ? appNames.get(selected.application_id) : undefined} />}
  </div>;
}

function TimeInput({ label, value, onChange, resolved, onBlur }: { label: string; value: string; onChange(value: string): void; resolved: Date | null; onBlur(): void }) {
  return <label className="grid gap-1"><span className="text-xs font-medium text-hc-muted">{label}</span><input className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} /><span className="h-4 text-[11px] text-hc-muted">{resolved?.toLocaleString() ?? ""}</span></label>;
}

function AuditResults({ events, showTenant, openDetail, labelValue, eventLabel, appNames, clearFilters, t }: { events: ReturnType<typeof useAuditEventsQuery>; showTenant: boolean; openDetail(event: AuditEvent): void; labelValue(value: string): string; eventLabel(value: string): string; appNames: Map<string, string>; clearFilters(): void; t(key: string): string }) {
  if (events.isError) return <Card><EmptyState><div>{t("audit.loadError")}</div><Button className="mt-3" onClick={() => events.refetch()}>{t("audit.retry")}</Button></EmptyState></Card>;
  if (events.isLoading) return <Card className="min-h-64 animate-pulse"><div className="h-8 rounded bg-hc-surface-variant" /><div className="mt-3 space-y-2">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-10 rounded bg-hc-surface-variant/60" />)}</div></Card>;
  if (!events.data?.items.length) return <Card><EmptyState><div>{t("audit.emptySelected")}</div><Button className="mt-3" variant="outlined" onClick={clearFilters}>{t("audit.clearFilters")}</Button></EmptyState></Card>;
  return <Table className="max-h-[60vh] overflow-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10"><thead><tr>
    <th>{t("audit.time")}</th><th>{t("audit.severity")}</th><th>{t("audit.outcome")}</th><th>{t("audit.actor")}</th>{showTenant && <th className="hidden xl:table-cell">{t("audit.tenant")}</th>}<th className="hidden lg:table-cell">{t("audit.application")}</th><th>{t("audit.action")}</th><th className="hidden 2xl:table-cell">{t("audit.resource")}</th><th>{t("audit.message")}</th>
  </tr></thead><tbody>{events.data.items.map((event) => <tr key={event.id} tabIndex={0} className="cursor-pointer hover:bg-hc-surface-variant/30 focus:bg-hc-surface-variant/40 focus:outline-none" onClick={() => openDetail(event)} onKeyDown={(key) => { if (key.key === "Enter" || key.key === " ") openDetail(event); }}>
    <td className="whitespace-nowrap text-xs" title={event.occurred_at}>{new Date(event.occurred_at).toLocaleString()}</td><td><AuditBadge value={event.severity} label={labelValue(event.severity)} /></td><td><AuditBadge value={event.outcome} label={labelValue(event.outcome)} /></td>
    <td className="max-w-40 truncate" title={event.effective_user_id ?? event.actor_user_id ?? event.actor_type}>{event.effective_user_id ?? event.actor_user_id ?? labelValue(event.actor_type)}</td>{showTenant && <td className="hidden max-w-40 truncate xl:table-cell" title={event.tenant_id ?? ""}>{event.tenant_id ?? "-"}</td>}
    <td className="hidden max-w-44 truncate lg:table-cell" title={event.application_id ?? ""}>{event.application_id ? appNames.get(event.application_id) ?? displayIdentifier(event.application_id) : "-"}</td><td className="max-w-44 truncate" title={event.action}>{humanize(event.action)}</td><td className="hidden max-w-44 truncate 2xl:table-cell" title={event.resource_id ?? event.object_ref}>{event.resource_id ?? event.object_ref}</td><td className="max-w-72"><span className="block truncate font-medium" title={event.message}>{eventLabel(event.event_type)}</span><span className="block truncate text-xs text-hc-muted" title={event.event_type}>{event.event_type}</span></td>
  </tr>)}</tbody></Table>;
}

function AuditBadge({ value, label }: { value: string; label: string }) {
  const tone = value === "error" || value === "critical" || value === "failure" || value === "denied" ? "danger" : value === "warning" || value === "unknown" ? "warning" : value === "success" ? "success" : "neutral";
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}

function AuditDetail({ event, close, showTenant, eventLabel, appName }: { event: AuditEvent; close(): void; showTenant: boolean; eventLabel(value: string): string; appName?: string }) {
  const { t } = useLocalization();
  const [raw, setRaw] = useState(false);
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="dialog" aria-modal="true" aria-labelledby="audit-detail-title" onMouseDown={(mouse) => { if (mouse.target === mouse.currentTarget) close(); }}>
    <Card className="h-full w-full max-w-xl overflow-y-auto rounded-none border-y-0 border-r-0 p-0 shadow-2xl">
      <div className="sticky top-0 z-10 flex items-start justify-between border-b border-hc-outline bg-hc-surface p-5"><div><div className="text-xs uppercase text-hc-muted">{event.event_type}</div><h2 id="audit-detail-title" className="mt-1 text-lg font-semibold">{eventLabel(event.event_type)}</h2><div className="mt-2 flex gap-2"><AuditBadge value={event.severity} label={translatedOr(t, `audit.value.${event.severity}`, event.severity)} /><AuditBadge value={event.outcome} label={translatedOr(t, `audit.value.${event.outcome}`, event.outcome)} /></div></div><Button variant="ghost" onClick={close} aria-label={t("audit.closeDetail")}>×</Button></div>
      <div className="space-y-6 p-5">
        <DetailSection title={t("audit.section.summary")} rows={[[t("audit.id"), event.id], [t("audit.time"), new Date(event.occurred_at).toLocaleString()], [t("audit.category"), event.category], [t("audit.action"), event.action], [t("audit.message"), event.message]]} />
        <DetailSection title={t("audit.section.actor")} rows={[[t("audit.actor"), event.actor_user_id ?? event.actor_type], [t("audit.effectiveUser"), event.effective_user_id], [t("audit.application"), appName ?? event.application_id], [t("audit.sourceService"), event.source_service], ...(showTenant ? [[t("audit.tenant"), event.tenant_id] as [string, unknown]] : [])]} />
        <DetailSection title={t("audit.section.target")} rows={[[t("audit.resource"), [event.resource_type, event.resource_id].filter(Boolean).join(": ") || event.object_ref], [t("audit.eventScope"), translatedOr(t, `audit.value.${event.scope}`, event.scope)], [t("audit.visibility"), event.visibility]]} />
        <DetailSection title={t("audit.section.request")} rows={[[t("audit.correlationId"), event.correlation_id], [t("audit.requestId"), event.request_id], [t("audit.ipAddress"), event.ip_address], [t("audit.userAgent"), event.user_agent]]} />
        <section><h3 className="text-sm font-semibold">{t("audit.metadata")}</h3><pre className="mt-2 max-h-64 overflow-auto rounded-hc-md bg-hc-bg p-3 text-xs">{JSON.stringify(event.metadata, null, 2)}</pre></section>
        <button type="button" className="text-xs font-semibold text-hc-primary" onClick={() => setRaw((current) => !current)} aria-expanded={raw}>{raw ? t("audit.hideRaw") : t("audit.showRaw")}</button>{raw && <pre className="max-h-96 overflow-auto rounded-hc-md bg-hc-bg p-3 text-xs">{JSON.stringify(event, null, 2)}</pre>}
      </div>
    </Card>
  </div>;
}

function DetailSection({ title, rows }: { title: string; rows: Array<[string, unknown]> }) {
  return <section><h3 className="mb-2 text-sm font-semibold">{title}</h3><dl className="divide-y divide-hc-outline rounded-hc-md border border-hc-outline">{rows.map(([label, value]) => <div key={label} className="grid grid-cols-[8rem_1fr] gap-3 px-3 py-2"><dt className="text-xs text-hc-muted">{label}</dt><dd className="break-all text-sm">{String(value ?? "-")}</dd></div>)}</dl></section>;
}

function buildFilterDefinitions({ t, options, visibleEvents, canPlatform, context, appNames, labelValue, eventLabel }: { t(key: string): string; options: ReturnType<typeof useAuditFilterOptionsQuery>["data"]; visibleEvents: AuditEvent[]; canPlatform: boolean; context: ReturnType<typeof useContextQuery>["data"]; appNames: Map<string, string>; labelValue(value: string): string; eventLabel(value: string): string }) {
  const option = (value: string, label = value, secondary?: string): MultiSelectOption => ({ value, label, secondary });
  const userName = (id: string) => id === context?.actor.effective_user_id || id === context?.actor.user_id ? context.actor.display_name ?? context.actor.email ?? displayIdentifier(id) : displayIdentifier(id);
  const definitions: Array<{ key: FilterKey; label: string; options: MultiSelectOption[] }> = [
    { key: "severity", label: t("audit.severity"), options: (options?.severities ?? ["debug", "info", "warning", "error", "critical"]).map((value) => option(value, labelValue(value), value)) },
    { key: "outcome", label: t("audit.outcome"), options: (options?.outcomes ?? ["success", "failure", "denied", "unknown"]).map((value) => option(value, labelValue(value), value)) },
    { key: "event_type", label: t("audit.eventType"), options: (options?.event_types ?? []).map((value) => option(value, eventLabel(value), value)) },
    { key: "category", label: t("audit.category"), options: (options?.categories ?? []).map((value) => option(value, humanize(value), value)) },
    { key: "user_id", label: t("audit.users"), options: (options?.users ?? []).map((value) => option(value, userName(value), value)) },
    { key: "application_id", label: t("audit.applications"), options: (options?.applications ?? []).map((value) => option(value, appNames.get(value) ?? displayIdentifier(value), value)) },
    { key: "resource_type", label: t("audit.resource"), options: [...new Set(visibleEvents.map((event) => event.resource_type).filter((value): value is string => Boolean(value)))].map((value) => option(value, humanize(value), value)) },
    { key: "correlation_id", label: t("audit.correlationId"), options: [...new Set(visibleEvents.map((event) => event.correlation_id).filter((value): value is string => Boolean(value)))].map((value) => option(value, humanize(value.slice(0, 12)), value)) },
  ];
  if (canPlatform) definitions.push({ key: "tenant_id", label: t("audit.tenants"), options: (options?.tenants ?? []).map((value) => option(value, value === context?.tenant.id ? context.tenant.name ?? displayIdentifier(value) : displayIdentifier(value), value)) }, { key: "scope", label: t("audit.eventScope"), options: ["user", "tenant", "platform"].map((value) => option(value, labelValue(value), value)) });
  return definitions;
}

function updateParamsTogether(current: URLSearchParams, setParams: ReturnType<typeof useSearchParams>[1], updates: Record<string, string | null>) {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(updates)) { if (value) next.set(key, value); else next.delete(key); }
  setParams(next, { replace: true });
}

function translatedOr(t: (key: string) => string, key: string, fallback: string) { const value = t(key); return value === key ? fallback : value; }
function humanize(value: string) { return value.replace(/[._-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()); }
function displayIdentifier(value: string) { return humanize(value.replace(/[._-]?[0-9a-f]{8}-[0-9a-f-]{27,}$/i, "").replace(/^(tnt|usr)[._-]/i, "")); }
