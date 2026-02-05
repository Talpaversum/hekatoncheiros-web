import type { PropsWithChildren } from "react";

import { NavLink, useLocation } from "react-router-dom";

import { useAppRegistryQuery } from "../../data/api/app-registry";

type SidebarNavProps = PropsWithChildren;

const sidebarConfig = [
  {
    prefix: "/core/dashboard",
    title: "Dashboard",
    items: [
      { to: "/core/dashboard", label: "Overview" },
      { to: "/core/dashboard", label: "Context snapshot" },
    ],
  },
  {
    prefix: "/core/apps",
    title: "Apps",
    items: [
      { to: "/core/apps", label: "Registry" },
      { to: "/core/apps", label: "Tenant enablement" },
    ],
  },
  {
    prefix: "/core/licensing",
    title: "Licensing",
    items: [
      { to: "/core/licensing", label: "App inventory" },
      { to: "/core/licensing", label: "Aktivace" },
    ],
  },
  {
    prefix: "/admin",
    title: "Admin",
    items: [{ to: "/admin/apps", label: "Apps" }],
  },
];

export function SidebarNav({ children }: SidebarNavProps) {
  const location = useLocation();
  const { data: appRegistry } = useAppRegistryQuery(location.pathname.startsWith("/app/"));
  const appId = location.pathname.startsWith("/app/") ? location.pathname.split("/")[2] : null;
  const appEntry = appRegistry?.items.find((item) => item.app_id === appId);

  const current = appEntry
    ? {
        title: appEntry.app_id,
        items: appEntry.nav_entries.map((entry) => ({ to: entry.path, label: entry.label })),
      }
    : sidebarConfig.find((section) => location.pathname.startsWith(section.prefix)) ?? sidebarConfig[0];

  return (
    <>
      <aside className="w-64 bg-hc-rail px-5 py-6 shadow-hc-card">
        <div className="text-xs uppercase text-hc-muted">{current.title}</div>
        <nav className="mt-4 flex flex-col gap-2">
          {current.items.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) =>
                `rounded-hc-sm px-3 py-2 text-sm transition ${
                  isActive
                    ? "bg-hc-surface text-hc-text shadow-hc-card"
                    : "text-hc-muted hover:bg-hc-surface-variant hover:text-hc-text"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </>
  );
}
