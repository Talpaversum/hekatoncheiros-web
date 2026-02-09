import { useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { hasPrivilege } from "../../access/privileges";
import { useAppRegistryQuery } from "../../data/api/app-registry";
import { clearTokens } from "../../data/auth/storage";
import { Avatar } from "../components/Avatar";
import { IconButton } from "../components/IconButton";
import { Menu } from "../components/Menu";
import { Switch } from "../components/Switch";
import { useTheme } from "../theme/useTheme";

type AppTopBarProps = {
  userId?: string;
  privileges?: string[];
  tenantMode?: string;
};

export function AppTopBar({ userId, privileges = [], tenantMode }: AppTopBarProps) {
  const navigate = useNavigate();
  const { isDark, toggle } = useTheme();
  const { data: registry, isLoading: registryLoading } = useAppRegistryQuery(true);
  const [appsOpen, setAppsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  const initials = useMemo(() => {
    if (!userId) return "U";
    return userId
      .split(/[^a-zA-Z0-9]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }, [userId]);

  const handleLogout = () => {
    clearTokens();
    navigate("/login");
  };

  const openPlatformConfig = () => {
    setSettingsOpen(false);
    navigate("/core/platform");
  };

  const openTenantConfig = () => {
    setSettingsOpen(false);
    navigate("/core/tenant");
  };

  const appGroups = registry?.items ?? [];

  return (
    <header className="sticky top-0 z-40 bg-hc-topbar shadow-hc-topbar">
      <div className="absolute inset-0 bg-gradient-to-b from-hc-topbar-glow via-transparent to-hc-topbar-depth opacity-70" />
      <div className="flex h-16 items-center justify-between px-6">
        <div className="relative flex items-center gap-6">
          <div className="text-lg font-semibold">Hekatoncheiros</div>
          <nav className="flex items-center gap-3 text-sm">
            <NavLink
              to="/core/dashboard"
              className={({ isActive }) =>
                `rounded-hc-sm px-3 py-2 transition ${
                  isActive ? "bg-hc-surface text-hc-text" : "text-hc-muted hover:text-hc-text"
                }`
              }
            >
              Dashboard
            </NavLink>
            <div className="relative">
              <button
                onClick={() => setAppsOpen((prev) => !prev)}
                className="rounded-hc-sm px-3 py-2 text-hc-muted transition hover:text-hc-text"
                aria-expanded={appsOpen}
              >
                Apps ▾
              </button>
              <Menu open={appsOpen} onClose={() => setAppsOpen(false)} className="w-80">
                <NavLink
                  to="/admin/apps"
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
          </nav>
        </div>

        <div className="relative flex items-center gap-3">
          <IconButton aria-label="Messaging">
            💬
          </IconButton>
          <div className="relative">
            <IconButton aria-label="Settings" onClick={() => setSettingsOpen((prev) => !prev)}>
              ⚙️
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
                <div className="text-sm font-medium">{userId ?? "Uživatel"}</div>
                <div className="text-xs text-hc-muted">Profil & účet</div>
              </div>
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
