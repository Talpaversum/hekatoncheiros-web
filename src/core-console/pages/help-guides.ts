import { hasPrivilege } from "../../access/privileges";
import type { InstanceCapabilities } from "../../data/api/author-portal";
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
  requiredCapability?: keyof InstanceCapabilities;
};

type HelpGuideDefinition = {
  key: string;
  categoryKey: string;
  stepCount: number;
  path: string;
  requiredPrivilege?: string;
  requiredCapability?: keyof InstanceCapabilities;
};

const platformHelpGuideDefinitions: HelpGuideDefinition[] = [
  { key: "privateVsOfficial", categoryKey: "help.categoryApplications", stepCount: 2, path: "/core/developer", requiredCapability: "privateAppDevelopment" },
  { key: "developerLifecycle", categoryKey: "help.categoryApplications", stepCount: 2, path: "/core/developer", requiredCapability: "privateAppDevelopment", requiredPrivilege: "developer.projects.read" },
  { key: "officialModes", categoryKey: "help.categoryDistribution", stepCount: 2, path: "/core/author/onboarding", requiredCapability: "officialAuthorOnboarding" },
  { key: "trustedOrigin", categoryKey: "help.categoryPlatform", stepCount: 2, path: "/core/developer", requiredCapability: "trustedOrigins" },
  { key: "privateManifestFeed", categoryKey: "help.categoryApplications", stepCount: 2, path: "/core/developer", requiredCapability: "privateAppDevelopment" },
  { key: "authorScope", categoryKey: "help.categoryPlatform", stepCount: 2, path: "/core/author", requiredCapability: "officialAuthorOnboarding" },
  { key: "registryCertificate", categoryKey: "help.categoryPlatform", stepCount: 2, path: "/core/platform/author-registry", requiredCapability: "officialAuthorRegistry", requiredPrivilege: "platform.author_registry.read" },
  { key: "licensingModes", categoryKey: "help.categoryLicensing", stepCount: 2, path: "/core/author", requiredCapability: "officialAuthorOnboarding" },
  { key: "catalogReview", categoryKey: "help.categoryDistribution", stepCount: 2, path: "/core/author/catalog", requiredCapability: "officialCatalogPublishing" },
  { key: "runtimeReview", categoryKey: "help.categoryApplications", stepCount: 2, path: "/core/platform/runtime-review", requiredCapability: "hostedRuntime", requiredPrivilege: "platform.apps.runtime.manage" },
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
    path: "/core/licensing/activation",
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

export function getVisiblePlatformHelpGuides(privileges: string[], t: Translate, capabilities?: InstanceCapabilities): HelpGuide[] {
  return platformHelpGuideDefinitions
    .filter((item) => !item.requiredPrivilege || hasPrivilege(privileges, item.requiredPrivilege))
    .filter((item) => !item.requiredCapability || capabilities?.[item.requiredCapability]?.available === true)
    .map((item) => ({
      title: t(item.requiredCapability ? `help.workflow.${item.key}.title` : `help.guide.${item.key}.title`),
      summary: t(item.requiredCapability ? `help.workflow.${item.key}.summary` : `help.guide.${item.key}.summary`),
      outcome: t(item.requiredCapability ? `help.workflow.${item.key}.outcome` : `help.guide.${item.key}.outcome`),
      category: t(item.categoryKey),
      path: item.path,
      source: "Hekatoncheiros",
      actionLabel: t(item.requiredCapability ? `help.workflow.${item.key}.action` : `help.guide.${item.key}.action`),
      requiredPrivilege: item.requiredPrivilege,
      steps: Array.from({ length: item.stepCount }, (_, index) => t(`${item.requiredCapability ? "help.workflow" : "help.guide"}.${item.key}.step${index + 1}`)),
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
