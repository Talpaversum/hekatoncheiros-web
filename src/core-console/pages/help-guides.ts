import { hasPrivilege } from "../../access/privileges";

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

export const platformHelpGuides: HelpGuide[] = [
  {
    title: "Install an application from the catalog",
    summary: "Use this procedure when an application is available in the catalog and you want to add it to the instance.",
    outcome: "The application is installed and visible to users with the required privileges and license.",
    category: "Applications",
    path: "/core/apps",
    source: "Hekatoncheiros",
    actionLabel: "Open catalog",
    requiredPrivilege: "platform.apps.manage",
    steps: [
      "Open Apps and stay on the Catalog tab.",
      "Check the application's license status and source.",
      "Select Install and confirm the installation plan.",
      "After installation, verify the application on the Installed apps tab.",
    ],
  },
  {
    title: "Add a local development application",
    summary: "Use this procedure to connect a running application outside the catalog through its manifest.",
    outcome: "Core downloads the manifest, verifies its source, and stores the UI artifact for runtime use.",
    category: "Applications",
    path: "/core/apps/installed",
    source: "Hekatoncheiros",
    actionLabel: "Open installed applications",
    requiredPrivilege: "platform.apps.manage",
    steps: [
      "Start the application and expose /.well-known/hc-app-manifest.json.",
      "For a local HTTP origin, add it under Platform configuration / Trusted origins.",
      "Enter the application base URL under Apps / Installed apps.",
      "Let Core fetch the manifest and complete the installation.",
    ],
  },
  {
    title: "Activate a license for a tenant",
    summary: "Use this procedure for an installed application that requires a valid license.",
    outcome: "The tenant has an active selected license and the application is unlocked in runtime navigation.",
    category: "Licensing",
    path: "/core/apps/licensing",
    source: "Hekatoncheiros",
    actionLabel: "Open licensing",
    steps: [
      "Open Apps / Tenant licensing.",
      "Select the application that requires a license.",
      "Start activation through the application's issuer or enter the obtained license material.",
      "Select the new license as active for the current tenant.",
    ],
  },
  {
    title: "Allow a local HTTP origin for development",
    summary: "Use this procedure when installation fails because base_url is required to use HTTPS.",
    outcome: "Core allows the local origin for manifests and artifacts without disabling checks for public sources.",
    category: "Platform",
    path: "/core/platform/trusted-origins",
    source: "Hekatoncheiros",
    actionLabel: "Open trusted origins",
    requiredPrivilege: "platform.superadmin",
    steps: [
      "Open Platform configuration / Trusted origins.",
      "Add the running application's origin, for example http://inventory:4010.",
      "Save the change.",
      "Return to Apps and fetch the manifest or run the installation again.",
    ],
  },
  {
    title: "Update an installed application's UI artifact",
    summary: "Use this procedure when an application changes and Core should download a new manifest or plugin artifact.",
    outcome: "Core stores the current manifest and new UI plugin without manually reinstalling the application.",
    category: "Applications",
    path: "/core/apps/installed",
    source: "Hekatoncheiros",
    actionLabel: "Open installed applications",
    requiredPrivilege: "platform.apps.manage",
    steps: [
      "Rebuild and start the application.",
      "Open Apps / Installed apps.",
      "Find the application and select Refresh artifact.",
      "Open the application runtime and verify the new UI version.",
    ],
  },
  {
    title: "Report an available application update",
    summary: "Use this procedure when a running application needs to notify Core about a newer manifest or UI artifact.",
    outcome: "Core stores the update signal so an administrator can review it and decide whether to refresh the artifact.",
    category: "Applications",
    path: "/core/apps/installed",
    source: "Hekatoncheiros",
    actionLabel: "Open installed applications",
    requiredPrivilege: "platform.apps.manage",
    steps: [
      "Open Apps / Installed apps.",
      "Find the installed application and select Issue token.",
      "Provide the short-lived app token to the running application or development script.",
      "Call POST /api/v1/apps/installed/update-signal from the application with the Bearer token.",
      "Verify that an update signal appears for the application under Apps / Installed apps.",
      "After review, use Refresh artifact or remove the signal with Clear signal.",
    ],
  },
  {
    title: "Publish an application in the instance feed",
    summary: "Use this procedure to make an installed application available to other instances.",
    outcome: "The application appears in the instance's public feed according to approval and trust policies.",
    category: "Distribution",
    path: "/core/apps/feeds",
    source: "Hekatoncheiros",
    actionLabel: "Open feeds",
    requiredPrivilege: "platform.apps.manage",
    steps: [
      "Verify that the application is installed and its manifest identifies the correct author and license.",
      "Open Apps / Feed sources and the distribution section.",
      "Select the application to include in the feed.",
      "Complete the approval step if the application was not added by an administrator.",
    ],
  },
  {
    title: "Grant tenant privileges to a user",
    summary: "Use this procedure to let a user access or manage part of a tenant instance.",
    outcome: "The user receives the appropriate tenant role or privilege and sees the permitted features after reloading their session.",
    category: "Users",
    path: "/core/tenant/users",
    source: "Hekatoncheiros",
    actionLabel: "Open users",
    requiredPrivilege: "tenant.config.manage",
    steps: [
      "Open Tenant configuration / Users & roles.",
      "Find the user in the list.",
      "Add a tenant role or a specific privilege.",
      "Save the changes and ask the user to refresh their session.",
    ],
  },
];

export function getVisiblePlatformHelpGuides(privileges: string[]) {
  return platformHelpGuides.filter((item) => !item.requiredPrivilege || hasPrivilege(privileges, item.requiredPrivilege));
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
