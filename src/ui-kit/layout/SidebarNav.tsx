import type { PropsWithChildren } from "react";

import { NavLink, useLocation } from "react-router-dom";

import { useAppRegistryQuery } from "../../data/api/app-registry";
import { useLocalization } from "../../localization/LocalizationProvider";

type SidebarNavProps = PropsWithChildren<{
  privileges?: string[];
}>;

const sidebarConfig = [
  {
    prefix: "/core/audit",
    titleKey: "nav.auditLog",
    items: [{ to: "/core/audit", labelKey: "nav.auditLog" }],
  },
  {
    prefix: "/core/dashboard",
    titleKey: "nav.dashboard",
    items: [
      { to: "/core/dashboard", labelKey: "nav.overview" },
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
    titleKey: "settings.user",
    items: [
      { to: "/core/account", labelKey: "nav.profile" },
      { to: "/core/account/session", labelKey: "nav.session" },
      { to: "/core/account/security", labelKey: "nav.security" },
    ],
  },
  {
    prefix: "/core/apps",
    titleKey: "nav.apps",
    items: [
      { to: "/core/apps", labelKey: "nav.catalog" },
      { to: "/core/apps/feeds", labelKey: "nav.feedSources" },
      { to: "/core/apps/installed", labelKey: "nav.installedApps" },
      { to: "/core/apps/license-binding", labelKey: "nav.licenseBinding" },
    ],
  },
  {
    prefix: "/core/licensing",
    titleKey: "nav.licensing",
    items: [
      { to: "/core/licensing", labelKey: "nav.overview" },
      { to: "/core/licensing/entitlements", labelKey: "nav.entitlements" },
      { to: "/core/licensing/activation", labelKey: "nav.activateFromVendor" },
      { to: "/core/licensing/import", labelKey: "nav.importOfflineLicense" },
      { to: "/core/licensing/selections", labelKey: "nav.activeSelections" },
    ],
  },
  {
    prefix: "/core/platform",
    titleKey: "nav.platformSettings",
    items: [
      { to: "/core/platform", labelKey: "nav.overview" },
      { to: "/core/platform/instance", labelKey: "nav.instance" },
      { to: "/core/platform/trusted-origins", labelKey: "nav.trustedOrigins" },
      { to: "/core/platform/app-distribution", labelKey: "nav.appDistribution" },
      { to: "/core/platform/authors", labelKey: "nav.applicationAuthors" },
      { to: "/core/platform/identity", labelKey: "nav.identityTenancy" },
      { to: "/core/platform/automation", labelKey: "nav.automation" },
    ],
  },
  {
    prefix: "/core/tenant",
    titleKey: "nav.tenantSettings",
    items: [
      { to: "/core/tenant", labelKey: "nav.overview" },
      { to: "/core/tenant/details", labelKey: "nav.details" },
      { to: "/core/tenant/users", labelKey: "nav.usersPrivileges" },
      { to: "/core/tenant/apps", labelKey: "nav.appsLicenseStatus" },
      { to: "/core/tenant/audit", labelKey: "nav.auditContext" },
    ],
  },
];

export function SidebarNav({ children, privileges = [] }: SidebarNavProps) {
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
        let section = sidebarConfig.find((item) => location.pathname.startsWith(item.prefix)) ?? fallbackSection;
        if (section.prefix === "/core/audit" && !["core.audit.read.own", "core.audit.read.tenant", "platform.audit.read", "platform.superadmin"].some((item) => privileges.includes(item))) section = fallbackSection;
        return {
          title: t(section.titleKey),
          items: section.items.map((item) => ({
            to: item.to,
            label: t(item.labelKey),
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
