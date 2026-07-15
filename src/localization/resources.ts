export const locales = ["en", "cs", "sk", "de", "fr", "es"] as const;
export type Locale = (typeof locales)[number];
export type Messages = Record<string, string>;

export const localeOptions: ReadonlyArray<{ value: Locale; label: string }> = [
  { value: "en", label: "English" },
  { value: "cs", label: "Čeština" },
  { value: "sk", label: "Slovenčina" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
];

export function getLocaleLabel(locale: string) {
  return localeOptions.find((option) => option.value === locale)?.label ?? locale.toUpperCase();
}

const en: Messages = {
  "nav.dashboard": "Dashboard", "nav.apps": "Apps", "nav.licensing": "Licensing", "nav.help": "Help",
  "nav.manageApps": "Manage apps", "nav.allGuides": "All guides", "nav.account": "Account",
  "nav.security": "Security", "nav.session": "Session", "nav.overview": "Overview",
  "nav.catalog": "Catalog", "nav.feedSources": "Feed sources", "nav.installedApps": "Installed apps",
  "common.loadingApps": "Loading applications...", "common.noApps": "No applications are available.",
  "common.signOut": "Sign out", "common.settings": "Settings", "common.user": "User",
  "settings.platform": "Platform configuration", "settings.tenant": "Tenant configuration",
  "settings.darkMode": "Dark mode", "settings.switchAppearance": "Switch appearance",
  "settings.language": "Display language", "settings.languageSaving": "Saving language...",
  "settings.languageError": "Language could not be saved.",
  "settings.tenantMode": "Tenant mode: {{mode}}", "account.profile": "User profile",
  "account.description": "Current session, identity fields, language, and password controls.",
  "account.displayName": "Display name", "account.email": "Email", "account.language": "Display language",
  "account.save": "Save profile", "account.updated": "Account profile was updated.",
  "account.password": "Change password", "account.currentPassword": "Current password",
  "account.newPassword": "New password", "account.passwordChanged": "Password was changed.",
  "runtime.missingSlug": "Missing app slug in route.", "runtime.loading": "Loading app runtime...",
  "runtime.notFound": "No registry entry exists for app slug {{slug}}.",
  "runtime.noRoutes": "The plugin does not define any routes.", "shell.impersonation": "Impersonation active",
};

const cs: Messages = {
  "nav.dashboard": "Přehled", "nav.apps": "Aplikace", "nav.licensing": "Licencování", "nav.help": "Nápověda",
  "nav.manageApps": "Správa aplikací", "nav.allGuides": "Všechny návody", "nav.account": "Účet",
  "nav.security": "Zabezpečení", "nav.session": "Relace", "nav.overview": "Přehled",
  "nav.catalog": "Katalog", "nav.feedSources": "Zdroje feedů", "nav.installedApps": "Nainstalované aplikace",
  "common.loadingApps": "Načítání aplikací...", "common.noApps": "Nejsou dostupné žádné aplikace.",
  "common.signOut": "Odhlásit se", "common.settings": "Nastavení", "common.user": "Uživatel",
  "settings.platform": "Nastavení platformy", "settings.tenant": "Nastavení tenantu",
  "settings.darkMode": "Tmavý režim", "settings.switchAppearance": "Přepnout vzhled",
  "settings.language": "Jazyk zobrazení", "settings.languageSaving": "Ukládání jazyka...",
  "settings.languageError": "Jazyk se nepodařilo uložit.",
  "settings.tenantMode": "Režim tenantu: {{mode}}", "account.profile": "Profil uživatele",
  "account.description": "Aktuální relace, identita, jazyk a nastavení hesla.",
  "account.displayName": "Zobrazované jméno", "account.email": "E-mail", "account.language": "Jazyk zobrazení",
  "account.save": "Uložit profil", "account.updated": "Profil účtu byl aktualizován.",
  "account.password": "Změnit heslo", "account.currentPassword": "Aktuální heslo",
  "account.newPassword": "Nové heslo", "account.passwordChanged": "Heslo bylo změněno.",
  "runtime.missingSlug": "V adrese chybí slug aplikace.", "runtime.loading": "Načítání aplikace...",
  "runtime.notFound": "Pro aplikaci {{slug}} neexistuje záznam.", "runtime.noRoutes": "Plugin nedefinuje žádné routy.",
  "shell.impersonation": "Impersonace je aktivní",
};

const variants = {
  sk: { "nav.dashboard": "Prehľad", "nav.apps": "Aplikácie", "nav.help": "Pomoc", "common.signOut": "Odhlásiť sa", "account.language": "Jazyk zobrazenia", "account.save": "Uložiť profil" },
  de: { "nav.dashboard": "Übersicht", "nav.apps": "Anwendungen", "nav.help": "Hilfe", "common.signOut": "Abmelden", "account.language": "Anzeigesprache", "account.save": "Profil speichern" },
  fr: { "nav.dashboard": "Tableau de bord", "nav.apps": "Applications", "nav.help": "Aide", "common.signOut": "Se déconnecter", "account.language": "Langue d’affichage", "account.save": "Enregistrer le profil" },
  es: { "nav.dashboard": "Panel", "nav.apps": "Aplicaciones", "nav.help": "Ayuda", "common.signOut": "Cerrar sesión", "account.language": "Idioma de visualización", "account.save": "Guardar perfil" },
} satisfies Record<Exclude<Locale, "en" | "cs">, Record<string, string>>;

export const resources: Record<Locale, Messages> = {
  en,
  cs,
  sk: { ...en, ...variants.sk },
  de: { ...en, ...variants.de },
  fr: { ...en, ...variants.fr },
  es: { ...en, ...variants.es },
};
