import { useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { hasPrivilege } from "../../access/privileges";
import { getHelpCategoryPath, getVisiblePlatformHelpGuides } from "../../core-console/pages/help-guides";
import { useUpdateAccountMutation } from "../../data/api/account";
import { useAppRegistryQuery } from "../../data/api/app-registry";
import { clearTokens } from "../../data/auth/storage";
import { useLocalization } from "../../localization/LocalizationProvider";
import { localeOptions, type Locale } from "../../localization/resources";
import { Avatar } from "../components/Avatar";
import { IconButton } from "../components/IconButton";
import { Menu } from "../components/Menu";
import { Select } from "../components/Select";
import { Switch } from "../components/Switch";
import { useTheme } from "../theme/useTheme";

type AppTopBarProps = {
  userId?: string;
  displayName?: string;
  privileges?: string[];
  tenantMode?: string;
};

export function AppTopBar({ userId, displayName, privileges = [], tenantMode }: AppTopBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggle } = useTheme();
  const { locale, setLocale, t } = useLocalization();
  const updateAccount = useUpdateAccountMutation();
  const { data: registry, isLoading: registryLoading } = useAppRegistryQuery(true);
  const [appsOpen, setAppsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [languageError, setLanguageError] = useState(false);

  const initials = useMemo(() => {
    const source = displayName || userId;
    if (!source) return "U";
    return source
      .split(/[^a-zA-Z0-9]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }, [displayName, userId]);

  const handleLogout = () => {
    clearTokens();
    navigate("/login");
  };

  const handleLocaleChange = async (next: Locale) => {
    const previous = locale;
    setLanguageError(false);
    setLocale(next);
    try {
      await updateAccount.mutateAsync({ preferred_locale: next });
    } catch {
      setLocale(previous);
      setLanguageError(true);
    }
  };

  const openAccount = () => {
    setUserOpen(false);
    navigate("/core/account");
  };

  const openPlatformConfig = () => {
    setSettingsOpen(false);
    navigate("/core/platform");
  };

  const openTenantConfig = () => {
    setSettingsOpen(false);
    navigate("/core/tenant");
  };

  const appGroups = useMemo(() => registry?.items ?? [], [registry?.items]);
  const helpCategories = useMemo(() => {
    const platformCategories = getVisiblePlatformHelpGuides(privileges).map((guide) => guide.category);
    const appCategories = appGroups.flatMap((app) => (app.help_entries ?? []).map((entry) => entry.category ?? "Applications"));
    return Array.from(new Set([...platformCategories, ...appCategories])).sort((a, b) => a.localeCompare(b));
  }, [appGroups, privileges]);

  return (
    <header className="sticky top-0 z-40 border-b border-hc-outline bg-hc-topbar">
      <div className="flex h-14 items-center justify-between gap-3 px-4 lg:px-5">
        <div className="flex min-w-0 items-center gap-3 lg:gap-5">
          <div className="hidden text-base font-semibold lg:block">Hekatoncheiros</div>
          <nav className="flex min-w-0 items-center gap-1 overflow-visible text-sm">
            <NavLink
              to="/core/dashboard"
              className={({ isActive }) =>
                `hidden rounded-hc-sm px-3 py-2 transition sm:block ${
                  isActive ? "bg-hc-surface text-hc-text" : "text-hc-muted hover:text-hc-text"
                }`
              }
            >
              {t("nav.dashboard")}
            </NavLink>
            <div className="relative">
              <button
                onClick={() => {
                  setHelpOpen(false);
                  setAppsOpen((prev) => !prev);
                }}
                className="rounded-hc-sm px-3 py-2 text-hc-muted transition hover:text-hc-text"
                aria-expanded={appsOpen}
              >
                {t("nav.apps")} ▾
              </button>
              <Menu
                open={appsOpen}
                onClose={() => setAppsOpen(false)}
                className="left-0 right-auto w-80 max-w-[calc(100vw-2rem)]"
              >
                <NavLink
                  to="/core/apps"
                  onClick={() => setAppsOpen(false)}
                  className="block rounded-hc-sm px-3 py-2 text-sm text-hc-text hover:bg-hc-surface-variant"
                >
                  {t("nav.manageApps")}
                </NavLink>
                {appGroups.length > 0 && <div className="my-2 border-t border-hc-outline" />}

                <div className="max-h-[24rem] overflow-auto pr-1">
                  {registryLoading && <div className="rounded-hc-sm px-3 py-2 text-xs text-hc-muted">{t("common.loadingApps")}</div>}
                  {!registryLoading && appGroups.length === 0 && (
                    <div className="rounded-hc-sm px-3 py-2 text-xs text-hc-muted">{t("common.noApps")}</div>
                  )}

                  {appGroups.map((app) => (
                    <NavLink
                      key={app.slug}
                      to={`/app/${app.slug}`}
                      onClick={() => setAppsOpen(false)}
                      className="block rounded-hc-sm px-3 py-2 text-sm text-hc-text hover:bg-hc-surface-variant"
                    >
                      {app.app_name ?? app.slug}
                    </NavLink>
                  ))}
                </div>
              </Menu>
            </div>
            <NavLink
              to="/core/licensing"
              className={({ isActive }) =>
                `rounded-hc-sm px-3 py-2 transition ${
                  isActive ? "bg-hc-surface text-hc-text" : "text-hc-muted hover:text-hc-text"
                }`
              }
            >
              {t("nav.licensing")}
            </NavLink>
            <div className="relative">
              <button
                onClick={() => {
                  setAppsOpen(false);
                  setHelpOpen((prev) => !prev);
                }}
                className={`rounded-hc-sm px-3 py-2 transition ${
                  location.pathname.startsWith("/core/help")
                    ? "bg-hc-surface text-hc-text"
                    : "text-hc-muted hover:text-hc-text"
                }`}
                aria-expanded={helpOpen}
              >
                {t("nav.help")} ▾
              </button>
              <Menu
                open={helpOpen}
                onClose={() => setHelpOpen(false)}
                className="!-right-16 w-72 max-w-[calc(100vw-2rem)] sm:!right-0"
              >
                <NavLink
                  to="/core/help"
                  onClick={() => setHelpOpen(false)}
                  className="block rounded-hc-sm px-3 py-2 text-sm text-hc-text hover:bg-hc-surface-variant"
                >
                  {t("nav.allGuides")}
                </NavLink>
                {helpCategories.length > 0 && <div className="my-2 border-t border-hc-outline" />}
                <div className="max-h-[24rem] overflow-auto pr-1">
                  {helpCategories.map((category) => (
                    <NavLink
                      key={category}
                      to={getHelpCategoryPath(category)}
                      onClick={() => setHelpOpen(false)}
                      className="block rounded-hc-sm px-3 py-2 text-sm text-hc-text hover:bg-hc-surface-variant"
                    >
                      {category}
                    </NavLink>
                  ))}
                </div>
              </Menu>
            </div>
          </nav>
        </div>

        <div className="relative flex shrink-0 items-center gap-2">
          <div className="relative">
            <IconButton aria-label={t("common.settings")} onClick={() => setSettingsOpen((prev) => !prev)}>
              ⚙
            </IconButton>
            <Menu open={settingsOpen} onClose={() => setSettingsOpen(false)} className="w-64">
              {hasPrivilege(privileges, "platform.superadmin") && (
                <button
                  onClick={openPlatformConfig}
                  className="w-full rounded-hc-sm px-3 py-2 text-left text-sm text-hc-text hover:bg-hc-surface-variant"
                >
                  {t("settings.platform")}
                </button>
              )}
              {hasPrivilege(privileges, "tenant.config.manage") && (
                <button
                  onClick={openTenantConfig}
                  className="w-full rounded-hc-sm px-3 py-2 text-left text-sm text-hc-text hover:bg-hc-surface-variant"
                >
                  {t("settings.tenant")}
                </button>
              )}
              <div className="flex items-center justify-between rounded-hc-sm px-3 py-2">
                <div>
                  <div className="text-sm font-medium">{t("settings.darkMode")}</div>
                  <div className="text-xs text-hc-muted">{t("settings.switchAppearance")}</div>
                </div>
                <Switch checked={isDark} onClick={toggle} />
              </div>
              <div className="border-t border-hc-outline px-3 py-2">
                <label className="text-xs font-medium text-hc-muted" htmlFor="topbar-language">{t("settings.language")}</label>
                <Select
                  id="topbar-language"
                  className="mt-1"
                  value={locale}
                  disabled={updateAccount.isPending}
                  onChange={(event) => void handleLocaleChange(event.target.value as Locale)}
                >
                  {localeOptions.map((option) => <option key={option.value} value={option.value}>{option.label} ({option.value.toUpperCase()})</option>)}
                </Select>
                {updateAccount.isPending && <div className="mt-1 text-xs text-hc-muted">{t("settings.languageSaving")}</div>}
                {languageError && <div className="mt-1 text-xs text-hc-danger">{t("settings.languageError")}</div>}
              </div>
              <div className="mt-2 rounded-hc-sm px-3 py-2 text-xs text-hc-muted">
                {t("settings.tenantMode", { mode: tenantMode ?? "unknown" })}
              </div>
            </Menu>
          </div>
          <div className="relative">
            <button
              onClick={() => setUserOpen((prev) => !prev)}
              className="rounded-full"
              aria-expanded={userOpen}
            >
              <Avatar initials={initials} title={userId ?? "Profil"} />
            </button>
            <Menu open={userOpen} onClose={() => setUserOpen(false)} className="w-56">
              <div className="px-3 py-2">
                <div className="text-sm font-medium">{displayName ?? userId ?? t("common.user")}</div>
                <div className="text-xs text-hc-muted">Session account</div>
              </div>
              <button
                onClick={openAccount}
                className="w-full rounded-hc-sm px-3 py-2 text-left text-sm text-hc-text hover:bg-hc-surface-variant"
              >
                Account context
              </button>
              <button
                onClick={handleLogout}
                className="w-full rounded-hc-sm px-3 py-2 text-left text-sm text-hc-text hover:bg-hc-surface-variant"
              >
                {t("common.signOut")}
              </button>
            </Menu>
          </div>
        </div>
      </div>
    </header>
  );
}
