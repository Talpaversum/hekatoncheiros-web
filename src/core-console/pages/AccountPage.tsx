import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAccountQuery, useChangePasswordMutation, useUpdateAccountMutation } from "../../data/api/account";
import { useContextQuery } from "../../data/api/context";
import { readErrorMessage } from "../../data/api/read-error-message";
import { clearTokens } from "../../data/auth/storage";
import { Button } from "../../ui-kit/components/Button";
import { Card } from "../../ui-kit/components/Card";
import { Input } from "../../ui-kit/components/Input";

function formatPrivilege(value: string) {
  return value.replaceAll(".", " / ");
}

export function AccountPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: context } = useContextQuery(true);
  const { data: account } = useAccountQuery(true);
  const updateAccount = useUpdateAccountMutation();
  const changePassword = useChangePasswordMutation();

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSecurity = location.pathname.endsWith("/security");
  const privileges = context?.privileges ?? [];
  const effectiveDisplayName = displayName ?? account?.display_name ?? "";
  const effectiveEmail = email ?? account?.email ?? "";

  const resetNotices = () => {
    setMessage(null);
    setError(null);
  };

  const handleLogout = () => {
    clearTokens();
    navigate("/login");
  };

  const handleSaveProfile = async () => {
    resetNotices();
    try {
      await updateAccount.mutateAsync({
        display_name: effectiveDisplayName.trim() || null,
        email: effectiveEmail.trim(),
      });
      setDisplayName(null);
      setEmail(null);
      setMessage("Account profile was updated.");
    } catch (err) {
      setError(readErrorMessage(err));
    }
  };

  const handleChangePassword = async () => {
    resetNotices();
    try {
      await changePassword.mutateAsync({ current_password: currentPassword, new_password: newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setMessage("Password was changed.");
    } catch (err) {
      setError(readErrorMessage(err));
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-hc-muted">Account</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal">{isSecurity ? "Security" : "User profile"}</h1>
          <p className="mt-1 text-sm text-hc-muted">Current session, identity fields, and password controls.</p>
        </div>
        <Button variant="outlined" onClick={handleLogout}>
          Sign out
        </Button>
      </header>

      {message && <div className="rounded-hc-md border border-hc-success/25 bg-hc-success/10 px-4 py-3 text-sm text-hc-success">{message}</div>}
      {error && <div className="rounded-hc-md border border-hc-danger/30 bg-hc-danger/10 px-4 py-3 text-sm text-hc-danger">{error}</div>}

      {!isSecurity && (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="rounded-hc-md">
              <div className="text-sm font-semibold">Actor</div>
              <div className="mt-3 text-2xl font-semibold">{account?.id ?? "Loading..."}</div>
              <div className="mt-2 text-xs text-hc-muted">Status: {account?.status ?? "-"}</div>
            </Card>
            <Card className="rounded-hc-md">
              <div className="text-sm font-semibold">Tenant</div>
              <div className="mt-3 text-2xl font-semibold">{context?.tenant.name ?? context?.tenant.id ?? "-"}</div>
              <div className="mt-2 text-xs text-hc-muted">Mode: {context?.tenant.mode ?? "-"}</div>
            </Card>
            <Card className="rounded-hc-md">
              <div className="text-sm font-semibold">Delegation</div>
              <div className="mt-3 text-2xl font-semibold">{context?.actor.impersonating ? "Active" : "Off"}</div>
              <div className="mt-2 text-xs text-hc-muted">Effective user: {context?.actor.effective_user_id ?? "-"}</div>
            </Card>
          </div>

          <Card className="rounded-hc-md">
            <div className="text-sm font-semibold">Profile fields</div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-hc-muted">Display name</label>
                <Input value={effectiveDisplayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Jane Admin" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-hc-muted">Email</label>
                <Input value={effectiveEmail} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={() => void handleSaveProfile()} disabled={!effectiveEmail.trim() || updateAccount.isPending}>
                Save profile
              </Button>
            </div>
          </Card>

          <Card className="rounded-hc-md">
            <div className="text-sm font-semibold">Privileges</div>
            <div className="mt-1 text-xs text-hc-muted">{privileges.length} privilege entries in this session.</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {privileges.map((privilege) => (
                <span key={privilege} className="rounded-hc-sm border border-hc-outline bg-hc-surface-variant px-2 py-1 text-xs">
                  {formatPrivilege(privilege)}
                </span>
              ))}
            </div>
          </Card>
        </>
      )}

      {isSecurity && (
        <Card className="rounded-hc-md">
          <div className="text-sm font-semibold">Change password</div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-hc-muted">Current password</label>
              <Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-hc-muted">New password</label>
              <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => void handleChangePassword()}
              disabled={currentPassword.length === 0 || newPassword.length < 8 || changePassword.isPending}
            >
              Change password
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
