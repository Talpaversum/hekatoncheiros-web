import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAccountQuery, useChangePasswordMutation, useUpdateAccountMutation } from "../../data/api/account";
import { useContextQuery } from "../../data/api/context";
import { readErrorMessage } from "../../data/api/read-error-message";
import { clearTokens } from "../../data/auth/storage";
import { Button } from "../../ui-kit/components/Button";
import { Card } from "../../ui-kit/components/Card";
import { Input } from "../../ui-kit/components/Input";
import { Field, MetricStrip, PageHeader, SectionHeader, StatusBadge } from "../../ui-kit/components/Page";
import { ToastNotice } from "../../ui-kit/components/ToastNotice";

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
    <div className="space-y-4">
      <PageHeader
        eyebrow="Account"
        title={isSecurity ? "Security" : "User profile"}
        description="Current session, identity fields, and password controls."
        actions={<Button variant="outlined" onClick={handleLogout}>Sign out</Button>}
      />

      <ToastNotice message={error ?? message} tone={error ? "danger" : "success"} onDismiss={resetNotices} />

      {!isSecurity && (
        <>
          <MetricStrip items={[
            { label: "Account", value: account?.status ?? "-", tone: account?.status === "active" ? "success" : "neutral" },
            { label: "Tenant mode", value: context?.tenant.mode ?? "-" },
            { label: "Privileges", value: privileges.length },
            { label: "Delegation", value: context?.actor.impersonating ? "On" : "Off", tone: context?.actor.impersonating ? "warning" : "neutral" },
          ]} />

          <Card className="overflow-hidden p-0">
            <SectionHeader title="Profile fields" description={`${account?.id ?? "Loading..."} · ${context?.tenant.name ?? context?.tenant.id ?? "No tenant"}`} meta={<StatusBadge>{account?.status ?? "-"}</StatusBadge>} />
            <div className="grid gap-3 border-t border-hc-outline p-4 md:grid-cols-2">
              <Field label="Display name">
                <Input value={effectiveDisplayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Jane Admin" />
              </Field>
              <Field label="Email">
                <Input value={effectiveEmail} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" />
              </Field>
            </div>
            <div className="flex justify-end border-t border-hc-outline px-4 py-3">
              <Button onClick={() => void handleSaveProfile()} disabled={!effectiveEmail.trim() || updateAccount.isPending}>
                Save profile
              </Button>
            </div>
          </Card>

          <Card className="overflow-hidden p-0">
            <SectionHeader title="Privileges" description="Effective privilege entries in this session." meta={<StatusBadge>{privileges.length} assigned</StatusBadge>} />
            <div className="flex flex-wrap gap-1.5 border-t border-hc-outline p-3">
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
        <Card className="overflow-hidden p-0">
          <SectionHeader title="Change password" description="Use at least eight characters for the new password." />
          <div className="grid gap-3 border-t border-hc-outline p-4 md:grid-cols-2">
            <Field label="Current password">
              <Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
            </Field>
            <Field label="New password">
              <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            </Field>
          </div>
          <div className="flex justify-end border-t border-hc-outline px-4 py-3">
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
