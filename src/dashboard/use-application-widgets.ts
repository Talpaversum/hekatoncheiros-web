import { useEffect } from "react";

import { useAppRegistryQuery } from "../data/api/app-registry";
import { useContextQuery } from "../data/api/context";
import { authFetch } from "../data/auth/auth-fetch";
import { useLocalization } from "../localization/LocalizationProvider";

import type { DashboardWidgetDefinition } from "./widget-contract";
import { registerDashboardWidget } from "./widget-registry";

type ApplicationWidget = Omit<DashboardWidgetDefinition, "owner" | "titleKey" | "categoryKey"> & { title: string; category: string; titleKey?: string; categoryKey?: string };
type PluginRegistration = { dashboard_widgets?: ApplicationWidget[] };

export function useApplicationDashboardWidgets(enabled = true) {
  const { data: registry } = useAppRegistryQuery(enabled);
  const { data: context } = useContextQuery(enabled);
  const { locale } = useLocalization();

  useEffect(() => {
    if (!enabled || !registry?.items || !context) return;
    let cancelled = false;
    const load = async () => {
      const [reactShim, jsxRuntimeShim] = await Promise.all([import("../app/runtime/react-shim"), import("../app/runtime/jsx-runtime-shim")]);
      await Promise.all(registry.items.map(async (entry) => {
        let blobUrl: string | null = null;
        try {
          const response = await fetch(new URL(entry.ui_url, window.location.origin));
          if (!response.ok) return;
          const source = (await response.text())
            .replace(/from\s+["']react\/[jJ][sS][xX]-runtime["']/g, `from "${jsxRuntimeShim.MODULE_URL}"`)
            .replace(/from\s+["']react["']/g, `from "${reactShim.MODULE_URL}"`);
          blobUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
          const mod = await import(/* @vite-ignore */ blobUrl) as { register?: (appContext: Record<string, unknown>) => PluginRegistration };
          if (typeof mod.register !== "function" || cancelled) return;
          const registration = mod.register({ api: { request: (path: string, init?: RequestInit) => authFetch(path, init) }, privileges: context.privileges, localization: { requested_locale: locale, locale: entry.localization.supported_locales.includes(locale) ? locale : "en", fallback_locale: "en", resources: entry.localization.resources } });
          for (const widget of registration.dashboard_widgets ?? []) registerDashboardWidget({ ...widget, titleKey: widget.titleKey ?? widget.id, categoryKey: widget.categoryKey ?? `${widget.id}.category`, owner: entry.app_id });
        } catch (error) {
          console.warn(`Dashboard widgets from ${entry.app_id} could not be loaded`, error);
        } finally { if (blobUrl) URL.revokeObjectURL(blobUrl); }
      }));
    };
    void load();
    return () => { cancelled = true; };
  }, [context, enabled, locale, registry?.items]);
}
