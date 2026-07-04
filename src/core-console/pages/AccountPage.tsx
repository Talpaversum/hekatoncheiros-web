import { useNavigate } from "react-router-dom";

import { useContextQuery } from "../../data/api/context";
import { clearTokens } from "../../data/auth/storage";
import { Button } from "../../ui-kit/components/Button";
import { Card } from "../../ui-kit/components/Card";

function formatPrivilege(value: string) {
  return value.replaceAll(".", " / ");
}

export function AccountPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useContextQuery(true);
  const privileges = data?.privileges ?? [];

  const handleLogout = () => {
    clearTokens();
    navigate("/login");
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-hc-muted">Account</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal">User context</h1>
          <p className="mt-1 text-sm text-hc-muted">Current session, tenant scope, and effective privileges.</p>
        </div>
        <Button variant="outlined" onClick={handleLogout}>
          Sign out
        </Button>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-hc-md">
          <div className="text-sm font-semibold">Actor</div>
          <div className="mt-3 text-2xl font-semibold">{data?.actor.user_id ?? (isLoading ? "Loading..." : "Unknown")}</div>
          <div className="mt-2 text-xs text-hc-muted">
            Effective user: {data?.actor.effective_user_id ?? "-"}
          </div>
        </Card>

        <Card className="rounded-hc-md">
          <div className="text-sm font-semibold">Tenant</div>
          <div className="mt-3 text-2xl font-semibold">{data?.tenant.id ?? "-"}</div>
          <div className="mt-2 text-xs text-hc-muted">Mode: {data?.tenant.mode ?? "-"}</div>
        </Card>

        <Card className="rounded-hc-md">
          <div className="text-sm font-semibold">Delegation</div>
          <div className="mt-3 text-2xl font-semibold">{data?.actor.impersonating ? "Active" : "Off"}</div>
          <div className="mt-2 text-xs text-hc-muted">Impersonation and delegation context.</div>
        </Card>
      </div>

      <Card id="privileges" className="rounded-hc-md">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Privileges</div>
            <div className="mt-1 text-xs text-hc-muted">{privileges.length} privilege entries in this session.</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {privileges.map((privilege) => (
            <span key={privilege} className="rounded-hc-sm border border-hc-outline bg-hc-surface-variant px-2 py-1 text-xs">
              {formatPrivilege(privilege)}
            </span>
          ))}
          {privileges.length === 0 && <span className="text-sm text-hc-muted">No privileges loaded.</span>}
        </div>
      </Card>
    </div>
  );
}
