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
import { AuthorWorkspacePage } from "./core-console/pages/author-workspace/AuthorWorkspacePage";
import { DeveloperToolsPage } from "./core-console/pages/developer/DeveloperToolsPage";
import { AuthorOnboardingPage } from "./core-console/pages/author-workspace/AuthorOnboardingPage";
import { AuthorAdministrationPage } from "./core-console/pages/platform-admin/authors/AuthorAdministrationPage";
import { RegistryAdministrationPage } from "./core-console/pages/platform-admin/registry/RegistryAdministrationPage";
import { CatalogReviewPage } from "./core-console/pages/platform-admin/catalog/CatalogReviewPage";
import { RuntimeReviewPage } from "./core-console/pages/platform-admin/runtime/RuntimeReviewPage";
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
        <Route path="author/:authorId/*" element={<RequireAuthorMembership><AuthorWorkspacePage /></RequireAuthorMembership>} />
        <Route path="developer/*" element={<RequireCapability capability="privateAppDevelopment"><DeveloperToolsPage /></RequireCapability>} />
        <Route path="author-onboarding/*" element={<RequireCapability capability="officialAuthorOnboarding"><AuthorOnboardingPage /></RequireCapability>} />
        <Route path="admin/authors/*" element={<RequireCapability capability="officialAuthorOnboarding"><RequirePrivilege required="platform.authors.manage"><AuthorAdministrationPage /></RequirePrivilege></RequireCapability>} />
        <Route path="admin/registry/*" element={<RequireCapability capability="officialAuthorRegistry"><RequirePrivilege required="platform.author_registry.manage"><RegistryAdministrationPage /></RequirePrivilege></RequireCapability>} />
        <Route path="admin/catalog/*" element={<RequireCapability capability="officialCatalogReview"><RequirePrivilege required="platform.catalog.manage"><CatalogReviewPage /></RequirePrivilege></RequireCapability>} />
        <Route path="admin/runtime/*" element={<RequireCapability capability="hostedRuntime"><RequirePrivilege required="platform.apps.runtime.manage"><RuntimeReviewPage /></RequirePrivilege></RequireCapability>} />
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
