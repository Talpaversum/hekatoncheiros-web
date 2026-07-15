import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAccountQuery, useChangePasswordMutation, useUpdateAccountMutation } from "../../data/api/account";
import { registerCoreDashboardWidgets } from "../../dashboard/core-widgets";
import { useDashboardPreferences } from "../../dashboard/use-dashboard-preferences";
import { useApplicationDashboardWidgets } from "../../dashboard/use-application-widgets";
import { useContextQuery } from "../../data/api/context";
import { readErrorMessage } from "../../data/api/read-error-message";
import { clearTokens } from "../../data/auth/storage";
import { useLocalization } from "../../localization/LocalizationProvider";
import { localeOptions, type Locale } from "../../localization/resources";
import { Button } from "../../ui-kit/components/Button";
import { Card } from "../../ui-kit/components/Card";
import { Input } from "../../ui-kit/components/Input";
import { Select } from "../../ui-kit/components/Select";
import { Field, MetricStrip, PageHeader, SectionHeader, StatusBadge } from "../../ui-kit/components/Page";
import { ToastNotice } from "../../ui-kit/components/ToastNotice";

function formatPrivilege(value: string) {
  return value.replaceAll(".", " / ");
}

registerCoreDashboardWidgets();

export function AccountPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: context } = useContextQuery(true);
  const { data: account } = useAccountQuery(true);
  const updateAccount = useUpdateAccountMutation();
  const changePassword = useChangePasswordMutation();
  const { setLocale, t } = useLocalization();

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [preferredLocale, setPreferredLocale] = useState<Locale | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSecurity = location.pathname.endsWith("/security");
  const isSession = location.pathname.endsWith("/session");
  const isDashboard = location.pathname.endsWith("/dashboard");
  const privileges = context?.privileges ?? [];
  useApplicationDashboardWidgets(Boolean(context));
  const dashboard = useDashboardPreferences(privileges);
  const effectiveDisplayName = displayName ?? account?.display_name ?? "";
  const effectiveEmail = email ?? account?.email ?? "";
  const effectiveLocale = preferredLocale ?? account?.preferred_locale ?? "en";

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
        preferred_locale: effectiveLocale,
      });
      setDisplayName(null);
      setEmail(null);
      setPreferredLocale(null);
      setLocale(effectiveLocale);
      setMessage(t("account.updated"));
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
      setMessage(t("account.passwordChanged"));
    } catch (err) {
      setError(readErrorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={t("settings.user")}
        title={isSecurity ? t("nav.security") : isSession ? t("nav.session") : isDashboard ? t("nav.dashboardSettings") : t("nav.profile")}
        description={t("account.description")}
        actions={<Button variant="outlined" onClick={handleLogout}>{t("common.signOut")}</Button>}
      />

      <ToastNotice message={error ?? message} tone={error ? "danger" : "success"} onDismiss={resetNotices} />

      {!isSecurity && !isSession && !isDashboard && (
        <>
          <Card className="overflow-hidden p-0">
            <SectionHeader title={t("account.profileFields")} description={`${account?.id ?? t("common.loading")} · ${context?.tenant.name ?? context?.tenant.id ?? t("common.noTenant")}`} meta={<StatusBadge>{account?.status ?? "-"}</StatusBadge>} />
            <div className="grid gap-3 border-t border-hc-outline p-4 md:grid-cols-3">
              <Field label={t("account.displayName")}>
                <Input value={effectiveDisplayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Jane Admin" />
              </Field>
              <Field label={t("account.email")}>
                <Input value={effectiveEmail} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" />
              </Field>
              <Field label={t("account.language")}>
                <Select value={effectiveLocale} onChange={(event) => setPreferredLocale(event.target.value as Locale)}>
                  {localeOptions.map((option) => <option key={option.value} value={option.value}>{option.label} ({option.value.toUpperCase()})</option>)}
                </Select>
              </Field>
            </div>
            <div className="flex justify-end border-t border-hc-outline px-4 py-3">
              <Button onClick={() => void handleSaveProfile()} disabled={!effectiveEmail.trim() || updateAccount.isPending}>
                {t("account.save")}
              </Button>
            </div>
          </Card>

        </>
      )}

      {isSession && (
        <>
          <MetricStrip items={[
            { label: t("account.metricAccount"), value: account?.status ?? "-", tone: account?.status === "active" ? "success" : "neutral" },
            { label: t("account.metricTenantMode"), value: context?.tenant.mode ?? "-" },
            { label: t("account.metricPrivileges"), value: privileges.length },
            { label: t("account.metricDelegation"), value: context?.actor.impersonating ? t("common.on") : t("common.off"), tone: context?.actor.impersonating ? "warning" : "neutral" },
          ]} />
          <Card className="overflow-hidden p-0">
            <SectionHeader title={t("account.privilegesTitle")} description={t("account.privilegesDescription")} meta={<StatusBadge>{t("common.assigned", { count: privileges.length })}</StatusBadge>} />
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
          <SectionHeader title={t("account.password")} description={t("account.passwordHint")} />
          <div className="grid gap-3 border-t border-hc-outline p-4 md:grid-cols-2">
            <Field label={t("account.currentPassword")}>
              <Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
            </Field>
            <Field label={t("account.newPassword")}>
              <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            </Field>
          </div>
          <div className="flex justify-end border-t border-hc-outline px-4 py-3">
            <Button
              onClick={() => void handleChangePassword()}
              disabled={currentPassword.length === 0 || newPassword.length < 8 || changePassword.isPending}
            >
              {t("account.password")}
            </Button>
          </div>
        </Card>
      )}

      {isDashboard && <div className="space-y-4"><Card className="overflow-hidden p-0"><SectionHeader title={t("dashboard.manageTitle")} description={t("dashboard.manageDescription")} meta={<StatusBadge>{t("dashboard.visibleCount", { count: dashboard.visible.length })}</StatusBadge>} /><div className="divide-y divide-hc-outline border-t border-hc-outline">{dashboard.definitions.map((definition) => { const preference = dashboard.preferences.widgets[definition.id]; return <div key={definition.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div><div className="text-sm font-semibold">{definition.title ?? t(definition.titleKey)}</div><div className="text-xs text-hc-muted">{definition.category ?? t(definition.categoryKey)} · {t(`dashboard.size.${preference.size}`)}</div></div><Button size="sm" variant={preference.visible ? "outlined" : "tonal"} onClick={() => preference.visible ? dashboard.hide(definition.id) : dashboard.show(definition.id)}>{preference.visible ? t("dashboard.disableWidget") : t("dashboard.enableWidget")}</Button></div>; })}</div></Card><Card><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">{t("dashboard.resetTitle")}</h2><p className="mt-1 text-xs text-hc-muted">{t("dashboard.resetDescription")}</p></div><div className="flex gap-2"><Button variant="outlined" onClick={() => dashboard.restoreDefaults()}>{t("dashboard.restoreDefaults")}</Button><Button variant="danger" onClick={() => dashboard.reset()}>{t("dashboard.resetLayout")}</Button></div></div></Card></div>}
    </div>
  );
}
