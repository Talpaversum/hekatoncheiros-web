import { useState } from "react";

import { authFetch } from "../../data/auth/auth-fetch";
import { getAccessToken } from "../../data/auth/storage";
import { Button } from "../../ui-kit/components/Button";
import { Card } from "../../ui-kit/components/Card";

export function AppsPage() {
  const [message, setMessage] = useState<string | null>(null);
  const token = getAccessToken();

  const handleToggle = async (action: "enable" | "disable") => {
    setMessage(null);
    await authFetch(`/tenants/apps/app_inventory/${action}`, { method: "POST" });
    setMessage(action === "enable" ? "Aplikace povolena" : "Aplikace zakázána");
  };

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-wide text-hc-muted">Apps</div>
        <div className="mt-1 text-2xl font-semibold">Registry</div>
        <div className="mt-1 text-sm text-hc-muted">Registry & tenant enablement</div>
      </div>
      <Card>
        <div className="flex flex-col gap-4">
          <div className="text-sm text-hc-muted">app_inventory (MVP)</div>
          <div className="flex gap-2">
            <Button onClick={() => handleToggle("enable")} disabled={!token}>
              Enable
            </Button>
            <Button variant="outlined" onClick={() => handleToggle("disable")} disabled={!token}>
              Disable
            </Button>
          </div>
          {!token && <div className="text-sm text-hc-muted">Chybí access token, přihlas se znovu.</div>}
          {message && <div className="text-sm text-hc-primary">{message}</div>}
        </div>
      </Card>
    </div>
  );
}
