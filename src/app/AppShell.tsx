import { Navigate, Outlet } from "react-router-dom";

import { AppTopBar } from "../ui-kit/layout/AppTopBar";
import { SidebarNav } from "../ui-kit/layout/SidebarNav";
import { useContextQuery } from "../data/api/context";
import { getAccessToken } from "../data/auth/storage";

export function AppShell() {
  const token = getAccessToken();
  const { data } = useContextQuery(!!token);
  const privileges = data?.privileges ?? [];

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-hc-bg text-hc-text">
      <AppTopBar userId={data?.actor?.user_id} />
      <div className="flex min-h-[calc(100vh-4rem)]">
        <SidebarNav privileges={privileges}>
          {data?.actor?.impersonating && (
            <div className="mb-4 rounded-hc-sm border border-hc-danger bg-hc-danger/10 px-4 py-2 text-xs text-hc-danger">
              Impersonation aktivní
            </div>
          )}
          <Outlet />
        </SidebarNav>
      </div>
    </div>
  );
}
