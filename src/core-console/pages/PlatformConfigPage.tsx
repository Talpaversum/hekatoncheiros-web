import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { AuthorsPanel } from "./AuthorsPanel";

import {
  usePlatformInstanceSettingsQuery,
  useUpdatePlatformInstanceSettingsMutation,
} from "../../data/api/configuration";
import {
  useCreateIdentityTenantMutation,
  useCreateIdentityUserMutation,
  useIdentityTenantsQuery,
  useIdentityUsersQuery,
  usePrivilegeCatalogQuery,
  useReplaceIdentityUserPrivilegesMutation,
  useResetIdentityUserPasswordMutation,
  useUpdateIdentityTenantMutation,
  useUpdateIdentityUserMutation,
  type IdentityTenant,
  type IdentityUser,
  type PrivilegeDefinition,
  type PrivilegeGrant,
} from "../../data/api/identity";
import { readErrorMessage } from "../../data/api/read-error-message";
import {
  useCreateTrustedOriginMutation,
  useDeleteTrustedOriginMutation,
  useTrustedOriginsQuery,
  useTestTrustedOriginMutation,
  useUpdateTrustedOriginMutation,
  type TrustedOrigin,
} from "../../data/api/trusted-origins";
import { Button } from "../../ui-kit/components/Button";
import { Card } from "../../ui-kit/components/Card";
import { Input } from "../../ui-kit/components/Input";
import { Field, MetricStrip, PageHeader, SectionHeader, StatusBadge } from "../../ui-kit/components/Page";
import { Select } from "../../ui-kit/components/Select";
import { Switch } from "../../ui-kit/components/Switch";
import { Table } from "../../ui-kit/components/Table";
import { ToastNotice } from "../../ui-kit/components/ToastNotice";
import { TabBar } from "../../ui-kit/components/TabBar";
import { useLocalization } from "../../localization/LocalizationProvider";

type IdentityTab = "users" | "tenants" | "roles";

function readIdentityTabFromPath(pathname: string): IdentityTab {
  if (pathname.includes("/identity/tenants")) return "tenants";
  if (pathname.includes("/identity/roles")) return "roles";
  return "users";
}

function readIdentityDetailId(pathname: string, type: "users" | "tenants") {
  const marker = `/core/platform/identity/${type}/`;
  if (!pathname.startsWith(marker)) return null;
  return decodeURIComponent(pathname.slice(marker.length).split("/")[0] ?? "") || null;
}

function translateConfigStatus(status: string, t: ReturnType<typeof useLocalization>["t"]) {
  if (status === "active") return t("config.active");
  if (status === "disabled") return t("config.disabled");
  return status;
}

