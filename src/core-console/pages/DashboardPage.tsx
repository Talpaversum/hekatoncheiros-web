import { Component, useState, type ErrorInfo, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useContextQuery } from "../../data/api/context";
import { registerCoreDashboardWidgets } from "../../dashboard/core-widgets";
import type { DashboardWidgetDefinition, WidgetSettings, WidgetSize } from "../../dashboard/widget-contract";
import { useDashboardPreferences } from "../../dashboard/use-dashboard-preferences";
import { useApplicationDashboardWidgets } from "../../dashboard/use-application-widgets";
import { useLocalization } from "../../localization/LocalizationProvider";
import { Button } from "../../ui-kit/components/Button";
import { Card } from "../../ui-kit/components/Card";
import { Dialog } from "../../ui-kit/components/Dialog";
import { Input } from "../../ui-kit/components/Input";
import { PageHeader } from "../../ui-kit/components/Page";

registerCoreDashboardWidgets();

export function DashboardPage() {
  const { data: context, isLoading } = useContextQuery();
  const { t } = useLocalization();
  useApplicationDashboardWidgets(Boolean(context));
  const dashboard = useDashboardPreferences(context?.privileges ?? []);
  const queryClient = useQueryClient();
  const [menuWidget, setMenuWidget] = useState<string | null>(null);
  const [configureWidget, setConfigureWidget] = useState<DashboardWidgetDefinition | null>(null);
  const [draftSettings, setDraftSettings] = useState<WidgetSettings>({});
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);

  const openConfiguration = (definition: DashboardWidgetDefinition) => {
    setDraftSettings(dashboard.preferences.widgets[definition.id]?.settings ?? definition.defaultSettings);
    setConfigureWidget(definition); setMenuWidget(null);
  };
  const hidden = dashboard.hidden.filter((definition) => `${widgetTitle(definition, t)} ${widgetCategory(definition, t)}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const groups = new Map<string, DashboardWidgetDefinition[]>();
  for (const definition of hidden) {
    const category = widgetCategory(definition, t);
    groups.set(category, [...(groups.get(category) ?? []), definition]);
  }

  return <div className="space-y-4">
    <PageHeader eyebrow={t("nav.dashboard")} title={t("nav.overview")} description={context ? t("dashboard.operationalContext", { tenant: context.tenant.name ?? context.tenant.id ?? t("common.noTenant") }) : t("dashboard.loadingContext")} actions={<Button onClick={() => setAddOpen(true)}>+ {t("dashboard.addWidget")}</Button>} />
    {dashboard.isSaving && <div className="text-right text-xs text-hc-muted">{t("dashboard.savingLayout")}</div>}
    {isLoading || dashboard.query.isLoading ? <DashboardSkeleton /> : dashboard.visible.length ? (
      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
        {dashboard.visible.map((definition) => {
          const preference = dashboard.preferences.widgets[definition.id];
          return <WidgetCard key={definition.id} definition={definition} size={preference.size} settings={preference.settings} menuOpen={menuWidget === definition.id} onMenu={() => setMenuWidget((current) => current === definition.id ? null : definition.id)} onConfigure={() => openConfiguration(definition)} onRefresh={() => { void definition.refresh?.(); void queryClient.invalidateQueries(); setMenuWidget(null); }} onHide={() => { dashboard.hide(definition.id); setMenuWidget(null); }} onResize={(size) => dashboard.resize(definition.id, size)} dragging={dragging === definition.id} onDragStart={() => setDragging(definition.id)} onDrop={() => { if (dragging) dashboard.reorder(dragging, definition.id); setDragging(null); }} t={t} />;
        })}
      </div>
    ) : <Card className="py-12 text-center"><div className="text-sm text-hc-muted">{t("dashboard.noWidgets")}</div><Button className="mt-3" onClick={() => setAddOpen(true)}>+ {t("dashboard.addWidget")}</Button></Card>}

    <Dialog open={addOpen} title={t("dashboard.addWidget")} onClose={() => setAddOpen(false)}><div className="space-y-4"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{t("dashboard.addWidget")}</h2><Button variant="ghost" onClick={() => setAddOpen(false)}>×</Button></div><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("dashboard.searchWidgets")} autoFocus />
      <div className="max-h-[60vh] space-y-4 overflow-y-auto">{[...groups.entries()].map(([category, definitions]) => <section key={category}><h3 className="mb-1.5 text-xs font-semibold uppercase text-hc-muted">{category}</h3><div className="grid gap-2">{definitions.map((definition) => <button key={definition.id} type="button" className="rounded-hc-md border border-hc-outline p-3 text-left transition hover:border-hc-primary hover:bg-hc-surface-variant focus:outline-none focus:ring-2 focus:ring-hc-primary/40" onClick={() => { dashboard.show(definition.id); setAddOpen(false); setSearch(""); }}><span className="block text-sm font-semibold">{widgetTitle(definition, t)}</span>{(definition.description || definition.descriptionKey) && <span className="mt-1 block text-xs text-hc-muted">{definition.description ?? t(definition.descriptionKey!)}</span>}</button>)}</div></section>)}{hidden.length === 0 && <div className="py-8 text-center text-sm text-hc-muted">{t("dashboard.noAvailableWidgets")}</div>}</div>
    </div></Dialog>

    <Dialog open={Boolean(configureWidget)} title={configureWidget ? widgetTitle(configureWidget, t) : undefined} onClose={() => setConfigureWidget(null)}><div className="space-y-4"><div className="flex items-center justify-between"><div><div className="text-xs uppercase text-hc-muted">{t("dashboard.configureWidget")}</div><h2 className="text-lg font-semibold">{configureWidget ? widgetTitle(configureWidget, t) : ""}</h2></div><Button variant="ghost" onClick={() => setConfigureWidget(null)}>×</Button></div>{configureWidget?.settingsComponent ? <configureWidget.settingsComponent value={draftSettings} onChange={setDraftSettings} /> : <div className="text-sm text-hc-muted">{t("dashboard.noWidgetSettings")}</div>}<div className="flex justify-end gap-2"><Button variant="outlined" onClick={() => setConfigureWidget(null)}>{t("common.cancel")}</Button><Button onClick={() => { if (configureWidget) dashboard.configure(configureWidget.id, draftSettings); setConfigureWidget(null); }}>{t("common.save")}</Button></div></div></Dialog>
  </div>;
}

function WidgetCard({ definition, size, settings, menuOpen, onMenu, onConfigure, onRefresh, onHide, onResize, dragging, onDragStart, onDrop, t }: { definition: DashboardWidgetDefinition; size: WidgetSize; settings: WidgetSettings; menuOpen: boolean; onMenu(): void; onConfigure(): void; onRefresh(): void; onHide(): void; onResize(size: WidgetSize): void; dragging: boolean; onDragStart(): void; onDrop(): void; t(key: string): string }) {
  const Component = definition.component;
  const span = size === "wide" ? "md:col-span-2 xl:col-span-4" : size === "medium" ? "md:col-span-2" : "";
  return <Card className={`${span} relative flex flex-col self-start overflow-visible p-0 ${dragging ? "opacity-50" : ""}`} draggable onDragStart={onDragStart} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
    <div className="flex cursor-grab items-start justify-between gap-3 border-b border-hc-outline px-4 py-2.5 active:cursor-grabbing"><div className="min-w-0"><h2 className="truncate text-sm font-semibold">{widgetTitle(definition, t)}</h2><div className="mt-0.5 truncate text-xs text-hc-muted">{widgetCategory(definition, t)}</div></div><div className="relative shrink-0"><button type="button" className="rounded-hc-sm px-2 py-1 text-lg leading-none text-hc-muted hover:bg-hc-surface-variant focus:outline-none focus:ring-2 focus:ring-hc-primary/40" onClick={onMenu} aria-expanded={menuOpen} aria-label={t("dashboard.widgetMenu")}>⋮</button>{menuOpen && <div className="absolute right-0 top-8 z-30 w-44 rounded-hc-md border border-hc-outline bg-hc-surface p-1.5 shadow-xl"><button className="w-full rounded-hc-sm px-3 py-2 text-left text-sm hover:bg-hc-surface-variant" onClick={onConfigure}>{t("dashboard.configureWidget")}</button><button className="w-full rounded-hc-sm px-3 py-2 text-left text-sm hover:bg-hc-surface-variant" onClick={onRefresh}>{t("dashboard.refreshWidget")}</button><div className="my-1 border-t border-hc-outline" /><div className="px-3 py-1 text-xs text-hc-muted">{t("dashboard.widgetSize")}</div><div className="flex gap-1 px-2 pb-1">{definition.supportedSizes.map((option) => <button key={option} className={`rounded px-2 py-1 text-xs ${size === option ? "bg-hc-primary text-hc-on-primary" : "bg-hc-surface-variant"}`} onClick={() => onResize(option)}>{t(`dashboard.size.${option}`)}</button>)}</div><div className="my-1 border-t border-hc-outline" /><button className="w-full rounded-hc-sm px-3 py-2 text-left text-sm text-hc-danger hover:bg-hc-danger/10" onClick={onHide}>{t("dashboard.hideWidget")}</button></div>}</div></div>
    <div className="min-h-0 flex-1 p-3"><WidgetErrorBoundary fallback={t("dashboard.widgetError")}><Component settings={settings} size={size} /></WidgetErrorBoundary></div>
  </Card>;
}

function DashboardSkeleton() { return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 6 }, (_, index) => <Card key={index} className="h-40 animate-pulse bg-hc-surface-variant/40" />)}</div>; }
class WidgetErrorBoundary extends Component<{ children: ReactNode; fallback: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Dashboard widget failed", error, info); }
  render() { return this.state.failed ? <div className="py-3 text-sm text-hc-danger">{this.props.fallback}</div> : this.props.children; }
}
function widgetTitle(definition: DashboardWidgetDefinition, t: (key: string) => string) { return definition.title ?? t(definition.titleKey); }
function widgetCategory(definition: DashboardWidgetDefinition, t: (key: string) => string) { return definition.category ?? t(definition.categoryKey); }
