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
    title: "Nainstalovat aplikaci z katalogu",
    summary: "Postup pro situaci, kdy je aplikace dostupná v katalogu a chceš ji přidat do instance.",
    outcome: "Aplikace bude nainstalovaná a zobrazí se uživatelům, kteří mají potřebná oprávnění a licenci.",
    category: "Aplikace",
    path: "/core/apps",
    source: "Hekatoncheiros",
    actionLabel: "Otevřít katalog",
    requiredPrivilege: "platform.apps.manage",
    steps: [
      "Otevři Apps a zůstaň na záložce Catalog.",
      "Zkontroluj stav licence a původ aplikace.",
      "Klikni na Install a potvrď plán instalace.",
      "Po instalaci ověř aplikaci v záložce Installed apps.",
    ],
  },
  {
    title: "Přidat lokální vývojovou aplikaci",
    summary: "Postup pro vývojáře nebo admina, který má běžící aplikaci mimo katalog a chce ji připojit přes manifest.",
    outcome: "Core stáhne manifest, ověří původ a uloží UI artefakt pro runtime.",
    category: "Aplikace",
    path: "/core/apps/installed",
    source: "Hekatoncheiros",
    actionLabel: "Otevřít instalované aplikace",
    requiredPrivilege: "platform.apps.manage",
    steps: [
      "Spusť aplikaci tak, aby nabízela /.well-known/hc-app-manifest.json.",
      "Pokud používáš lokální HTTP origin, přidej jej do Platform configuration / Trusted origins.",
      "V Apps / Installed apps zadej base URL aplikace.",
      "Nech Core stáhnout manifest a dokonči instalaci.",
    ],
  },
  {
    title: "Aktivovat licenci pro tenant",
    summary: "Postup pro aplikaci, která je nainstalovaná, ale její použití vyžaduje platnou licenci.",
    outcome: "Tenant bude mít vybranou aktivní licenci a aplikace se odemkne v runtime navigaci.",
    category: "Licence",
    path: "/core/apps/licensing",
    source: "Hekatoncheiros",
    actionLabel: "Otevřít licence",
    steps: [
      "Otevři Apps / Tenant licensing.",
      "Vyber aplikaci, která vyžaduje licenci.",
      "Spusť aktivaci přes issuer dané aplikace nebo vlož získaný licenční materiál.",
      "Vyber novou licenci jako aktivní pro aktuální tenant.",
    ],
  },
  {
    title: "Zpřístupnit lokální HTTP origin pro vývoj",
    summary: "Postup pro případ, kdy instalace skončí chybou, že base_url musí používat HTTPS.",
    outcome: "Core dovolí daný lokální origin pro manifest a artefakt, aniž by se vypínala kontrola pro veřejné zdroje.",
    category: "Platforma",
    path: "/core/platform/trusted-origins",
    source: "Hekatoncheiros",
    actionLabel: "Otevřít trusted origins",
    requiredPrivilege: "platform.superadmin",
    steps: [
      "Otevři Platform configuration / Trusted origins.",
      "Přidej origin běžící aplikace, například http://inventory:4010.",
      "Ulož změnu.",
      "Vrať se do Apps a zopakuj fetch manifestu nebo instalaci.",
    ],
  },
  {
    title: "Aktualizovat UI artefakt nainstalované aplikace",
    summary: "Postup pro chvíli, kdy se aplikace změnila a Core má stáhnout nový manifest nebo plugin artefakt.",
    outcome: "Core uloží aktuální manifest a nový UI plugin bez ruční reinstalace aplikace.",
    category: "Aplikace",
    path: "/core/apps/installed",
    source: "Hekatoncheiros",
    actionLabel: "Otevřít instalované aplikace",
    requiredPrivilege: "platform.apps.manage",
    steps: [
      "Nejdřív přestav a spusť konkrétní aplikaci.",
      "Otevři Apps / Installed apps.",
      "Najdi aplikaci a klikni na Refresh artifact.",
      "Po dokončení otevři runtime aplikace a ověř novou verzi UI.",
    ],
  },
  {
    title: "Publikovat aplikaci do feedu instance",
    summary: "Postup pro admina, který chce vybrat nainstalovanou aplikaci a nabídnout ji ostatním instancím.",
    outcome: "Aplikace se objeví ve veřejném feedu instance podle pravidel schválení a důvěryhodnosti.",
    category: "Distribuce",
    path: "/core/apps/feeds",
    source: "Hekatoncheiros",
    actionLabel: "Otevřít feedy",
    requiredPrivilege: "platform.apps.manage",
    steps: [
      "Ověř, že aplikace je nainstalovaná a manifest obsahuje správného autora a licenci.",
      "Otevři Apps / Feed sources a sekci distribuce.",
      "Vyber aplikaci, kterou chceš do feedu zahrnout.",
      "Pokud aplikaci nepřidal admin, projdi schvalovací krok.",
    ],
  },
  {
    title: "Přidat uživateli tenant oprávnění",
    summary: "Postup pro tenant admina, který chce uživateli umožnit používat nebo spravovat část instance.",
    outcome: "Uživatel získá odpovídající tenant roli nebo privilegium a po dalším načtení uvidí povolené funkce.",
    category: "Uživatelé",
    path: "/core/tenant/users",
    source: "Hekatoncheiros",
    actionLabel: "Otevřít uživatele",
    requiredPrivilege: "tenant.config.manage",
    steps: [
      "Otevři Tenant configuration / Users & roles.",
      "Najdi uživatele v seznamu.",
      "Přidej mu tenant roli nebo konkrétní privilegium.",
      "Ulož změny a nech uživatele obnovit session.",
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
