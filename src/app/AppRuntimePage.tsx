import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useLocation, useParams } from "react-router-dom";

import { useContextQuery } from "../data/api/context";
import { useAppRegistryQuery } from "../data/api/app-registry";
import { API_BASE } from "../data/api/client";
import { authFetch } from "../data/auth/auth-fetch";

function rewritePluginImports(params: {
  source: string;
  reactModuleUrl: string;
  jsxRuntimeModuleUrl: string;
}) {
  return params.source
    .replace(/from\s+["']react\/[jJ][sS][xX]-runtime["']/g, `from "${params.jsxRuntimeModuleUrl}"`)
    .replace(/from\s+["']react["']/g, `from "${params.reactModuleUrl}"`);
}

type PluginRoute = {
  path: string;
  component: ComponentType<Record<string, never>>;
};

type PluginRegistration = {
  routes: PluginRoute[];
};

type AppContext = {
  api: {
    request<T>(path: string, init?: RequestInit): Promise<T>;
  };
  privileges: string[];
  entitlement?: {
    tier: string;
    valid_from: string;
    valid_to: string;
    limits: Record<string, unknown>;
    source: string;
    entitlement_id: string;
  } | null;
};

function matchesRoutePath(routePath: string, subPath: string) {
  const normalizedRoutePath = routePath.replace(/^\/+|\/+$/g, "");
  const normalizedSubPath = subPath.replace(/^\/+|\/+$/g, "");

  if (normalizedRoutePath === "") {
    return normalizedSubPath === "";
  }
  if (normalizedRoutePath === "*") {
    return true;
  }
  if (normalizedRoutePath.endsWith("/*")) {
    const prefix = normalizedRoutePath.slice(0, -2);
    return normalizedSubPath === prefix || normalizedSubPath.startsWith(`${prefix}/`);
  }
  return normalizedSubPath === normalizedRoutePath;
}

export function AppRuntimePage() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();

  const { data: registry, isLoading: isRegistryLoading } = useAppRegistryQuery(Boolean(slug));
  const { data: context, isLoading: isContextLoading } = useContextQuery(Boolean(slug));

  const [plugin, setPlugin] = useState<PluginRegistration | null>(null);
  const [pluginError, setPluginError] = useState<string | null>(null);
  const [isPluginLoading, setIsPluginLoading] = useState(false);

  const appEntry = useMemo(
    () => registry?.items.find((item) => item.slug === slug),
    [registry?.items, slug],
  );

  useEffect(() => {
    if (!appEntry) {
      setPlugin(null);
      return;
    }

    let cancelled = false;
    setIsPluginLoading(true);
    setPluginError(null);

    const appContext: AppContext = {
      api: {
        request: (path, init) => authFetch(path, init),
      },
      privileges: context?.privileges ?? [],
      entitlement: null,
    };

    const loadPlugin = async () => {
      try {
        const pluginUrl = new URL(appEntry.ui_url, API_BASE).toString();
        const [reactShim, jsxRuntimeShim, pluginResponse, entitlementResponse] = await Promise.all([
          import("./runtime/react-shim"),
          import("./runtime/jsx-runtime-shim"),
          fetch(pluginUrl),
          authFetch<AppContext["entitlement"]>(`/apps/${encodeURIComponent(appEntry.slug)}/entitlement`).catch(() => null),
        ]);

        appContext.entitlement = entitlementResponse;

        if (!pluginResponse.ok) {
          throw new Error(`Plugin module fetch failed: ${pluginResponse.status}`);
        }

        const pluginSource = await pluginResponse.text();
        const rewrittenSource = rewritePluginImports({
          source: pluginSource,
          reactModuleUrl: reactShim.MODULE_URL,
          jsxRuntimeModuleUrl: jsxRuntimeShim.MODULE_URL,
        });
        const blobUrl = URL.createObjectURL(new Blob([rewrittenSource], { type: "text/javascript" }));

        const mod = (await import(/* @vite-ignore */ blobUrl)) as {
          register?: (ctx: AppContext) => PluginRegistration;
        };

        URL.revokeObjectURL(blobUrl);

        if (typeof mod.register !== "function") {
          throw new Error("Plugin module must export register(appContext)");
        }

        const registration = mod.register(appContext);
        if (!registration || !Array.isArray(registration.routes)) {
          throw new Error("Plugin register(appContext) must return { routes: [] }");
        }

        if (!cancelled) {
          setPlugin(registration);
        }
      } catch (error) {
        if (!cancelled) {
          setPlugin(null);
          setPluginError(error instanceof Error ? error.message : "Failed to load plugin");
        }
      } finally {
        if (!cancelled) {
          setIsPluginLoading(false);
        }
      }
    };

    void loadPlugin();

    return () => {
      cancelled = true;
    };
  }, [appEntry, context?.privileges]);

  if (!slug) {
    return <div className="text-sm text-hc-danger">Missing app slug in route.</div>;
  }

  if (isRegistryLoading || isContextLoading || isPluginLoading) {
    return <div className="text-sm text-hc-muted">Načítám app runtime…</div>;
  }

  if (!appEntry) {
    return <div className="text-sm text-hc-danger">App pro slug "{slug}" není v registry.</div>;
  }

  if (pluginError) {
    return <div className="text-sm text-hc-danger">{pluginError}</div>;
  }

  if (!plugin || plugin.routes.length === 0) {
    return <div className="text-sm text-hc-muted">Plugin nedefinuje žádné routy.</div>;
  }

  const basePath = `/app/${slug}`;
  const currentSubPath = location.pathname.startsWith(basePath)
    ? location.pathname.slice(basePath.length).replace(/^\/+/, "")
    : "";

  const matchedRoute =
    plugin.routes.find((route) => matchesRoutePath(route.path, currentSubPath)) ??
    plugin.routes.find((route) => route.path === "") ??
    plugin.routes[0];

  const RouteComponent = matchedRoute.component;
  return <RouteComponent />;
}
