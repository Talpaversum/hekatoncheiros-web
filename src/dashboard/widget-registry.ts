import type { DashboardWidgetDefinition } from "./widget-contract";

const widgets = new Map<string, DashboardWidgetDefinition>();
const listeners = new Set<() => void>();
let version = 0;

export function registerDashboardWidget(definition: DashboardWidgetDefinition) {
  if (!/^[a-z][a-z0-9.-]+$/.test(definition.id)) throw new Error(`Invalid dashboard widget id: ${definition.id}`);
  if (typeof definition.component !== "function") throw new Error(`Dashboard widget ${definition.id} has no component`);
  if (!definition.supportedScopes.length) throw new Error(`Dashboard widget ${definition.id} has no supported scope`);
  if (!definition.supportedSizes.length || !definition.supportedSizes.includes(definition.defaultSize)) throw new Error(`Dashboard widget ${definition.id} has invalid supported sizes`);
  if (!(["small", "medium", "wide"] as const).includes(definition.defaultSize)) throw new Error(`Dashboard widget ${definition.id} has an invalid default size`);
  if (widgets.has(definition.id)) return;
  widgets.set(definition.id, definition);
  version += 1;
  listeners.forEach((listener) => listener());
}

export function subscribeDashboardWidgets(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }
export function getDashboardWidgetRegistryVersion() { return version; }

export function listDashboardWidgets() {
  return [...widgets.values()].sort((left, right) => left.defaultPosition - right.defaultPosition);
}