export function PlatformConfigPage() {
  const { t } = useLocalization();
  const location = useLocation();
  const navigate = useNavigate();
  const section = location.pathname.split("/")[3] ?? "";
  const activeIdentityTab = readIdentityTabFromPath(location.pathname);
  const userDetailId = readIdentityDetailId(location.pathname, "users");
  const tenantDetailId = readIdentityDetailId(location.pathname, "tenants");
  const { data, isLoading } = useTrustedOriginsQuery(true);
  const { data: platformInstance } = usePlatformInstanceSettingsQuery(true);
  const { data: identityUsersData } = useIdentityUsersQuery(section === "identity" || section === "platform" || section === "");
  const { data: identityTenantsData } = useIdentityTenantsQuery(section === "identity" || section === "platform" || section === "");
  const { data: privilegeCatalogData } = usePrivilegeCatalogQuery(section === "identity");
  const updatePlatformInstance = useUpdatePlatformInstanceSettingsMutation();
  const createUser = useCreateIdentityUserMutation();
  const updateUser = useUpdateIdentityUserMutation();
  const resetPassword = useResetIdentityUserPasswordMutation();
  const replaceUserPrivileges = useReplaceIdentityUserPrivilegesMutation();
  const createTenant = useCreateIdentityTenantMutation();
  const updateTenant = useUpdateIdentityTenantMutation();
  const createMutation = useCreateTrustedOriginMutation();
  const updateMutation = useUpdateTrustedOriginMutation();
  const deleteMutation = useDeleteTrustedOriginMutation();

  const [origin, setOrigin] = useState("");
  const [note, setNote] = useState("");
  const [allowHttp, setAllowHttp] = useState(false);
  const [originSearch, setOriginSearch] = useState("");
  const [instanceName, setInstanceName] = useState<string | null>(null);
  const [publicBaseUrl, setPublicBaseUrl] = useState<string | null>(null);
  const [healthInterval, setHealthInterval] = useState<number | null>(null);
  const [healthTimeout, setHealthTimeout] = useState<number | null>(null);
  const [healthFailures, setHealthFailures] = useState<number | null>(null);
  const [newUserId, setNewUserId] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [grantPrivilege, setGrantPrivilege] = useState("");
  const [grantTenantId, setGrantTenantId] = useState("");
  const [newTenantId, setNewTenantId] = useState("");
  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantDomain, setNewTenantDomain] = useState("");
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showCreateTenant, setShowCreateTenant] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [tenantSearch, setTenantSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const origins = useMemo(() => data?.items ?? [], [data?.items]);
  const identityUsers = useMemo(() => identityUsersData?.items ?? [], [identityUsersData?.items]);
  const identityTenants = useMemo(() => identityTenantsData?.items ?? [], [identityTenantsData?.items]);
  const privilegeCatalog = privilegeCatalogData?.items ?? [];
  const effectiveInstanceName = instanceName ?? platformInstance?.name ?? "";
  const effectivePublicBaseUrl = publicBaseUrl ?? platformInstance?.public_base_url ?? "";
  const effectiveHealthInterval = healthInterval ?? platformInstance?.runtime_health_interval_ms ?? 5000;
  const effectiveHealthTimeout = healthTimeout ?? platformInstance?.runtime_health_timeout_ms ?? 1500;
  const effectiveHealthFailures = healthFailures ?? platformInstance?.runtime_health_failure_threshold ?? 2;
  const selectedUser = identityUsers.find((item) => item.id === selectedUserId) ?? identityUsers[0];
  const userDetail = identityUsers.find((item) => item.id === userDetailId) ?? null;
  const tenantDetail = identityTenants.find((item) => item.id === tenantDetailId) ?? null;
  const filteredIdentityUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    if (!query) return identityUsers;
    return identityUsers.filter((user) => [user.id, user.email, user.display_name ?? ""].some((value) => value.toLowerCase().includes(query)));
  }, [identityUsers, userSearch]);
  const filteredIdentityTenants = useMemo(() => {
    const query = tenantSearch.trim().toLowerCase();
    if (!query) return identityTenants;
    return identityTenants.filter((tenant) => [tenant.id, tenant.name, tenant.primary_domain ?? ""].some((value) => value.toLowerCase().includes(query)));
  }, [identityTenants, tenantSearch]);
  const filteredOrigins = useMemo(() => {
    const query = originSearch.trim().toLowerCase();
    if (!query) return origins;
    return origins.filter((item) => [item.origin, item.note ?? "", item.created_by ?? ""].some((value) => value.toLowerCase().includes(query)));
  }, [originSearch, origins]);
  const toastMessage = error ?? message;
  const toastTone = error ? "danger" : "success";
  const dismissToast = () => {
    setMessage(null);
    setError(null);
  };

  const httpOriginDetected = useMemo(() => {
    try {
      return new URL(origin).protocol === "http:";
    } catch {
      return false;
    }
  }, [origin]);

  const handleCreate = async () => {
    setMessage(null);
    setError(null);

    const normalized = origin.trim();
    if (!normalized) {
      setError(t("platform.originRequired"));
      return;
    }

    if (httpOriginDetected && !allowHttp) {
      setError(t("platform.httpConfirmation"));
      return;
    }

    try {
      await createMutation.mutateAsync({ origin: normalized, note: note.trim() || null });
      setMessage(t("platform.originAdded"));
      setOrigin("");
      setNote("");
      setAllowHttp(false);
    } catch (err) {
      setError(readErrorMessage(err));
    }
  };

  const handleSaveInstance = async () => {
    setMessage(null);
    setError(null);
    try {
      await updatePlatformInstance.mutateAsync({
        name: effectiveInstanceName.trim(),
        public_base_url: effectivePublicBaseUrl.trim() || null,
        runtime_health_interval_ms: effectiveHealthInterval,
        runtime_health_timeout_ms: effectiveHealthTimeout,
        runtime_health_failure_threshold: effectiveHealthFailures,
      });
      setInstanceName(null);
      setPublicBaseUrl(null);
      setHealthInterval(null); setHealthTimeout(null); setHealthFailures(null);
      setMessage(t("platform.instanceUpdated"));
    } catch (err) {
      setError(readErrorMessage(err));
    }
  };

  const handleCreateUser = async () => {
    setMessage(null);
    setError(null);
    try {
      const created = await createUser.mutateAsync({
        id: newUserId.trim(),
        email: newUserEmail.trim(),
        display_name: newUserName.trim() || null,
        password: newUserPassword,
        status: "active",
      });
      setNewUserId("");
      setNewUserEmail("");
      setNewUserName("");
      setNewUserPassword("");
      setShowCreateUser(false);
      setSelectedUserId(created.id);
      navigate(`/core/platform/identity/users/${encodeURIComponent(created.id)}`);
      setMessage(t("platform.userCreated"));
    } catch (err) {
      setError(readErrorMessage(err));
    }
  };

  const handleCreateTenant = async () => {
    setMessage(null);
    setError(null);
    try {
      const created = await createTenant.mutateAsync({
        id: newTenantId.trim(),
        name: newTenantName.trim(),
        primary_domain: newTenantDomain.trim() || null,
        status: "active",
      });
      setNewTenantId("");
      setNewTenantName("");
      setNewTenantDomain("");
      setShowCreateTenant(false);
      navigate(`/core/platform/identity/tenants/${encodeURIComponent(created.id)}`);
      setMessage(t("platform.tenantCreated"));
    } catch (err) {
      setError(readErrorMessage(err));
    }
  };

  const handleAddGrant = async () => {
    if (!selectedUser || !grantPrivilege) {
      return;
    }
    const nextGrant = {
      privilege: grantPrivilege,
      tenant_id: grantTenantId || null,
    };
    const definition = privilegeCatalog.find((item) => item.id === grantPrivilege);
    if (definition?.scope === "platform" && nextGrant.tenant_id) {
      setError(t("platform.platformPrivilegeScope"));
      return;
    }
    const exists = selectedUser.privileges.some(
      (item) => item.privilege === nextGrant.privilege && item.tenant_id === nextGrant.tenant_id,
    );
    if (exists) {
      setError(t("platform.grantExists"));
      return;
    }

    setMessage(null);
    setError(null);
    try {
      await replaceUserPrivileges.mutateAsync({ id: selectedUser.id, grants: [...selectedUser.privileges, nextGrant] });
      setGrantPrivilege("");
      setGrantTenantId("");
      setMessage(t("platform.grantAdded"));
    } catch (err) {
      setError(readErrorMessage(err));
    }
  };

  const handleRemoveGrant = async (user: IdentityUser, grant: PrivilegeGrant) => {
    setMessage(null);
    setError(null);
    try {
      await replaceUserPrivileges.mutateAsync({
        id: user.id,
        grants: user.privileges.filter((item) => item.privilege !== grant.privilege || item.tenant_id !== grant.tenant_id),
      });
      setMessage(t("platform.grantRemoved"));
    } catch (err) {
      setError(readErrorMessage(err));
    }
  };

  const handleToggle = async (item: TrustedOrigin) => {
    setMessage(null);
    setError(null);
    try {
      await updateMutation.mutateAsync({ id: item.id, is_enabled: !item.is_enabled });
    } catch (err) {
      setError(readErrorMessage(err));
    }
  };

  const handleDelete = async (item: TrustedOrigin) => {
    setMessage(null);
    setError(null);
    try {
      await deleteMutation.mutateAsync(item.id);
    } catch (err) {
      setError(readErrorMessage(err));
    }
  };

  const handleNoteSave = async (item: TrustedOrigin, nextNote: string) => {
    setMessage(null);
    setError(null);
    try {
      await updateMutation.mutateAsync({ id: item.id, note: nextNote.trim() || null });
    } catch (err) {
      setError(readErrorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      <ToastNotice message={toastMessage} tone={toastTone} onDismiss={dismissToast} />

      <PageHeader eyebrow={t("config.configuration")} title={t("platform.title")} description={t("platform.description")} />

      {(section === "platform" || section === "") && <>
        <MetricStrip items={[
          { label: t("platform.trustedOrigins"), value: origins.length },
          { label: t("platform.users"), value: identityUsers.length },
          { label: t("platform.tenants"), value: identityTenants.length },
          { label: t("platform.feedExport"), value: t("common.on"), tone: "success" },
        ]} />
        <Card className="mt-4 overflow-hidden p-0">
          <SectionHeader title={t("platform.instanceState")} description={t("platform.instanceStateDescription")} meta={<StatusBadge tone="success">{t("common.active")}</StatusBadge>} />
          <dl className="grid border-t border-hc-outline md:grid-cols-3">
            <SummaryCell label={t("platform.instance")} value={platformInstance?.name ?? "Core"} detail={platformInstance?.instance_id ?? t("common.loading")} />
            <SummaryCell label={t("platform.tenantMode")} value={t("platform.coreOwned")} detail={t("platform.deploymentPolicy")} />
            <SummaryCell label={t("platform.publishTokens")} value={t("common.planned")} detail={t("platform.namespaceApproval")} />
          </dl>
        </Card>
      </>}

      <div className="grid gap-4">
        {section === "instance" && <Card className="overflow-hidden p-0">
          <SectionHeader title={t("platform.platformInstance")} description={t("platform.platformInstanceDescription")} meta={<StatusBadge tone="success">{t("common.active")}</StatusBadge>} />
          <div className="grid gap-3 border-t border-hc-outline p-4 md:grid-cols-2">
            <Field label={t("platform.instanceName")}>
              <Input value={effectiveInstanceName} onChange={(event) => setInstanceName(event.target.value)} />
            </Field>
            <Field label={t("platform.publicBaseUrl")}>
              <Input value={effectivePublicBaseUrl} onChange={(event) => setPublicBaseUrl(event.target.value)} placeholder="https://core.example.com" />
            </Field>
            <Field label={t("platform.healthInterval")}><Input type="number" min={1000} max={300000} value={effectiveHealthInterval} onChange={(event) => setHealthInterval(Number(event.target.value))} /></Field>
            <Field label={t("platform.healthTimeout")}><Input type="number" min={100} max={30000} value={effectiveHealthTimeout} onChange={(event) => setHealthTimeout(Number(event.target.value))} /></Field>
            <Field label={t("platform.healthFailures")}><Input type="number" min={1} max={10} value={effectiveHealthFailures} onChange={(event) => setHealthFailures(Number(event.target.value))} /></Field>
          </div>
          <div className="flex justify-end border-t border-hc-outline px-4 py-3">
            <Button onClick={() => void handleSaveInstance()} disabled={!effectiveInstanceName.trim() || updatePlatformInstance.isPending}>
              {t("platform.saveInstance")}
            </Button>
          </div>
        </Card>}

        {section === "trusted-origins" && <Card className="overflow-hidden p-0">
          <SectionHeader title={t("platform.trustedInstallOrigins")} description={t("platform.originsDescription")} meta={<StatusBadge>{t("platform.originsCount", { count: origins.length })}</StatusBadge>} />

          <div className="grid gap-3 border-y border-hc-outline bg-hc-surface-variant/40 p-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <Field label={t("platform.origin")}>
              <Input placeholder="http://127.0.0.1:4010" value={origin} onChange={(e) => setOrigin(e.target.value)} />
            </Field>
            <Field label={t("platform.note")}>
              <Input placeholder={t("platform.notePlaceholder")} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>

            <Button onClick={() => void handleCreate()} disabled={createMutation.isPending}>
              {t(createMutation.isPending ? "platform.adding" : "platform.addOrigin")}
            </Button>
            {httpOriginDetected && (
              <label className="flex items-center gap-2 text-sm text-hc-danger md:col-span-3">
                <input type="checkbox" checked={allowHttp} onChange={(e) => setAllowHttp(e.target.checked)} />
                {t("platform.allowHttp")}
              </label>
            )}
          </div>

          <div className="border-b border-hc-outline p-3">
            <Input value={originSearch} onChange={(event) => setOriginSearch(event.target.value)} placeholder={t("platform.searchOrigins")} />
          </div>
          <div>
            {isLoading && <div className="px-4 py-6 text-sm text-hc-muted">{t("platform.loadingOrigins")}</div>}
            {!isLoading && origins.length === 0 && <div className="px-4 py-8 text-center text-sm text-hc-muted">{t("platform.noOrigins")}</div>}
            {!isLoading && origins.length > 0 && filteredOrigins.length === 0 && <div className="px-4 py-8 text-center text-sm text-hc-muted">{t("platform.noMatchingOrigins")}</div>}
            {filteredOrigins.length > 0 && <div className="hidden grid-cols-[minmax(15rem,1.4fr)_minmax(10rem,1fr)_7rem_10rem_auto] gap-3 border-b border-hc-outline bg-hc-surface-variant/40 px-4 py-2 text-xs font-semibold uppercase text-hc-muted lg:grid">
              <div>{t("platform.origin")}</div><div>{t("platform.note")}</div><div>{t("platform.status")}</div><div>{t("platform.created")}</div><div className="text-right">{t("platform.actions")}</div>
            </div>}
            {filteredOrigins.map((item) => (
              <TrustedOriginRow
                key={item.id}
                item={item}
                onToggle={() => void handleToggle(item)}
                onDelete={() => void handleDelete(item)}
                onSaveNote={(nextNote) => void handleNoteSave(item, nextNote)}
                busy={updateMutation.isPending || deleteMutation.isPending}
              />
            ))}
          </div>
        </Card>}

        {section === "app-distribution" && <Card className="overflow-hidden p-0">
          <SectionHeader title={t("platform.distribution")} description={t("platform.distributionDescription")} meta={<StatusBadge tone="warning">{t("platform.partlyActive")}</StatusBadge>} />
          <div className="grid border-t border-hc-outline md:grid-cols-3 md:divide-x md:divide-hc-outline">
            <ConfigTile title={t("platform.publicFeed")} status={t("common.active")} detail={t("platform.publicFeedDescription")} />
            <ConfigTile title={t("platform.publishRequests")} status={t("common.planned")} detail={t("platform.publishRequestsDescription")} />
            <ConfigTile title={t("platform.publishTokens")} status={t("common.planned")} detail={t("platform.publishTokensDescription")} />
          </div>
        </Card>}

        {section === "authors" && <AuthorsPanel />}

        {section === "identity" && <div className="grid gap-4">
          <TabBar
            active={activeIdentityTab}
            items={[
              { id: "users", label: t("platform.users"), count: identityUsers.length },
              { id: "tenants", label: t("platform.tenants"), count: identityTenants.length },
              { id: "roles", label: t("platform.roles") },
            ]}
            onChange={(tab) => navigate(tab === "users" ? "/core/platform/identity" : `/core/platform/identity/${tab}`)}
          />

          {activeIdentityTab === "users" && (userDetailId ? (
            userDetail ? <IdentityUserDetail
              key={userDetail.id}
              user={userDetail}
              onBack={() => navigate("/core/platform/identity")}
              onSave={(payload) => updateUser.mutateAsync(payload)}
              onPasswordReset={(password) => resetPassword.mutateAsync({ id: userDetail.id, password })}
              busy={updateUser.isPending || resetPassword.isPending}
            /> : <Card><div className="text-sm text-hc-muted">{t("platform.userNotFound")}</div></Card>
          ) : <Card className="overflow-hidden p-0">
            <SectionHeader
              title={t("platform.users")}
              description={t("platform.usersDescription")}
              meta={<div className="flex items-center gap-2"><StatusBadge>{t("platform.usersCount", { count: identityUsers.length })}</StatusBadge><Button size="sm" onClick={() => setShowCreateUser((value) => !value)}>{t("platform.addUser")}</Button></div>}
            />
            {showCreateUser && <div className="grid gap-3 border-t border-hc-outline bg-hc-surface-variant/40 p-3 md:grid-cols-5">
              <Input placeholder="usr_jana" value={newUserId} onChange={(event) => setNewUserId(event.target.value)} />
              <Input placeholder="jana@example.com" value={newUserEmail} onChange={(event) => setNewUserEmail(event.target.value)} />
              <Input placeholder={t("platform.displayName")} value={newUserName} onChange={(event) => setNewUserName(event.target.value)} />
              <Input type="password" placeholder={t("platform.initialPassword")} value={newUserPassword} onChange={(event) => setNewUserPassword(event.target.value)} />
              <Button onClick={() => void handleCreateUser()} disabled={createUser.isPending || !newUserId.trim() || !newUserEmail.trim() || newUserPassword.length < 8}>{t("platform.createUser")}</Button>
            </div>}
            <div className="border-t border-hc-outline p-3">
              <Input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder={t("platform.searchUsers")} />
            </div>
            <IdentityUsersTable users={filteredIdentityUsers} onOpen={(user) => navigate(`/core/platform/identity/users/${encodeURIComponent(user.id)}`)} />
          </Card>)}

          {activeIdentityTab === "tenants" && (tenantDetailId ? (
            tenantDetail ? <IdentityTenantDetail
              key={tenantDetail.id}
              tenant={tenantDetail}
              onBack={() => navigate("/core/platform/identity/tenants")}
              onSave={(payload) => updateTenant.mutateAsync(payload)}
              busy={updateTenant.isPending}
            /> : <Card><div className="text-sm text-hc-muted">{t("platform.tenantNotFound")}</div></Card>
          ) : <Card className="overflow-hidden p-0">
            <SectionHeader
              title={t("platform.tenants")}
              description={t("platform.tenantsDescription")}
              meta={<div className="flex items-center gap-2"><StatusBadge>{t("platform.tenantsCount", { count: identityTenants.length })}</StatusBadge><Button size="sm" onClick={() => setShowCreateTenant((value) => !value)}>{t("platform.addTenant")}</Button></div>}
            />
            {showCreateTenant && <div className="grid gap-3 border-t border-hc-outline bg-hc-surface-variant/40 p-3 md:grid-cols-4">
              <Input placeholder="tnt_partner" value={newTenantId} onChange={(event) => setNewTenantId(event.target.value)} />
              <Input placeholder={t("tenant.name")} value={newTenantName} onChange={(event) => setNewTenantName(event.target.value)} />
              <Input placeholder="primary.example.com" value={newTenantDomain} onChange={(event) => setNewTenantDomain(event.target.value)} />
              <Button onClick={() => void handleCreateTenant()} disabled={createTenant.isPending || !newTenantId.trim() || !newTenantName.trim()}>{t("platform.createTenant")}</Button>
            </div>}
            <div className="border-t border-hc-outline p-3">
              <Input value={tenantSearch} onChange={(event) => setTenantSearch(event.target.value)} placeholder={t("platform.searchTenants")} />
            </div>
            <IdentityTenantsTable tenants={filteredIdentityTenants} onOpen={(tenant) => navigate(`/core/platform/identity/tenants/${encodeURIComponent(tenant.id)}`)} />
          </Card>)}

          {activeIdentityTab === "roles" && <Card className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="text-sm font-semibold">{t("platform.rbacGrants")}</div>
                <div className="mt-1 text-xs text-hc-muted">{t("platform.rbacDescription")}</div>
              </div>
              <StatusBadge>{t("common.assigned", { count: selectedUser?.privileges.length ?? 0 })}</StatusBadge>
            </div>
            <div className="grid gap-3 border-y border-hc-outline bg-hc-surface-variant/40 px-4 py-3 md:grid-cols-[minmax(12rem,1fr)_minmax(12rem,1fr)_minmax(12rem,1fr)_auto] md:items-end">
              <Field label={t("tenant.user")}>
                <Select value={selectedUser?.id ?? ""} onChange={(event) => setSelectedUserId(event.target.value)}>
                  {identityUsers.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}
                </Select>
              </Field>
              <Field label={t("platform.privilege")}>
                <Select value={grantPrivilege} onChange={(event) => setGrantPrivilege(event.target.value)}>
                  <option value="">{t("platform.selectPrivilege")}</option>
                  {privilegeCatalog.map((privilege) => <option key={privilege.id} value={privilege.id}>{privilege.id}</option>)}
                </Select>
              </Field>
              <Field label={t("platform.scope")}>
                <Select value={grantTenantId} onChange={(event) => setGrantTenantId(event.target.value)}>
                  <option value="">{t("platform.allTenants")}</option>
                  {identityTenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
                </Select>
              </Field>
              <Button className="whitespace-nowrap" onClick={() => void handleAddGrant()} disabled={!selectedUser || !grantPrivilege || replaceUserPrivileges.isPending}>
                {t("platform.addGrant")}
              </Button>
            </div>
            {selectedUser && (
              <div>
                <div className="hidden grid-cols-[minmax(14rem,1.4fr)_minmax(10rem,1fr)_auto] gap-4 border-b border-hc-outline px-4 py-2 text-xs font-semibold uppercase text-hc-muted md:grid">
                  <div>{t("platform.privilege")}</div>
                  <div>{t("platform.scope")}</div>
                  <div className="w-16 text-right">{t("platform.action")}</div>
                </div>
                {selectedUser.privileges.length === 0 && <div className="px-4 py-6 text-center text-sm text-hc-muted">{t("platform.noGrants")}</div>}
                {selectedUser.privileges.map((grant) => (
                  <PrivilegeGrantRow
                    key={`${grant.privilege}:${grant.tenant_id ?? "platform"}`}
                    grant={grant}
                    catalog={privilegeCatalog}
                    tenants={identityTenants}
                    onRemove={() => void handleRemoveGrant(selectedUser, grant)}
                    busy={replaceUserPrivileges.isPending}
                  />
                ))}
              </div>
            )}
          </Card>}
        </div>}

        {section === "automation" && <Card className="overflow-hidden p-0">
          <SectionHeader title={t("platform.automation")} description={t("platform.automationDescription")} meta={<StatusBadge tone="success">{t("common.active")}</StatusBadge>} />
          <div className="grid border-t border-hc-outline md:grid-cols-3 md:divide-x md:divide-hc-outline">
            <ConfigTile title={t("platform.trustedFeedRefresh")} status={t("common.active")} detail={t("platform.trustedFeedRefreshDescription")} />
            <ConfigTile title={t("platform.runtimeManager")} status={t("common.active")} detail={t("platform.runtimeManagerDescription")} />
            <ConfigTile title={t("platform.policyAudit")} status={t("common.active")} detail={t("platform.policyAuditDescription")} />
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

function SummaryCell({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="border-b border-hc-outline px-4 py-3 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
      <dt className="text-xs font-medium text-hc-muted">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold">{value}</dd>
      <div className="mt-0.5 truncate text-xs text-hc-muted" title={detail}>{detail}</div>
    </div>
  );
}

function IdentityUsersTable({ users, onOpen }: { users: IdentityUser[]; onOpen: (user: IdentityUser) => void }) {
  const { t } = useLocalization();
  if (users.length === 0) return <div className="border-t border-hc-outline px-4 py-8 text-center text-sm text-hc-muted">{t("platform.noUsers")}</div>;

  return (
    <Table className="rounded-none border-0 border-t shadow-none">
      <thead><tr><th>{t("platform.identity")}</th><th>{t("platform.userId")}</th><th>{t("platform.grants")}</th><th>{t("platform.status")}</th><th className="text-right">{t("platform.action")}</th></tr></thead>
      <tbody>{users.map((user) => (
        <tr key={user.id}>
          <td><div className="font-medium">{user.display_name || user.email}</div><div className="text-xs text-hc-muted">{user.email}</div></td>
          <td className="font-mono text-xs">{user.id}</td>
          <td>{user.privileges.length}</td>
          <td><StatusBadge tone={user.status === "active" ? "success" : "neutral"}>{translateConfigStatus(user.status, t)}</StatusBadge></td>
          <td className="text-right"><Button size="sm" variant="ghost" onClick={() => onOpen(user)}>{t("common.open")}</Button></td>
        </tr>
      ))}</tbody>
    </Table>
  );
}

function IdentityUserDetail({ user, onBack, onSave, onPasswordReset, busy }: {
  user: IdentityUser;
  onBack: () => void;
  onSave: (payload: { id: string; email?: string; display_name?: string | null; status?: string }) => Promise<unknown>;
  onPasswordReset: (password: string) => Promise<unknown>;
  busy: boolean;
}) {
  const { t } = useLocalization();
  const [email, setEmail] = useState(user.email);
  const [displayName, setDisplayName] = useState(user.display_name ?? "");
  const [status, setStatus] = useState(user.status);
  const [password, setPassword] = useState("");

  return (
    <Card className="overflow-hidden p-0">
      <SectionHeader title={user.display_name || user.email} description={`${user.email} · ${user.id}`} meta={<div className="flex items-center gap-2"><StatusBadge tone={user.status === "active" ? "success" : "neutral"}>{translateConfigStatus(user.status, t)}</StatusBadge><Button size="sm" variant="outlined" onClick={onBack}>{t("platform.backUsers")}</Button></div>} />
      <div className="grid gap-3 border-t border-hc-outline p-4 md:grid-cols-3">
        <Field label={t("platform.email")}><Input value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
        <Field label={t("platform.displayName")}><Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={t("platform.displayName")} /></Field>
        <Field label={t("platform.status")}><Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">{t("config.active")}</option><option value="disabled">{t("config.disabled")}</option></Select></Field>
      </div>
      <div className="flex justify-end border-t border-hc-outline px-4 py-3">
        <Button onClick={() => void onSave({ id: user.id, email: email.trim(), display_name: displayName.trim() || null, status })} disabled={busy || !email.trim()}>{t("platform.saveUser")}</Button>
      </div>
      <div className="grid gap-3 border-t border-hc-outline bg-hc-surface-variant/30 p-4 md:grid-cols-[1fr_auto] md:items-end">
        <Field label={t("platform.newPassword")} hint={t("platform.passwordHint")}><Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></Field>
        <Button
          variant="outlined"
          onClick={() => {
            void onPasswordReset(password).then(() => setPassword(""));
          }}
          disabled={busy || password.length < 8}
        >
          {t("platform.resetPassword")}
        </Button>
      </div>
      <div className="border-t border-hc-outline px-4 py-3 text-xs text-hc-muted">{t("platform.createdGrants", { date: new Date(user.created_at).toLocaleString(), count: user.privileges.length })}</div>
    </Card>
  );
}

function IdentityTenantsTable({ tenants, onOpen }: { tenants: IdentityTenant[]; onOpen: (tenant: IdentityTenant) => void }) {
  const { t } = useLocalization();
  if (tenants.length === 0) return <div className="border-t border-hc-outline px-4 py-8 text-center text-sm text-hc-muted">{t("platform.noTenants")}</div>;

  return (
    <Table className="rounded-none border-0 border-t shadow-none">
      <thead><tr><th>{t("platform.tenant")}</th><th>{t("platform.tenantId")}</th><th>{t("platform.primaryDomain")}</th><th>{t("platform.status")}</th><th className="text-right">{t("platform.action")}</th></tr></thead>
      <tbody>{tenants.map((tenant) => (
        <tr key={tenant.id}>
          <td className="font-medium">{tenant.name}</td>
          <td className="font-mono text-xs">{tenant.id}</td>
          <td>{tenant.primary_domain ?? <span className="text-hc-muted">{t("common.none")}</span>}</td>
          <td><StatusBadge tone={tenant.status === "active" ? "success" : "neutral"}>{translateConfigStatus(tenant.status, t)}</StatusBadge></td>
          <td className="text-right"><Button size="sm" variant="ghost" onClick={() => onOpen(tenant)}>{t("common.open")}</Button></td>
        </tr>
      ))}</tbody>
    </Table>
  );
}

function IdentityTenantDetail({ tenant, onBack, onSave, busy }: {
  tenant: IdentityTenant;
  onBack: () => void;
  onSave: (payload: { id: string; name?: string; primary_domain?: string | null; status?: string }) => Promise<unknown>;
  busy: boolean;
}) {
  const { t } = useLocalization();
  const [name, setName] = useState(tenant.name);
  const [primaryDomain, setPrimaryDomain] = useState(tenant.primary_domain ?? "");
  const [status, setStatus] = useState(tenant.status);

  return (
    <Card className="overflow-hidden p-0">
      <SectionHeader title={tenant.name} description={tenant.id} meta={<div className="flex items-center gap-2"><StatusBadge tone={tenant.status === "active" ? "success" : "neutral"}>{translateConfigStatus(tenant.status, t)}</StatusBadge><Button size="sm" variant="outlined" onClick={onBack}>{t("platform.backTenants")}</Button></div>} />
      <div className="grid gap-3 border-t border-hc-outline p-4 md:grid-cols-3">
        <Field label={t("tenant.name")}><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <Field label={t("platform.primaryDomain")}><Input value={primaryDomain} onChange={(event) => setPrimaryDomain(event.target.value)} placeholder={t("platform.primaryDomain")} /></Field>
        <Field label={t("platform.status")}><Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">{t("config.active")}</option><option value="disabled">{t("config.disabled")}</option></Select></Field>
      </div>
      <div className="flex justify-end border-t border-hc-outline px-4 py-3">
        <Button onClick={() => void onSave({ id: tenant.id, name: name.trim(), primary_domain: primaryDomain.trim() || null, status })} disabled={busy || !name.trim()}>{t("platform.saveTenant")}</Button>
      </div>
      <div className="border-t border-hc-outline px-4 py-3 text-xs text-hc-muted">{t("platform.createdUpdated", { created: new Date(tenant.created_at).toLocaleString(), updated: new Date(tenant.updated_at).toLocaleString() })}</div>
    </Card>
  );
}

function PrivilegeGrantRow({
  grant,
  catalog,
  tenants,
  onRemove,
  busy,
}: {
  grant: PrivilegeGrant;
  catalog: PrivilegeDefinition[];
  tenants: IdentityTenant[];
  onRemove: () => void;
  busy: boolean;
}) {
  const { t } = useLocalization();
  const definition = catalog.find((item) => item.id === grant.privilege);
  const tenant = tenants.find((item) => item.id === grant.tenant_id);

  return (
    <div className="grid gap-2 border-b border-hc-outline px-4 py-2.5 last:border-b-0 md:grid-cols-[minmax(14rem,1.4fr)_minmax(10rem,1fr)_auto] md:items-center md:gap-4">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{definition?.label ?? t("platform.customPrivilege")}</div>
        <div className="truncate font-mono text-xs text-hc-muted">{grant.privilege}</div>
      </div>
      <div>
        <div className="text-sm">{tenant?.name ?? grant.tenant_id ?? t("platform.platform")}</div>
        <div className="text-xs text-hc-muted">{t(grant.tenant_id ? "platform.tenant" : "platform.allTenantsLabel")}</div>
      </div>
      <Button className="justify-self-start px-2 py-1 text-xs md:w-16 md:justify-self-end" variant="ghost" onClick={onRemove} disabled={busy}>{t("platform.remove")}</Button>
    </div>
  );
}

function TrustedOriginRow({
  item,
  onToggle,
  onDelete,
  onSaveNote,
  busy,
}: {
  item: TrustedOrigin;
  onToggle: () => void;
  onDelete: () => void;
  onSaveNote: (nextNote: string) => void;
  busy: boolean;
}) {
  const { t } = useLocalization();
  const [editingNote, setEditingNote] = useState(item.note ?? "");
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const testOrigin = useTestTrustedOriginMutation();

  return (
    <div className="border-b border-hc-outline last:border-b-0">
      <div className="grid gap-2 px-4 py-2.5 lg:grid-cols-[minmax(15rem,1.4fr)_minmax(10rem,1fr)_7rem_10rem_auto] lg:items-center lg:gap-3">
        <div className="min-w-0 truncate text-sm font-medium" title={item.origin}>{item.origin}</div>
        <div className="min-w-0 truncate text-xs text-hc-muted" title={item.note ?? ""}>{item.note ?? t("platform.noNote")}</div>
        <StatusBadge tone={item.is_enabled ? "success" : "neutral"}>{t(item.is_enabled ? "common.on" : "common.off")}</StatusBadge>
        <div className="text-xs text-hc-muted">{new Date(item.created_at).toLocaleDateString()}</div>
        <div className="flex items-center gap-2 lg:justify-end">
          <Switch checked={item.is_enabled} onClick={onToggle} disabled={busy} aria-label={`${t(item.is_enabled ? "common.disable" : "common.enable")} ${item.origin}`} />
          <Button size="sm" variant="ghost" onClick={() => setEditing((value) => !value)} disabled={busy}>{t("platform.edit")}</Button>
          <Button size="sm" variant="ghost" onClick={() => testOrigin.mutate(item.id)} disabled={busy || testOrigin.isPending}>{t(testOrigin.isPending ? "platform.testingOrigin" : "platform.testOrigin")}</Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete((prev) => !prev)} disabled={busy}>{t("platform.delete")}</Button>
        </div>
      </div>

      {testOrigin.data && <div className={`border-t border-hc-outline px-4 py-2 text-xs ${testOrigin.data.reachable ? "text-hc-success" : "text-hc-danger"}`}>{testOrigin.data.reachable ? t("platform.originReachable", { status: testOrigin.data.status_code ?? 0, latency: testOrigin.data.latency_ms }) : t("platform.originUnreachable", { error: testOrigin.data.error ?? "-" })}</div>}

      {editing && <div className="grid gap-2 border-t border-hc-outline bg-hc-surface-variant/30 px-4 py-3 md:grid-cols-[1fr_auto]">
        <Input value={editingNote} onChange={(e) => setEditingNote(e.target.value)} placeholder={t("platform.note")} />
        <Button size="sm" variant="tonal" onClick={() => { onSaveNote(editingNote); setEditing(false); }} disabled={busy}>{t("platform.saveNote")}</Button>
      </div>}

      {confirmDelete && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hc-danger/30 bg-hc-danger/10 px-4 py-3">
          <div className="text-sm text-hc-danger">{t("platform.deleteOrigin")}</div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button size="sm" variant="danger" onClick={onDelete} disabled={busy}>
              {t("platform.confirmDelete")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
