import { Navigate, Outlet } from "react-router-dom";

import { SidebarNav } from "../ui-kit/layout/SidebarNav";
import { useContextQuery } from "../data/api/context";
import { getAccessToken } from "../data/auth/storage";

const navItems = [
  { to: "/core/dashboard", label: "Dashboard" },
  { to: "/core/apps", label: "Apps" },
  { to: "/core/licensing", label: "Licensing" },
];

export function AppShell() {
  const token = getAccessToken();
  const { data } = useContextQuery(!!token);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <SidebarNav items={navItems}>
      {data?.actor?.impersonating && (
        <div className="mb-4 rounded-hc-sm border border-hc-danger bg-hc-danger/10 px-4 py-2 text-xs text-hc-danger">
          Impersonation aktivní
        </div>
      )}
      <Outlet />
    </SidebarNav>
  );
}
