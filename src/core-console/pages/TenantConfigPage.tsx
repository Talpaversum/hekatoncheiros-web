import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { hasPrivilege } from "../../access/privileges";
import { useContextQuery } from "../../data/api/context";
import { useAppCatalogQuery } from "../../data/api/app-catalog";
import { useTenantSettingsQuery, useUpdateTenantSettingsMutation } from "../../data/api/configuration";
import {
  useAssignTenantMemberRoleMutation,
  useCreateTenantMembershipMutation,
  useCreateTenantRoleMutation,
  useCreateTenantUserMutation,
  useDeleteTenantMembershipMutation,
  useDeleteTenantRoleMutation,
  usePrivilegeCatalogQuery,
  useRemoveTenantMemberRoleMutation,
  useReplaceTenantUserPrivilegesMutation,
  useTenantMembershipsQuery,
  useTenantRolesQuery,
  useTenantUserDirectoryQuery,
  useTenantUsersQuery,
  useUpdateTenantMembershipMutation,
  type IdentityUser,
  type PrivilegeGrant,
} from "../../data/api/identity";
import { useInstalledAppsQuery } from "../../data/api/installed-apps";
import { readErrorMessage } from "../../data/api/read-error-message";
import { Button } from "../../ui-kit/components/Button";
import { Card } from "../../ui-kit/components/Card";
import { Input } from "../../ui-kit/components/Input";
import { Field, MetricStrip, PageHeader, SectionHeader, StatusBadge } from "../../ui-kit/components/Page";
import { Select } from "../../ui-kit/components/Select";
import { ToastNotice } from "../../ui-kit/components/ToastNotice";
import { useLocalization } from "../../localization/LocalizationProvider";

