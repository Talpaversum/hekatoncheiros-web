import type { PropsWithChildren } from "react";

import { NavLink, useLocation } from "react-router-dom";

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
];

export function SidebarNav({ children }: SidebarNavProps) {
  const location = useLocation();
  const current = sidebarConfig.find((section) => location.pathname.startsWith(section.prefix)) ?? sidebarConfig[0];

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
