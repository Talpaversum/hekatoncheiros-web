import { hasPrivilege } from "../../access/privileges";
import type { Translate } from "../../localization/LocalizationProvider";

export type HelpGuide = {
  title: string;
  summary: string;
  outcome?: string;
  category: string;
  steps: string[];
  path: string;
  source: string;
  actionLabel?: string;
  requiredPrivilege?: string;
};

type HelpGuideDefinition = {
  key: string;
  categoryKey: string;
  stepCount: number;
  path: string;
  requiredPrivilege?: string;
};

const platformHelpGuideDefinitions: HelpGuideDefinition[] = [
  {
    key: "installCatalog",
    categoryKey: "help.categoryApplications",
    stepCount: 4,
    path: "/core/apps",
    requiredPrivilege: "platform.apps.manage",
  },
  {
    key: "localDevelopment",
    categoryKey: "help.categoryApplications",
    stepCount: 4,
    path: "/core/apps/installed",
    requiredPrivilege: "platform.apps.manage",
  },
  {
    key: "activateLicense",
    categoryKey: "help.categoryLicensing",
    stepCount: 4,
    path: "/core/apps/licensing",
  },
  {
    key: "allowHttp",
    categoryKey: "help.categoryPlatform",
    stepCount: 4,
    path: "/core/platform/trusted-origins",
    requiredPrivilege: "platform.superadmin",
  },
  {
    key: "updateArtifact",
    categoryKey: "help.categoryApplications",
    stepCount: 4,
    path: "/core/apps/installed",
    requiredPrivilege: "platform.apps.manage",
  },
  {
    key: "reportUpdate",
    categoryKey: "help.categoryApplications",
    stepCount: 6,
    path: "/core/apps/installed",
    requiredPrivilege: "platform.apps.manage",
  },
  {
    key: "publishFeed",
    categoryKey: "help.categoryDistribution",
    stepCount: 4,
    path: "/core/apps/feeds",
    requiredPrivilege: "platform.apps.manage",
  },
  {
    key: "grantTenantPrivileges",
    categoryKey: "help.categoryUsers",
    stepCount: 4,
    path: "/core/tenant/users",
    requiredPrivilege: "tenant.config.manage",
  },
];

export function getVisiblePlatformHelpGuides(privileges: string[], t: Translate): HelpGuide[] {
  return platformHelpGuideDefinitions
    .filter((item) => !item.requiredPrivilege || hasPrivilege(privileges, item.requiredPrivilege))
    .map((item) => ({
      title: t(`help.guide.${item.key}.title`),
      summary: t(`help.guide.${item.key}.summary`),
      outcome: t(`help.guide.${item.key}.outcome`),
      category: t(item.categoryKey),
      path: item.path,
      source: "Hekatoncheiros",
      actionLabel: t(`help.guide.${item.key}.action`),
      requiredPrivilege: item.requiredPrivilege,
      steps: Array.from({ length: item.stepCount }, (_, index) => t(`help.guide.${item.key}.step${index + 1}`)),
    }));
}

export function categoryToSlug(category: string) {
  return category
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getHelpCategoryPath(category: string) {
  return `/core/help/${categoryToSlug(category)}`;
}

export function findCategoryBySlug(categories: string[], slug?: string) {
  if (!slug) {
    return null;
  }
  return categories.find((category) => categoryToSlug(category) === slug) ?? null;
}
