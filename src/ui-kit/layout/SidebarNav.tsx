import type { PropsWithChildren } from "react";

import { NavLink } from "react-router-dom";

type Item = {
  to: string;
  label: string;
};

type SidebarNavProps = PropsWithChildren<{ items: Item[] }>;

export function SidebarNav({ items, children }: SidebarNavProps) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r border-hc-border bg-hc-surface p-6">
        <div className="text-lg font-semibold">Hekatoncheiros Core</div>
        <nav className="mt-6 flex flex-col gap-2">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-hc-sm px-3 py-2 text-sm ${
                  isActive ? "bg-hc-primary text-hc-primary-foreground" : "text-hc-muted hover:text-hc-text"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