export function TenantConfigPage() {
  const { t } = useLocalization();
  const location = useLocation();
  const { data: context } = useContextQuery(true);
  const canManageApps = hasPrivilege(context?.privileges ?? [], "platform.apps.manage");
  const { data: catalogData } = useAppCatalogQuery(canManageApps);
  const { data: installedData } = useInstalledAppsQuery(canManageApps);
  const { data: tenantSettings } = useTenantSettingsQuery(true);
  const { data: tenantUsersData } = useTenantUsersQuery(true);
  const { data: membershipsData } = useTenantMembershipsQuery(true);
  const { data: rolesData } = useTenantRolesQuery(true);
  const { data: privilegeCatalogData } = usePrivilegeCatalogQuery(true);
  const updateTenant = useUpdateTenantSettingsMutation();
  const replaceTenantUserPrivileges = useReplaceTenantUserPrivilegesMutation();
  const createMembership = useCreateTenantMembershipMutation();
  const updateMembership = useUpdateTenantMembershipMutation();
  const deleteMembership = useDeleteTenantMembershipMutation();
  const assignRole = useAssignTenantMemberRoleMutation();
  const removeRole = useRemoveTenantMemberRoleMutation();
  const createRole = useCreateTenantRoleMutation();
  const deleteRole = useDeleteTenantRoleMutation();
  const createTenantUser = useCreateTenantUserMutation();
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [primaryDomain, setPrimaryDomain] = useState<string | null>(null);
  const [selectedTenantUserId, setSelectedTenantUserId] = useState("");
  const [tenantGrantPrivilege, setTenantGrantPrivilege] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [directorySearch, setDirectorySearch] = useState("");
  const { data: directoryData } = useTenantUserDirectoryQuery(directorySearch);
  const [directoryUserId, setDirectoryUserId] = useState("");
  const [newMemberRoleId, setNewMemberRoleId] = useState("");
  const [showNewTenantUser, setShowNewTenantUser] = useState(false);
  const [newTenantUserEmail, setNewTenantUserEmail] = useState("");
  const [newTenantUserName, setNewTenantUserName] = useState("");
  const [newTenantUserNickname, setNewTenantUserNickname] = useState("");
  const [newTenantUserPassword, setNewTenantUserPassword] = useState("");
  const [roleName, setRoleName] = useState("");
  const [roleKey, setRoleKey] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [rolePrivileges, setRolePrivileges] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const catalog = useMemo(() => catalogData?.items ?? [], [catalogData?.items]);
  const installed = useMemo(() => installedData?.items ?? [], [installedData?.items]);
  const tenantUsers = tenantUsersData?.items ?? [];
  const memberships = membershipsData?.items ?? [];
  const roles = rolesData?.items ?? [];
  const directoryUsers = directoryData?.items ?? [];
  const tenantPrivilegeCatalog = (privilegeCatalogData?.items ?? []).filter((item) => item.scope === "tenant");
  const licenseRequired = catalog.filter((item) => item.license_required).length;
  const section = location.pathname.split("/").pop() ?? "";
  const effectiveTenantName = tenantName ?? tenantSettings?.name ?? context?.tenant.name ?? "";
  const effectivePrimaryDomain = primaryDomain ?? tenantSettings?.primary_domain ?? context?.tenant.primary_domain ?? "";
  const selectedTenantUser = tenantUsers.find((item) => item.id === selectedTenantUserId) ?? tenantUsers[0];
  const usersById = new Map(tenantUsers.map((user) => [user.id, user]));
  const filteredMemberships = memberships.filter((membership) => {
    const user = usersById.get(membership.user_id); const query = memberSearch.trim().toLowerCase();
    return !query || [user?.display_name, user?.nickname, user?.email, user?.id].some((value) => value?.toLowerCase().includes(query));
  });
  const toastMessage = error ?? message;
  const toastTone = error ? "danger" : "success";
  const dismissToast = () => {
    setMessage(null);
    setError(null);
  };

  const handleSaveTenant = async () => {
    setMessage(null);
    setError(null);
    try {
      await updateTenant.mutateAsync({
        name: effectiveTenantName.trim(),
        primary_domain: effectivePrimaryDomain.trim() || null,
      });
      setTenantName(null);
      setPrimaryDomain(null);
      setMessage(t("tenant.detailsUpdated"));
    } catch (err) {
      setError(readErrorMessage(err));
    }
  };

  const handleAddTenantGrant = async () => {
    if (!selectedTenantUser || !tenantGrantPrivilege) {
      return;
    }
    const exists = selectedTenantUser.privileges.some((item) => item.privilege === tenantGrantPrivilege);
    if (exists) {
      setError(t("tenant.privilegeExists"));
      return;
    }
    setMessage(null);
    setError(null);
    try {
      await replaceTenantUserPrivileges.mutateAsync({
        id: selectedTenantUser.id,
        grants: [...selectedTenantUser.privileges, { privilege: tenantGrantPrivilege, tenant_id: tenantSettings?.id ?? context?.tenant.id ?? null }],
      });
      setTenantGrantPrivilege("");
      setMessage(t("tenant.privilegeAdded"));
    } catch (err) {
      setError(readErrorMessage(err));
    }
  };

  const handleRemoveTenantGrant = async (user: IdentityUser, grant: PrivilegeGrant) => {
    setMessage(null);
    setError(null);
    try {
      await replaceTenantUserPrivileges.mutateAsync({
        id: user.id,
        grants: user.privileges.filter((item) => item.privilege !== grant.privilege),
      });
      setMessage(t("tenant.privilegeRemoved"));
    } catch (err) {
      setError(readErrorMessage(err));
    }
  };

  const runRbacAction = async (action: () => Promise<unknown>, success: string) => {
    setMessage(null); setError(null);
    try { await action(); setMessage(success); } catch (err) { setError(readErrorMessage(err)); }
  };

  const handleAddExistingMember = () => {
    if (!directoryUserId) return;
    void runRbacAction(async () => {
      await createMembership.mutateAsync({ user_id: directoryUserId, role_ids: newMemberRoleId ? [newMemberRoleId] : [] });
      setDirectorySearch(""); setDirectoryUserId(""); setNewMemberRoleId("");
    }, t("tenant.memberAdded"));
  };

  const handleCreateTenantUser = () => {
    void runRbacAction(async () => {
      await createTenantUser.mutateAsync({ email: newTenantUserEmail.trim(), display_name: newTenantUserName.trim(),
        nickname: newTenantUserNickname.trim() || null, password: newTenantUserPassword, status: "active",
        role_ids: newMemberRoleId ? [newMemberRoleId] : [] });
      setNewTenantUserEmail(""); setNewTenantUserName(""); setNewTenantUserNickname(""); setNewTenantUserPassword(""); setNewMemberRoleId(""); setShowNewTenantUser(false);
    }, t("tenant.memberCreated"));
  };

  const handleCreateRole = () => {
    void runRbacAction(async () => {
      await createRole.mutateAsync({ key: roleKey.trim(), name: roleName.trim(), description: roleDescription.trim(), privileges: rolePrivileges });
      setRoleKey(""); setRoleName(""); setRoleDescription(""); setRolePrivileges([]);
    }, t("tenant.roleCreated"));
  };

  return (
    <div className="space-y-4">
      <ToastNotice message={toastMessage} tone={toastTone} onDismiss={dismissToast} />

      <PageHeader eyebrow={t("config.configuration")} title={t("tenant.title")} description={t("tenant.description")} />

      {(section === "tenant" || section === "") && <>
        <MetricStrip items={[
          { label: t("tenant.installedApps"), value: installed.length },
          { label: t("tenant.licenseRequired"), value: licenseRequired, tone: licenseRequired > 0 ? "warning" : "neutral" },
          { label: t("tenant.users"), value: tenantUsers.length },
          { label: t("tenant.mode"), value: context?.tenant.mode ?? "-" },
        ]} />
        <Card className="mt-4 overflow-hidden p-0">
          <SectionHeader title={tenantSettings?.name ?? context?.tenant.name ?? context?.tenant.id ?? t("tenant.fallbackName")} description={tenantSettings?.primary_domain ?? context?.tenant.primary_domain ?? t("tenant.noPrimaryDomain")} meta={<StatusBadge tone="success">{tenantSettings?.status ?? t("config.active")}</StatusBadge>} />
        </Card>
      </>}

      <div className="grid gap-4">
        {section === "details" && <Card className="overflow-hidden p-0">
          <SectionHeader title={t("tenant.details")} description={t("tenant.detailsDescription")} meta={<StatusBadge tone="success">{tenantSettings?.status ?? t("config.active")}</StatusBadge>} />
          <div className="grid gap-3 border-t border-hc-outline p-4 md:grid-cols-2">
            <Field label={t("tenant.name")}>
              <Input value={effectiveTenantName} onChange={(event) => setTenantName(event.target.value)} />
            </Field>
            <Field label={t("tenant.primaryDomain")}>
              <Input value={effectivePrimaryDomain} onChange={(event) => setPrimaryDomain(event.target.value)} placeholder="example.com" />
            </Field>
          </div>
          <div className="flex justify-end border-t border-hc-outline px-4 py-3">
            <Button onClick={() => void handleSaveTenant()} disabled={!effectiveTenantName.trim() || updateTenant.isPending}>
              {t("tenant.save")}
            </Button>
          </div>
          <div className="grid border-t border-hc-outline md:grid-cols-2 md:divide-x md:divide-hc-outline">
            <ConfigTile title={t("tenant.dataPolicy")} status={t("common.planned")} detail={t("tenant.dataPolicyDescription")} />
            <ConfigTile title={t("tenant.operationalContacts")} status={t("common.planned")} detail={t("tenant.operationalContactsDescription")} />
          </div>
        </Card>}

        {section === "users" && <>
          <Card className="overflow-hidden p-0">
            <SectionHeader title={t("tenant.members")} description={t("tenant.membersDescription")} meta={<StatusBadge>{t("tenant.usersCount", { count: memberships.length })}</StatusBadge>} />
            <div className="grid gap-3 border-t border-hc-outline p-3 md:grid-cols-[1fr_auto]">
              <Input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder={t("tenant.searchMembers")} />
              <Button variant="outlined" onClick={() => setShowNewTenantUser((value) => !value)}>{t("tenant.createMember")}</Button>
            </div>
            <div className="grid gap-3 border-t border-hc-outline bg-hc-surface-variant/40 p-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
              <Field label={t("tenant.findExistingUser")}><Input value={directorySearch} onChange={(event) => { setDirectorySearch(event.target.value); setDirectoryUserId(""); }} placeholder={t("tenant.searchDirectory")} /></Field>
              <Field label={t("tenant.user")}><Select value={directoryUserId} onChange={(event) => setDirectoryUserId(event.target.value)}><option value="">{t("tenant.selectUser")}</option>{directoryUsers.map((user) => <option key={user.id} value={user.id}>{user.display_name || user.email}{directoryUsers.filter((item) => (item.display_name || item.email) === (user.display_name || user.email)).length > 1 ? ` — ${user.id}` : ""}</option>)}</Select></Field>
              <Field label={t("tenant.optionalRole")}><Select value={newMemberRoleId} onChange={(event) => setNewMemberRoleId(event.target.value)}><option value="">{t("tenant.baseRoleOnly")}</option>{roles.filter((role) => role.key !== "tenant_member").map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</Select></Field>
              <Button onClick={handleAddExistingMember} disabled={!directoryUserId || createMembership.isPending}>{t("tenant.addMember")}</Button>
            </div>
            {showNewTenantUser && <div className="grid gap-3 border-t border-hc-outline p-3 md:grid-cols-2 lg:grid-cols-5">
              <Input value={newTenantUserEmail} onChange={(event) => setNewTenantUserEmail(event.target.value)} placeholder={t("platform.email")} />
              <Input value={newTenantUserName} onChange={(event) => setNewTenantUserName(event.target.value)} placeholder={t("platform.displayName")} />
              <Input value={newTenantUserNickname} onChange={(event) => setNewTenantUserNickname(event.target.value)} placeholder={t("platform.nickname")} />
              <Input type="password" value={newTenantUserPassword} onChange={(event) => setNewTenantUserPassword(event.target.value)} placeholder={t("platform.initialPassword")} />
              <Button onClick={handleCreateTenantUser} disabled={!newTenantUserEmail.trim() || !newTenantUserName.trim() || newTenantUserPassword.length < 8 || createTenantUser.isPending}>{t("tenant.createMember")}</Button>
            </div>}
            <div>
              {filteredMemberships.length === 0 && <div className="px-4 py-8 text-center text-sm text-hc-muted">{t("tenant.noUsers")}</div>}
              {filteredMemberships.map((membership) => {
                const user = usersById.get(membership.user_id); const availableRoles = roles.filter((role) => !membership.roles.some((assigned) => assigned.id === role.id));
                return <div key={membership.id} className="border-t border-hc-outline px-4 py-3">
                  <div className="grid gap-3 md:grid-cols-[minmax(14rem,1fr)_minmax(16rem,1.5fr)_auto] md:items-center">
                    <button type="button" className="text-left" onClick={() => setSelectedTenantUserId(membership.user_id)}><div className="text-sm font-semibold">{user?.display_name || user?.email || membership.user_id}</div><div className="text-xs text-hc-muted">{user?.email} · {membership.user_id}</div></button>
                    <div className="flex flex-wrap gap-1.5">{membership.roles.map((role) => <span key={role.id} className="inline-flex items-center gap-1 rounded-hc-sm border border-hc-outline px-2 py-1 text-xs">{role.name}{role.key !== "tenant_member" && <button type="button" aria-label={`${t("tenant.remove")} ${role.name}`} onClick={() => void runRbacAction(() => removeRole.mutateAsync({ membership_id: membership.id, role_id: role.id }), t("tenant.roleRemoved"))}>×</button>}</span>)}</div>
                    <div className="flex flex-wrap justify-end gap-2"><Button size="sm" variant="outlined" onClick={() => void runRbacAction(() => updateMembership.mutateAsync({ id: membership.id, status: membership.status === "active" ? "inactive" : "active", version: membership.version }), t("tenant.membershipUpdated"))}>{membership.status === "active" ? t("tenant.deactivate") : t("tenant.activate")}</Button><Button size="sm" variant="ghost" onClick={() => void runRbacAction(() => deleteMembership.mutateAsync(membership.id), t("tenant.memberRemoved"))}>{t("tenant.remove")}</Button></div>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto] md:items-end"><Field label={t("tenant.addRole")}><Select defaultValue="" onChange={(event) => { if (event.target.value) void runRbacAction(() => assignRole.mutateAsync({ membership_id: membership.id, role_id: event.target.value }), t("tenant.roleAssigned")); event.target.value = ""; }}><option value="">{t("tenant.selectRole")}</option>{availableRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</Select></Field><span className="pb-2 text-xs text-hc-muted">{t("tenant.effectivePrivileges", { count: membership.effective_privileges.length })}</span></div>
                </div>;
              })}
            </div>
          </Card>

          <Card className="overflow-hidden p-0">
            <SectionHeader title={t("tenant.roles")} description={t("tenant.rolesDescription")} meta={<StatusBadge>{roles.length}</StatusBadge>} />
            <div className="grid gap-3 border-t border-hc-outline p-3 md:grid-cols-3"><Input value={roleName} onChange={(event) => { setRoleName(event.target.value); if (!roleKey) setRoleKey(event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")); }} placeholder={t("tenant.roleName")} /><Input value={roleKey} onChange={(event) => setRoleKey(event.target.value)} placeholder={t("tenant.roleKey")} /><Input value={roleDescription} onChange={(event) => setRoleDescription(event.target.value)} placeholder={t("tenant.roleDescription")} /></div>
            <div className="grid gap-2 border-t border-hc-outline p-3 sm:grid-cols-2 lg:grid-cols-3">{tenantPrivilegeCatalog.map((privilege) => <label key={privilege.id} className="flex gap-2 text-sm"><input type="checkbox" checked={rolePrivileges.includes(privilege.id)} onChange={(event) => setRolePrivileges((current) => event.target.checked ? [...current, privilege.id] : current.filter((item) => item !== privilege.id))} /><span><span className="block font-medium">{privilege.label}</span><span className="block font-mono text-xs text-hc-muted">{privilege.id}</span></span></label>)}</div>
            <div className="flex justify-end border-t border-hc-outline p-3"><Button onClick={handleCreateRole} disabled={!roleName.trim() || !roleKey.trim() || createRole.isPending}>{t("tenant.createRole")}</Button></div>
            {roles.map((role) => <div key={role.id} className="grid gap-2 border-t border-hc-outline px-4 py-3 md:grid-cols-[1fr_1.5fr_auto] md:items-center"><div><div className="text-sm font-semibold">{role.name}</div><div className="font-mono text-xs text-hc-muted">{role.key}</div></div><div><div className="text-sm">{role.description}</div><div className="text-xs text-hc-muted">{t("tenant.roleSummary", { privileges: role.privileges.length, members: role.member_count })}</div></div>{role.is_system ? <StatusBadge>{t("tenant.systemRole")}</StatusBadge> : <Button size="sm" variant="ghost" onClick={() => void runRbacAction(() => deleteRole.mutateAsync(role.id), t("tenant.roleDeleted"))}>{t("platform.delete")}</Button>}</div>)}
          </Card>

          <Card className="overflow-hidden p-0">
            <SectionHeader title={t("tenant.directPrivileges")} description={t("tenant.directPrivilegesDescription")} />
            <div className="grid gap-3 border-t border-hc-outline p-3 md:grid-cols-[1fr_1fr_auto] md:items-end"><Field label={t("tenant.user")}><Select value={selectedTenantUser?.id ?? ""} onChange={(event) => setSelectedTenantUserId(event.target.value)}>{tenantUsers.map((user) => <option key={user.id} value={user.id}>{user.display_name || user.email}</option>)}</Select></Field><Field label={t("tenant.privilege")}><Select value={tenantGrantPrivilege} onChange={(event) => setTenantGrantPrivilege(event.target.value)}><option value="">{t("tenant.selectPrivilege")}</option>{tenantPrivilegeCatalog.map((privilege) => <option key={privilege.id} value={privilege.id}>{privilege.label}</option>)}</Select></Field><Button onClick={() => void handleAddTenantGrant()} disabled={!selectedTenantUser || !tenantGrantPrivilege || replaceTenantUserPrivileges.isPending}>{t("tenant.addPrivilege")}</Button></div>
            {selectedTenantUser && <TenantUserRow user={selectedTenantUser} selected onSelect={() => undefined} onRemove={(grant) => void handleRemoveTenantGrant(selectedTenantUser, grant)} busy={replaceTenantUserPrivileges.isPending} />}
          </Card>
        </>}

        {section === "apps" && <Card className="overflow-hidden p-0">
          <SectionHeader title={t("tenant.appsLicenses")} description={t("tenant.appsLicensesDescription")} meta={<StatusBadge tone="info">{t("tenant.activeElsewhere")}</StatusBadge>} />
          <div className="grid border-t border-hc-outline md:grid-cols-3 md:divide-x md:divide-hc-outline">
            <ConfigTile title={t("tenant.installedApps")} status={`${installed.length}`} detail={t("tenant.installedAppsDescription")} />
            <ConfigTile title={t("tenant.licenseApps")} status={`${licenseRequired}`} detail={t("tenant.licenseAppsDescription")} />
            <ConfigTile title={t("tenant.feedPublishing")} status={t("tenant.adminGated")} detail={t("tenant.feedPublishingDescription")} />
          </div>
        </Card>}

        {section === "audit" && <Card className="overflow-hidden p-0">
          <SectionHeader title={t("tenant.auditContext")} description={t("tenant.auditDescription")} meta={<StatusBadge>{t("common.planned")}</StatusBadge>} />
          <div className="grid border-t border-hc-outline md:grid-cols-3 md:divide-x md:divide-hc-outline">
            <ConfigTile title={t("tenant.recentActions")} status={t("common.planned")} detail={t("tenant.recentActionsDescription")} />
            <ConfigTile title={t("tenant.licenseEvents")} status={t("common.planned")} detail={t("tenant.licenseEventsDescription")} />
            <ConfigTile title={t("tenant.export")} status={t("common.planned")} detail={t("tenant.exportDescription")} />
          </div>
        </Card>}
      </div>
    </div>
  );
}

function ConfigTile({ title, status, detail }: { title: string; status: string; detail: string }) {
  return (
    <div className="border-b border-hc-outline px-4 py-3 last:border-b-0 md:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">{title}</div>
        <StatusBadge>{status}</StatusBadge>
      </div>
      <div className="mt-2 text-xs text-hc-muted">{detail}</div>
    </div>
  );
}

function TenantUserRow({
  user,
  selected,
  onSelect,
  onRemove,
  busy,
}: {
  user: IdentityUser;
  selected: boolean;
  onSelect: () => void;
  onRemove: (grant: PrivilegeGrant) => void;
  busy: boolean;
}) {
  const { t } = useLocalization();
  return (
    <div className={`grid gap-2 border-b border-hc-outline px-4 py-3 last:border-b-0 md:grid-cols-[minmax(14rem,0.8fr)_minmax(18rem,1.5fr)_auto] md:items-center ${selected ? "bg-hc-primary/5" : ""}`}>
      <button type="button" className="min-w-0 text-left" onClick={onSelect}>
          <div className="text-sm font-semibold">{user.display_name || user.email}</div>
          <div className="truncate text-xs text-hc-muted">{user.email} · {user.id}</div>
      </button>
      <div className="flex flex-wrap gap-1.5">
        {user.privileges.map((grant) => (
          <span key={`${grant.privilege}:${grant.tenant_id ?? "tenant"}`} className="inline-flex items-center gap-1 rounded-hc-sm border border-hc-outline bg-hc-surface px-2 py-1 text-xs">
            {grant.privilege}
            <button type="button" className="ml-1 text-hc-muted hover:text-hc-danger disabled:opacity-50" onClick={() => onRemove(grant)} disabled={busy} aria-label={`${t("tenant.remove")} ${grant.privilege}`}>×</button>
          </span>
        ))}
        {user.privileges.length === 0 && <span className="text-xs text-hc-muted">{t("tenant.noPrivileges")}</span>}
      </div>
      <StatusBadge tone={user.status === "active" ? "success" : "neutral"}>{user.status === "active" ? t("config.active") : user.status === "disabled" ? t("config.disabled") : user.status}</StatusBadge>
    </div>
  );
}
