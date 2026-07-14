import type { PropsWithChildren } from "react";

import { NavLink, useLocation } from "react-router-dom";

import { useAppRegistryQuery } from "../../data/api/app-registry";
import { useLocalization } from "../../localization/LocalizationProvider";

type SidebarNavProps = PropsWithChildren<{
  privileges?: string[];
}>;

const sidebarConfig = [
  {
    prefix: "/core/dashboard",
    titleKey: "nav.dashboard",
    items: [
      { to: "/core/dashboard", labelKey: "nav.overview" },
      { to: "/core/dashboard#context", label: "Context snapshot" },
    ],
  },
  {
    prefix: "/core/help",
    titleKey: "nav.help",
    items: [
      { to: "/core/help", labelKey: "nav.help" },
    ],
  },
  {
    prefix: "/core/account",
    titleKey: "nav.account",
    items: [
      { to: "/core/account", labelKey: "nav.session" },
      { to: "/core/account/security", labelKey: "nav.security" },
    ],
  },
  {
    prefix: "/core/apps",
    title: "Apps",
    items: [
      { to: "/core/apps", label: "Catalog" },
      { to: "/core/apps/feeds", label: "Feed sources" },
      { to: "/core/apps/installed", label: "Installed apps" },
      { to: "/core/apps/licensing", label: "Tenant licensing" },
    ],
  },
  {
    prefix: "/core/licensing",
    title: "Licensing",
    items: [
      { to: "/core/licensing", label: "License inventory" },
      { to: "/core/licensing/import", label: "Offline import" },
      { to: "/core/licensing/activation", label: "OAuth activation" },
    ],
  },
  {
    prefix: "/core/platform",
    title: "Platform configuration",
    items: [
      { to: "/core/platform", label: "Dashboard" },
      { to: "/core/platform/instance", label: "Instance" },
      { to: "/core/platform/trusted-origins", label: "Trusted origins" },
      { to: "/core/platform/app-distribution", label: "App distribution" },
      { to: "/core/platform/identity", label: "Identity & tenancy" },
      { to: "/core/platform/automation", label: "Automation" },
    ],
  },
  {
    prefix: "/core/tenant",
    title: "Tenant configuration",
    items: [
      { to: "/core/tenant", label: "Dashboard" },
      { to: "/core/tenant/details", label: "Tenant details" },
      { to: "/core/tenant/users", label: "Users & roles" },
      { to: "/core/tenant/apps", label: "Apps & licenses" },
      { to: "/core/tenant/audit", label: "Audit context" },
    ],
  },
];

export function SidebarNav({ children }: SidebarNavProps) {
  const { t } = useLocalization();
  const location = useLocation();
  const { data: appRegistry } = useAppRegistryQuery(location.pathname.startsWith("/app/"));
  const slug = location.pathname.startsWith("/app/") ? location.pathname.split("/")[2] : null;
  const appEntry = appRegistry?.items.find((item) => item.slug === slug);
  const fallbackSection = sidebarConfig[0];

  const current = appEntry
    ? {
        title: appEntry.app_id,
        items: appEntry.nav_entries.map((entry) => ({ to: entry.path, label: entry.label })),
      }
    : (() => {
        const section = sidebarConfig.find((item) => location.pathname.startsWith(item.prefix)) ?? fallbackSection;
        return {
          title: "titleKey" in section && typeof section.titleKey === "string" ? t(section.titleKey) : section.title,
          items: section.items.map((item) => ({
            to: item.to,
            label: "labelKey" in item && typeof item.labelKey === "string" ? t(item.labelKey) : item.label,
          })),
        };
      })();

  return (
    <>
      <aside className="w-full shrink-0 border-b border-hc-outline bg-hc-rail px-4 py-3 md:w-60 md:border-b-0 md:border-r md:py-5">
        <div className="text-xs uppercase text-hc-muted">{current.title}</div>
        <nav className="mt-2 flex gap-1 overflow-x-auto md:mt-3 md:flex-col">
          {current.items.map((item) => (
            <NavLink
              key={`${item.to}-${item.label}`}
              to={item.to}
              end={!item.to.includes("#")}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-hc-sm px-3 py-1.5 text-sm transition ${
                  isActive
                    ? "bg-hc-surface text-hc-text"
                    : "text-hc-muted hover:bg-hc-surface-variant hover:text-hc-text"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-5 lg:p-6">{children}</main>
    </>
  );
}
