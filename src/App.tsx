import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./app/AppShell";
import { LoginPage } from "./core-console/pages/LoginPage";
import { DashboardPage } from "./core-console/pages/DashboardPage";
import { AppsPage } from "./core-console/pages/AppsPage";
import { LicensingPage } from "./core-console/pages/LicensingPage";
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
      </Route>
      <Route path="/admin" element={<AppShell />}>
        <Route path="apps" element={<AppsPage />} />
      </Route>
      <Route path="/app/:appId/*" element={<AppShell />}>
        <Route index element={<AppRuntimePage />} />
        <Route path="*" element={<AppRuntimePage />} />
      </Route>
    </Routes>
  );
}
