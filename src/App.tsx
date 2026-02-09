import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./app/AppShell";
import { RequirePrivilege } from "./app/RequirePrivilege";
import { LoginPage } from "./core-console/pages/LoginPage";
import { DashboardPage } from "./core-console/pages/DashboardPage";
import { AppsPage } from "./core-console/pages/AppsPage";
import { LicensingPage } from "./core-console/pages/LicensingPage";
import { PlatformConfigPage } from "./core-console/pages/PlatformConfigPage";
import { TenantConfigPage } from "./core-console/pages/TenantConfigPage";
import { AppRuntimePage } from "./app/AppRuntimePage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/core" element={<AppShell />}>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="apps" element={<AppsPage />} />
        <Route path="licensing" element={<LicensingPage />} />
        <Route
          path="platform"
          element={
            <RequirePrivilege required="platform.superadmin">
              <PlatformConfigPage />
            </RequirePrivilege>
          }
        />
        <Route
          path="tenant"
          element={
            <RequirePrivilege required="tenant.config.manage">
              <TenantConfigPage />
            </RequirePrivilege>
          }
        />
      </Route>
      <Route path="/admin" element={<AppShell />}>
        <Route path="apps" element={<AppsPage />} />
      </Route>
      <Route path="/app/:slug/*" element={<AppShell />}>
        <Route index element={<AppRuntimePage />} />
        <Route path="*" element={<AppRuntimePage />} />
      </Route>
    </Routes>
  );
}
