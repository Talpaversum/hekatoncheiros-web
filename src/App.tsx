import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./app/AppShell";
import { RequirePrivilege } from "./app/RequirePrivilege";
import { AccountPage } from "./core-console/pages/AccountPage";
import { LoginPage } from "./core-console/pages/LoginPage";
import { DashboardPage } from "./core-console/pages/DashboardPage";
import { HelpPage } from "./core-console/pages/HelpPage";
import { AppsPage } from "./core-console/pages/AppsPage";
import { LicensingPage } from "./core-console/pages/LicensingPage";
import { PlatformConfigPage } from "./core-console/pages/PlatformConfigPage";
import { TenantConfigPage } from "./core-console/pages/TenantConfigPage";
import { AppRuntimePage } from "./app/AppRuntimePage";
import { AuditLogPage } from "./core-console/pages/AuditLogPage";
import { AuthorWorkspacePage } from "./core-console/pages/AuthorPortalPage";
import { DeveloperToolsPage } from "./core-console/pages/DeveloperToolsPage";
import { AuthorOnboardingPage } from "./core-console/pages/AuthorOnboardingPage";
import { RegistryAdministrationPage } from "./core-console/pages/RegistryAdministrationPage";
import { RequireCapability } from "./app/RequireCapability";
import { RequireAuthorMembership } from "./app/RequireAuthorMembership";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/core" element={<AppShell />}>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="help" element={<HelpPage />} />
        <Route path="help/:categorySlug" element={<HelpPage />} />
        <Route path="account/*" element={<AccountPage />} />
        <Route path="apps/*" element={<AppsPage />} />
        <Route path="licensing/*" element={<LicensingPage />} />
        <Route path="author/*" element={<RequireAuthorMembership><AuthorWorkspacePage /></RequireAuthorMembership>} />
        <Route path="developer" element={<RequireCapability capability="privateAppDevelopment"><DeveloperToolsPage /></RequireCapability>} />
        <Route path="author-onboarding/*" element={<RequireCapability capability="officialAuthorOnboarding"><AuthorOnboardingPage /></RequireCapability>} />
        <Route path="registry/*" element={<RequireCapability capability="officialAuthorRegistry"><RequirePrivilege required="platform.authors.manage"><RegistryAdministrationPage /></RequirePrivilege></RequireCapability>} />
        <Route path="audit" element={<AuditLogPage />} />
        <Route
          path="platform/*"
          element={
            <RequirePrivilege required="platform.superadmin">
              <PlatformConfigPage />
            </RequirePrivilege>
          }
        />
        <Route
          path="tenant/*"
          element={
            <RequirePrivilege required="tenant.config.manage">
              <TenantConfigPage />
            </RequirePrivilege>
          }
        />
      </Route>
      <Route path="/app/:slug/*" element={<AppShell />}>
        <Route index element={<AppRuntimePage />} />
        <Route path="*" element={<AppRuntimePage />} />
      </Route>
    </Routes>
  );
}
