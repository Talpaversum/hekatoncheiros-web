import { useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { hasPrivilege } from "../../access/privileges";
import { getHelpCategoryPath, getVisiblePlatformHelpGuides } from "../../core-console/pages/help-guides";
import { useAppRegistryQuery } from "../../data/api/app-registry";
import { clearTokens } from "../../data/auth/storage";
import { Avatar } from "../components/Avatar";
import { IconButton } from "../components/IconButton";
import { Menu } from "../components/Menu";
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
  const { data: registry, isLoading: registryLoading } = useAppRegistryQuery(true);
  const [appsOpen, setAppsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

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
    const appCategories = appGroups.flatMap((app) => (app.help_entries ?? []).map((entry) => entry.category ?? "Aplikace"));
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
              Dashboard
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
                Apps ▾
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
                  Manage apps
                </NavLink>
                {appGroups.length > 0 && <div className="my-2 border-t border-hc-outline" />}

                <div className="max-h-[24rem] overflow-auto pr-1">
                  {registryLoading && <div className="rounded-hc-sm px-3 py-2 text-xs text-hc-muted">Načítám aplikace…</div>}
                  {!registryLoading && appGroups.length === 0 && (
                    <div className="rounded-hc-sm px-3 py-2 text-xs text-hc-muted">Žádné aplikace nejsou dostupné.</div>
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
              Licensing
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
                Help ▾
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
                  Všechny návody
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
            <IconButton aria-label="Settings" onClick={() => setSettingsOpen((prev) => !prev)}>
              ⚙
            </IconButton>
            <Menu open={settingsOpen} onClose={() => setSettingsOpen(false)} className="w-64">
              {hasPrivilege(privileges, "platform.superadmin") && (
                <button
                  onClick={openPlatformConfig}
                  className="w-full rounded-hc-sm px-3 py-2 text-left text-sm text-hc-text hover:bg-hc-surface-variant"
                >
                  Platform configuration
                </button>
              )}
              {hasPrivilege(privileges, "tenant.config.manage") && (
                <button
                  onClick={openTenantConfig}
                  className="w-full rounded-hc-sm px-3 py-2 text-left text-sm text-hc-text hover:bg-hc-surface-variant"
                >
                  Tenant configuration
                </button>
              )}
              <div className="flex items-center justify-between rounded-hc-sm px-3 py-2">
                <div>
                  <div className="text-sm font-medium">Tmavý režim</div>
                  <div className="text-xs text-hc-muted">Přepnout vzhled</div>
                </div>
                <Switch checked={isDark} onClick={toggle} />
              </div>
              <div className="mt-2 rounded-hc-sm px-3 py-2 text-xs text-hc-muted">
                Tenant mode: {tenantMode ?? "unknown"}
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
                <div className="text-sm font-medium">{displayName ?? userId ?? "Uživatel"}</div>
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
                Odhlásit
              </button>
            </Menu>
          </div>
        </div>
      </div>
    </header>
  );
}
