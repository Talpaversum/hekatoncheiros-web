import type { ComponentType } from "react";

export type WidgetSize = "small" | "medium" | "wide";
export type WidgetPresentation = "kpi" | "summary" | "list";
export type WidgetScope = "user" | "tenant" | "platform";
export type WidgetSettings = Record<string, unknown>;
export type DashboardWidgetProps = { settings: WidgetSettings; size: WidgetSize };
export type DashboardWidgetSettingsProps = { value: WidgetSettings; onChange(value: WidgetSettings): void };

export type DashboardWidgetDefinition = {
  id: string;
  titleKey: string;
  title?: string;
  descriptionKey?: string;
  description?: string;
  categoryKey: string;
  category?: string;
  owner: "core" | string;
  requiredPrivileges: string[];
  supportedScopes: readonly WidgetScope[];
  defaultVisible: boolean;
  defaultSize: WidgetSize;
  supportedSizes: readonly WidgetSize[];
  presentation: WidgetPresentation;
  defaultPosition: number;
  defaultSettings: WidgetSettings;
  component: ComponentType<DashboardWidgetProps>;
  settingsComponent?: ComponentType<DashboardWidgetSettingsProps>;
  refresh?: () => void | Promise<void>;
};

export type DashboardWidgetPreference = { visible: boolean; position: number; size: WidgetSize; settings: WidgetSettings };
export type DashboardPreferences = { version: 1; initialized: true; widgets: Record<string, DashboardWidgetPreference> };
