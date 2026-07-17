import { Link } from "react-router-dom";

import { useAuthorOverview } from "../../data/api/author-portal";
import { useLocalization } from "../../localization/LocalizationProvider";
import { Card } from "../../ui-kit/components/Card";
import { EmptyState, PageHeader, SectionHeader, StatusBadge } from "../../ui-kit/components/Page";

export function DeveloperToolsPage() {
  const { t } = useLocalization();
  const overview = useAuthorOverview();
  const capabilities = overview.data?.capabilities.instance;
  if (overview.isLoading) return <Card><EmptyState>{t("common.loading")}</EmptyState></Card>;
  return <div className="space-y-5">
    <PageHeader eyebrow={t("authorPortal.eyebrow")} title={t("authorPortal.developerTools")} description={t("authorPortal.developerToolsDescription")} />
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <Tool title={t("authorPortal.privateApps")} enabled={capabilities?.privateAppDevelopment.available} to="/core/apps/installed" />
      <Tool title={t("nav.feedSources")} enabled={capabilities?.privateCatalogs.available} to="/core/apps/feeds" />
      <Tool title={t("nav.trustedOrigins")} enabled={capabilities?.trustedOrigins.available} to="/core/platform/trusted-origins" />
    </div>
    <Card><SectionHeader className="-mx-4 -mt-4" title={t("authorPortal.officialServices")} description={t("authorPortal.officialServicesDescription")} />
      <div className="flex flex-wrap gap-3">
        {capabilities?.officialAuthorOnboarding.available && <Link className="text-hc-primary" to="/core/author-onboarding">{t("authorPortal.become")}</Link>}
        {overview.data?.profiles.length ? <Link className="text-hc-primary" to="/core/author">{t("authorPortal.title")}</Link> : null}
        {capabilities?.officialAuthorRegistry.available && overview.data?.operator && <Link className="text-hc-primary" to="/core/registry">{t("authorPortal.registryAdministration")}</Link>}
      </div>
    </Card>
  </div>;
}

function Tool({ title, enabled, to }: { title: string; enabled?: boolean; to: string }) {
  const { t } = useLocalization();
  return <Card className="space-y-3"><div className="flex items-center justify-between gap-2"><h2 className="font-semibold">{title}</h2><StatusBadge tone={enabled ? "success" : "neutral"}>{t(enabled ? "authorPortal.available" : "authorPortal.unavailable")}</StatusBadge></div>{enabled && <Link className="text-sm text-hc-primary" to={to}>{t("authorPortal.openTool")}</Link>}</Card>;
}
