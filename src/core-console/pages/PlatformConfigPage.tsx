import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

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

export function PlatformConfigPage() {
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
      setError("Origin je povinný.");
      return;
    }

    if (httpOriginDetected && !allowHttp) {
      setError("Pro http:// origin musíš explicitně potvrdit Allow HTTP.");
      return;
    }

    try {
      await createMutation.mutateAsync({ origin: normalized, note: note.trim() || null });
      setMessage("Trusted origin byl přidán.");
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
      });
      setInstanceName(null);
      setPublicBaseUrl(null);
      setMessage("Platform instance settings were updated.");
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
      setMessage("User was created.");
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
      setMessage("Tenant was created.");
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
      setError("Platform privilege cannot be scoped to a tenant.");
      return;
    }
    const exists = selectedUser.privileges.some(
      (item) => item.privilege === nextGrant.privilege && item.tenant_id === nextGrant.tenant_id,
    );
    if (exists) {
      setError("This privilege grant already exists.");
      return;
    }

    setMessage(null);
    setError(null);
    try {
      await replaceUserPrivileges.mutateAsync({ id: selectedUser.id, grants: [...selectedUser.privileges, nextGrant] });
      setGrantPrivilege("");
      setGrantTenantId("");
      setMessage("Privilege grant was added.");
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
      setMessage("Privilege grant was removed.");
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

      <PageHeader eyebrow="Configuration" title="Platform configuration" description="Instance-wide controls for trust, app distribution, and platform governance." />

      {(section === "platform" || section === "") && <>
        <MetricStrip items={[
          { label: "Trusted origins", value: origins.length },
          { label: "Users", value: identityUsers.length },
          { label: "Tenants", value: identityTenants.length },
          { label: "Feed export", value: "On", tone: "success" },
        ]} />
        <Card className="mt-4 overflow-hidden p-0">
          <SectionHeader title="Instance state" description="Stable identifiers and platform-owned capabilities." meta={<StatusBadge tone="success">active</StatusBadge>} />
          <dl className="grid border-t border-hc-outline md:grid-cols-3">
            <SummaryCell label="Instance" value={platformInstance?.name ?? "Core"} detail={platformInstance?.instance_id ?? "Loading..."} />
            <SummaryCell label="Tenant mode" value="Core-owned" detail="Controlled by deployment policy" />
            <SummaryCell label="Publish tokens" value="Planned" detail="Namespace and CI pre-approval" />
          </dl>
        </Card>
      </>}

      <div className="grid gap-4">
        {section === "instance" && <Card className="overflow-hidden p-0">
          <SectionHeader title="Platform instance" description="Public identity used by feeds, operators, and future trust metadata." meta={<StatusBadge tone="success">active</StatusBadge>} />
          <div className="grid gap-3 border-t border-hc-outline p-4 md:grid-cols-2">
            <Field label="Instance name">
              <Input value={effectiveInstanceName} onChange={(event) => setInstanceName(event.target.value)} />
            </Field>
            <Field label="Public base URL">
              <Input value={effectivePublicBaseUrl} onChange={(event) => setPublicBaseUrl(event.target.value)} placeholder="https://core.example.com" />
            </Field>
          </div>
          <div className="flex justify-end border-t border-hc-outline px-4 py-3">
            <Button onClick={() => void handleSaveInstance()} disabled={!effectiveInstanceName.trim() || updatePlatformInstance.isPending}>
              Save instance
            </Button>
          </div>
        </Card>}

        {section === "trusted-origins" && <Card className="overflow-hidden p-0">
          <SectionHeader title="Trusted install origins" description="Exact-match origin allowlist (scheme, host and port) for manifest installation." meta={<StatusBadge>{origins.length} origins</StatusBadge>} />

          <div className="grid gap-3 border-y border-hc-outline bg-hc-surface-variant/40 p-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <Field label="Origin">
              <Input placeholder="http://127.0.0.1:4010" value={origin} onChange={(e) => setOrigin(e.target.value)} />
            </Field>
            <Field label="Note">
              <Input placeholder="Local inventory app" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>

            <Button onClick={() => void handleCreate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Adding…" : "Add origin"}
            </Button>
            {httpOriginDetected && (
              <label className="flex items-center gap-2 text-sm text-hc-danger md:col-span-3">
                <input type="checkbox" checked={allowHttp} onChange={(e) => setAllowHttp(e.target.checked)} />
                Allow HTTP for this origin (unsecured transport)
              </label>
            )}
          </div>

          <div className="border-b border-hc-outline p-3">
            <Input value={originSearch} onChange={(event) => setOriginSearch(event.target.value)} placeholder="Search origins" />
          </div>
          <div>
            {isLoading && <div className="px-4 py-6 text-sm text-hc-muted">Loading trusted origins...</div>}
            {!isLoading && origins.length === 0 && <div className="px-4 py-8 text-center text-sm text-hc-muted">No trusted origins.</div>}
            {!isLoading && origins.length > 0 && filteredOrigins.length === 0 && <div className="px-4 py-8 text-center text-sm text-hc-muted">No matching origins.</div>}
            {filteredOrigins.length > 0 && <div className="hidden grid-cols-[minmax(15rem,1.4fr)_minmax(10rem,1fr)_7rem_10rem_auto] gap-3 border-b border-hc-outline bg-hc-surface-variant/40 px-4 py-2 text-xs font-semibold uppercase text-hc-muted lg:grid">
              <div>Origin</div><div>Note</div><div>Status</div><div>Created</div><div className="text-right">Actions</div>
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
          <SectionHeader title="App distribution governance" description="Catalog feed import/export is managed in Applications. This area owns its platform policy." meta={<StatusBadge tone="warning">partly active</StatusBadge>} />
          <div className="grid border-t border-hc-outline md:grid-cols-3 md:divide-x md:divide-hc-outline">
            <ConfigTile title="Public feed" status="active" detail="Only admin-published installed apps are exported." />
            <ConfigTile title="Publish requests" status="planned" detail="User/developer proposals awaiting admin approval." />
            <ConfigTile title="Publish tokens" status="planned" detail="Admin-issued pre-approval for namespaces, apps, or CI pipelines." />
          </div>
        </Card>}

        {section === "identity" && <div className="grid gap-4">
          <TabBar
            active={activeIdentityTab}
            items={[
              { id: "users", label: "Users", count: identityUsers.length },
              { id: "tenants", label: "Tenants", count: identityTenants.length },
              { id: "roles", label: "Roles" },
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
            /> : <Card><div className="text-sm text-hc-muted">User not found.</div></Card>
          ) : <Card className="overflow-hidden p-0">
            <SectionHeader
              title="Users"
              description="Platform identities. Open one user to edit profile fields or reset the password."
              meta={<div className="flex items-center gap-2"><StatusBadge>{identityUsers.length} users</StatusBadge><Button size="sm" onClick={() => setShowCreateUser((value) => !value)}>Add user</Button></div>}
            />
            {showCreateUser && <div className="grid gap-3 border-t border-hc-outline bg-hc-surface-variant/40 p-3 md:grid-cols-5">
              <Input placeholder="usr_jana" value={newUserId} onChange={(event) => setNewUserId(event.target.value)} />
              <Input placeholder="jana@example.com" value={newUserEmail} onChange={(event) => setNewUserEmail(event.target.value)} />
              <Input placeholder="Display name" value={newUserName} onChange={(event) => setNewUserName(event.target.value)} />
              <Input type="password" placeholder="Initial password" value={newUserPassword} onChange={(event) => setNewUserPassword(event.target.value)} />
              <Button onClick={() => void handleCreateUser()} disabled={createUser.isPending || !newUserId.trim() || !newUserEmail.trim() || newUserPassword.length < 8}>Create user</Button>
            </div>}
            <div className="border-t border-hc-outline p-3">
              <Input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search users" />
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
            /> : <Card><div className="text-sm text-hc-muted">Tenant not found.</div></Card>
          ) : <Card className="overflow-hidden p-0">
            <SectionHeader
              title="Tenants"
              description="Tenant records and their primary domains. Open one tenant to edit it."
              meta={<div className="flex items-center gap-2"><StatusBadge>{identityTenants.length} tenants</StatusBadge><Button size="sm" onClick={() => setShowCreateTenant((value) => !value)}>Add tenant</Button></div>}
            />
            {showCreateTenant && <div className="grid gap-3 border-t border-hc-outline bg-hc-surface-variant/40 p-3 md:grid-cols-4">
              <Input placeholder="tnt_partner" value={newTenantId} onChange={(event) => setNewTenantId(event.target.value)} />
              <Input placeholder="Tenant name" value={newTenantName} onChange={(event) => setNewTenantName(event.target.value)} />
              <Input placeholder="primary.example.com" value={newTenantDomain} onChange={(event) => setNewTenantDomain(event.target.value)} />
              <Button onClick={() => void handleCreateTenant()} disabled={createTenant.isPending || !newTenantId.trim() || !newTenantName.trim()}>Create tenant</Button>
            </div>}
            <div className="border-t border-hc-outline p-3">
              <Input value={tenantSearch} onChange={(event) => setTenantSearch(event.target.value)} placeholder="Search tenants" />
            </div>
            <IdentityTenantsTable tenants={filteredIdentityTenants} onOpen={(tenant) => navigate(`/core/platform/identity/tenants/${encodeURIComponent(tenant.id)}`)} />
          </Card>)}

          {activeIdentityTab === "roles" && <Card className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="text-sm font-semibold">RBAC grants</div>
                <div className="mt-1 text-xs text-hc-muted">Assign platform-scoped and tenant-scoped privileges directly to users.</div>
              </div>
              <StatusBadge>{selectedUser?.privileges.length ?? 0} assigned</StatusBadge>
            </div>
            <div className="grid gap-3 border-y border-hc-outline bg-hc-surface-variant/40 px-4 py-3 md:grid-cols-[minmax(12rem,1fr)_minmax(12rem,1fr)_minmax(12rem,1fr)_auto] md:items-end">
              <Field label="User">
                <Select value={selectedUser?.id ?? ""} onChange={(event) => setSelectedUserId(event.target.value)}>
                  {identityUsers.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}
                </Select>
              </Field>
              <Field label="Privilege">
                <Select value={grantPrivilege} onChange={(event) => setGrantPrivilege(event.target.value)}>
                  <option value="">Select privilege</option>
                  {privilegeCatalog.map((privilege) => <option key={privilege.id} value={privilege.id}>{privilege.id}</option>)}
                </Select>
              </Field>
              <Field label="Scope">
                <Select value={grantTenantId} onChange={(event) => setGrantTenantId(event.target.value)}>
                  <option value="">Platform / all tenants</option>
                  {identityTenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
                </Select>
              </Field>
              <Button className="whitespace-nowrap" onClick={() => void handleAddGrant()} disabled={!selectedUser || !grantPrivilege || replaceUserPrivileges.isPending}>
                Add grant
              </Button>
            </div>
            {selectedUser && (
              <div>
                <div className="hidden grid-cols-[minmax(14rem,1.4fr)_minmax(10rem,1fr)_auto] gap-4 border-b border-hc-outline px-4 py-2 text-xs font-semibold uppercase text-hc-muted md:grid">
                  <div>Privilege</div>
                  <div>Scope</div>
                  <div className="w-16 text-right">Action</div>
                </div>
                {selectedUser.privileges.length === 0 && <div className="px-4 py-6 text-center text-sm text-hc-muted">Selected user has no grants.</div>}
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
          <SectionHeader title="Automation" description="Scheduled feed sync and controlled runtime actions belong here." meta={<StatusBadge>planned</StatusBadge>} />
          <div className="grid border-t border-hc-outline md:grid-cols-3 md:divide-x md:divide-hc-outline">
            <ConfigTile title="Scheduled feed sync" status="planned" detail="Periodic sync for selected catalog sources." />
            <ConfigTile title="Compose runtime manager" status="planned" detail="Start/stop/update app compose bundles with audit." />
            <ConfigTile title="Policy audit" status="planned" detail="Review feed and runtime decisions over time." />
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
  if (users.length === 0) return <div className="border-t border-hc-outline px-4 py-8 text-center text-sm text-hc-muted">No users found.</div>;

  return (
    <Table className="rounded-none border-0 border-t shadow-none">
      <thead><tr><th>Identity</th><th>User ID</th><th>Grants</th><th>Status</th><th className="text-right">Action</th></tr></thead>
      <tbody>{users.map((user) => (
        <tr key={user.id}>
          <td><div className="font-medium">{user.display_name || user.email}</div><div className="text-xs text-hc-muted">{user.email}</div></td>
          <td className="font-mono text-xs">{user.id}</td>
          <td>{user.privileges.length}</td>
          <td><StatusBadge tone={user.status === "active" ? "success" : "neutral"}>{user.status}</StatusBadge></td>
          <td className="text-right"><Button size="sm" variant="ghost" onClick={() => onOpen(user)}>Open</Button></td>
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
  const [email, setEmail] = useState(user.email);
  const [displayName, setDisplayName] = useState(user.display_name ?? "");
  const [status, setStatus] = useState(user.status);
  const [password, setPassword] = useState("");

  return (
    <Card className="overflow-hidden p-0">
      <SectionHeader title={user.display_name || user.email} description={`${user.email} · ${user.id}`} meta={<div className="flex items-center gap-2"><StatusBadge tone={user.status === "active" ? "success" : "neutral"}>{user.status}</StatusBadge><Button size="sm" variant="outlined" onClick={onBack}>Back to users</Button></div>} />
      <div className="grid gap-3 border-t border-hc-outline p-4 md:grid-cols-3">
        <Field label="Email"><Input value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
        <Field label="Display name"><Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Display name" /></Field>
        <Field label="Status"><Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">active</option><option value="disabled">disabled</option></Select></Field>
      </div>
      <div className="flex justify-end border-t border-hc-outline px-4 py-3">
        <Button onClick={() => void onSave({ id: user.id, email: email.trim(), display_name: displayName.trim() || null, status })} disabled={busy || !email.trim()}>Save user</Button>
      </div>
      <div className="grid gap-3 border-t border-hc-outline bg-hc-surface-variant/30 p-4 md:grid-cols-[1fr_auto] md:items-end">
        <Field label="New password" hint="At least eight characters"><Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></Field>
        <Button
          variant="outlined"
          onClick={() => {
            void onPasswordReset(password).then(() => setPassword(""));
          }}
          disabled={busy || password.length < 8}
        >
          Reset password
        </Button>
      </div>
      <div className="border-t border-hc-outline px-4 py-3 text-xs text-hc-muted">Created {new Date(user.created_at).toLocaleString()} · {user.privileges.length} privilege grants</div>
    </Card>
  );
}

function IdentityTenantsTable({ tenants, onOpen }: { tenants: IdentityTenant[]; onOpen: (tenant: IdentityTenant) => void }) {
  if (tenants.length === 0) return <div className="border-t border-hc-outline px-4 py-8 text-center text-sm text-hc-muted">No tenants found.</div>;

  return (
    <Table className="rounded-none border-0 border-t shadow-none">
      <thead><tr><th>Tenant</th><th>Tenant ID</th><th>Primary domain</th><th>Status</th><th className="text-right">Action</th></tr></thead>
      <tbody>{tenants.map((tenant) => (
        <tr key={tenant.id}>
          <td className="font-medium">{tenant.name}</td>
          <td className="font-mono text-xs">{tenant.id}</td>
          <td>{tenant.primary_domain ?? <span className="text-hc-muted">none</span>}</td>
          <td><StatusBadge tone={tenant.status === "active" ? "success" : "neutral"}>{tenant.status}</StatusBadge></td>
          <td className="text-right"><Button size="sm" variant="ghost" onClick={() => onOpen(tenant)}>Open</Button></td>
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
  const [name, setName] = useState(tenant.name);
  const [primaryDomain, setPrimaryDomain] = useState(tenant.primary_domain ?? "");
  const [status, setStatus] = useState(tenant.status);

  return (
    <Card className="overflow-hidden p-0">
      <SectionHeader title={tenant.name} description={tenant.id} meta={<div className="flex items-center gap-2"><StatusBadge tone={tenant.status === "active" ? "success" : "neutral"}>{tenant.status}</StatusBadge><Button size="sm" variant="outlined" onClick={onBack}>Back to tenants</Button></div>} />
      <div className="grid gap-3 border-t border-hc-outline p-4 md:grid-cols-3">
        <Field label="Tenant name"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <Field label="Primary domain"><Input value={primaryDomain} onChange={(event) => setPrimaryDomain(event.target.value)} placeholder="Primary domain" /></Field>
        <Field label="Status"><Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">active</option><option value="disabled">disabled</option></Select></Field>
      </div>
      <div className="flex justify-end border-t border-hc-outline px-4 py-3">
        <Button onClick={() => void onSave({ id: tenant.id, name: name.trim(), primary_domain: primaryDomain.trim() || null, status })} disabled={busy || !name.trim()}>Save tenant</Button>
      </div>
      <div className="border-t border-hc-outline px-4 py-3 text-xs text-hc-muted">Created {new Date(tenant.created_at).toLocaleString()} · Updated {new Date(tenant.updated_at).toLocaleString()}</div>
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
  const definition = catalog.find((item) => item.id === grant.privilege);
  const tenant = tenants.find((item) => item.id === grant.tenant_id);

  return (
    <div className="grid gap-2 border-b border-hc-outline px-4 py-2.5 last:border-b-0 md:grid-cols-[minmax(14rem,1.4fr)_minmax(10rem,1fr)_auto] md:items-center md:gap-4">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{definition?.label ?? "Custom privilege"}</div>
        <div className="truncate font-mono text-xs text-hc-muted">{grant.privilege}</div>
      </div>
      <div>
        <div className="text-sm">{tenant?.name ?? grant.tenant_id ?? "Platform"}</div>
        <div className="text-xs text-hc-muted">{grant.tenant_id ? "Tenant" : "All tenants"}</div>
      </div>
      <Button className="justify-self-start px-2 py-1 text-xs md:w-16 md:justify-self-end" variant="ghost" onClick={onRemove} disabled={busy}>Remove</Button>
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
  const [editingNote, setEditingNote] = useState(item.note ?? "");
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="border-b border-hc-outline last:border-b-0">
      <div className="grid gap-2 px-4 py-2.5 lg:grid-cols-[minmax(15rem,1.4fr)_minmax(10rem,1fr)_7rem_10rem_auto] lg:items-center lg:gap-3">
        <div className="min-w-0 truncate text-sm font-medium" title={item.origin}>{item.origin}</div>
        <div className="min-w-0 truncate text-xs text-hc-muted" title={item.note ?? ""}>{item.note ?? "No note"}</div>
        <StatusBadge tone={item.is_enabled ? "success" : "neutral"}>{item.is_enabled ? "enabled" : "disabled"}</StatusBadge>
        <div className="text-xs text-hc-muted">{new Date(item.created_at).toLocaleDateString()}</div>
        <div className="flex items-center gap-2 lg:justify-end">
          <Switch checked={item.is_enabled} onClick={onToggle} disabled={busy} aria-label={`${item.is_enabled ? "Disable" : "Enable"} ${item.origin}`} />
          <Button size="sm" variant="ghost" onClick={() => setEditing((value) => !value)} disabled={busy}>Edit</Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete((prev) => !prev)} disabled={busy}>Delete</Button>
        </div>
      </div>

      {editing && <div className="grid gap-2 border-t border-hc-outline bg-hc-surface-variant/30 px-4 py-3 md:grid-cols-[1fr_auto]">
        <Input value={editingNote} onChange={(e) => setEditingNote(e.target.value)} placeholder="Note" />
        <Button size="sm" variant="tonal" onClick={() => { onSaveNote(editingNote); setEditing(false); }} disabled={busy}>Save note</Button>
      </div>}

      {confirmDelete && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hc-danger/30 bg-hc-danger/10 px-4 py-3">
          <div className="text-sm text-hc-danger">Delete this trusted origin?</div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" variant="danger" onClick={onDelete} disabled={busy}>
              Confirm delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
