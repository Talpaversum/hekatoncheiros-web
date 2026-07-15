import { useSyncExternalStore } from "react";
import { hasPrivilege } from "../access/privileges";
import { useUserPreferenceQuery, useSaveUserPreferenceMutation } from "../data/api/preferences";

import type { DashboardPreferences, DashboardWidgetDefinition, DashboardWidgetPreference, WidgetSize, WidgetSettings } from "./widget-contract";
import { getDashboardWidgetRegistryVersion, listDashboardWidgets, subscribeDashboardWidgets } from "./widget-registry";

export const DASHBOARD_PREFERENCE_NAMESPACE = "dashboard.v1";

function hasRequiredPrivileges(privileges: string[], definition: DashboardWidgetDefinition) {
  return definition.requiredPrivileges.every((requirement) => requirement.split("|").some((privilege) => hasPrivilege(privileges, privilege)));
}

function defaultPreference(definition: DashboardWidgetDefinition): DashboardWidgetPreference {
  return { visible: definition.defaultVisible, position: definition.defaultPosition, size: definition.defaultSize, settings: definition.defaultSettings };
}

function supportedPreference(definition: DashboardWidgetDefinition, preference: DashboardWidgetPreference) {
  return definition.supportedSizes.includes(preference.size) ? preference : { ...preference, size: definition.defaultSize };
}

export function createEffectiveDashboardPreferences(saved: DashboardPreferences | null | undefined, definitions: DashboardWidgetDefinition[]) {
  const widgets: Record<string, DashboardWidgetPreference> = { ...(saved?.widgets ?? {}) };
  for (const definition of definitions) {
    if (!widgets[definition.id]) widgets[definition.id] = saved ? { ...defaultPreference(definition), visible: false } : defaultPreference(definition);
    else widgets[definition.id] = supportedPreference(definition, widgets[definition.id]);
  }
  return { version: 1, initialized: true, widgets } satisfies DashboardPreferences;
}

export function useDashboardPreferences(privileges: string[]) {
  useSyncExternalStore(subscribeDashboardWidgets, getDashboardWidgetRegistryVersion, getDashboardWidgetRegistryVersion);
  const query = useUserPreferenceQuery<DashboardPreferences>(DASHBOARD_PREFERENCE_NAMESPACE);
  const save = useSaveUserPreferenceMutation<DashboardPreferences>(DASHBOARD_PREFERENCE_NAMESPACE);
  const definitions = listDashboardWidgets().filter((definition) => definition.supportedScopes.includes("tenant") && hasRequiredPrivileges(privileges, definition));
  const preferences = createEffectiveDashboardPreferences(query.data?.value, definitions);
  const persist = (next: DashboardPreferences) => save.mutate(next);
  const updateWidget = (id: string, patch: Partial<DashboardWidgetPreference>) => persist({ ...preferences, widgets: { ...preferences.widgets, [id]: { ...preferences.widgets[id], ...patch } } });
  return {
    query, definitions, preferences, isSaving: save.isPending,
    visible: definitions.filter((definition) => preferences.widgets[definition.id]?.visible).sort((left, right) => preferences.widgets[left.id].position - preferences.widgets[right.id].position),
    hidden: definitions.filter((definition) => !preferences.widgets[definition.id]?.visible),
    show(id: string) { const last = Math.max(0, ...Object.values(preferences.widgets).map((widget) => widget.position)); updateWidget(id, { visible: true, position: last + 10 }); },
    hide(id: string) { updateWidget(id, { visible: false }); },
    resize(id: string, size: WidgetSize) { const definition = definitions.find((item) => item.id === id); if (definition?.supportedSizes.includes(size)) updateWidget(id, { size }); },
    configure(id: string, settings: WidgetSettings) { updateWidget(id, { settings }); },
    reorder(sourceId: string, targetId: string) {
      const ordered = definitions.filter((definition) => preferences.widgets[definition.id]?.visible).sort((left, right) => preferences.widgets[left.id].position - preferences.widgets[right.id].position).map((definition) => definition.id);
      const sourceIndex = ordered.indexOf(sourceId); const targetIndex = ordered.indexOf(targetId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
      ordered.splice(targetIndex, 0, ordered.splice(sourceIndex, 1)[0]);
      const widgets = { ...preferences.widgets }; ordered.forEach((id, index) => { widgets[id] = { ...widgets[id], position: (index + 1) * 10 }; });
      persist({ ...preferences, widgets });
    },
    restoreDefaults() { persist(createEffectiveDashboardPreferences(null, definitions)); },
    reset() { save.mutate(null); },
  };
}
