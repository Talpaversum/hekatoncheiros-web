import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

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
import { Switch } from "../../ui-kit/components/Switch";

function StatusBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-hc-sm border border-hc-outline bg-hc-surface-variant px-2 py-1 text-xs text-hc-muted">
      {children}
    </span>
  );
}

export function PlatformConfigPage() {
  const location = useLocation();
  const section = location.pathname.split("/").pop() ?? "";
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
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const origins = data?.items ?? [];
  const identityUsers = identityUsersData?.items ?? [];
  const identityTenants = identityTenantsData?.items ?? [];
  const privilegeCatalog = privilegeCatalogData?.items ?? [];
  const effectiveInstanceName = instanceName ?? platformInstance?.name ?? "";
  const effectivePublicBaseUrl = publicBaseUrl ?? platformInstance?.public_base_url ?? "";
  const selectedUser = identityUsers.find((item) => item.id === selectedUserId) ?? identityUsers[0];

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
      setSelectedUserId(created.id);
      setMessage("User was created.");
    } catch (err) {
      setError(readErrorMessage(err));
    }
  };

  const handleCreateTenant = async () => {
    setMessage(null);
    setError(null);
    try {
      await createTenant.mutateAsync({
        id: newTenantId.trim(),
        name: newTenantName.trim(),
        primary_domain: newTenantDomain.trim() || null,
        status: "active",
      });
      setNewTenantId("");
      setNewTenantName("");
      setNewTenantDomain("");
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
    <div className="space-y-5">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-wide text-hc-muted">Configuration</div>
        <div className="mt-1 text-2xl font-semibold">Platform configuration</div>
        <div className="mt-1 text-sm text-hc-muted">Instance-wide controls for trust, app distribution, and platform governance.</div>
      </div>

      {message && <div className="rounded-hc-md border border-hc-success/25 bg-hc-success/10 px-4 py-3 text-sm text-hc-success">{message}</div>}
      {error && <div className="rounded-hc-md border border-hc-danger/30 bg-hc-danger/10 px-4 py-3 text-sm text-hc-danger">{error}</div>}

      {(section === "platform" || section === "") && <section className="grid gap-4 lg:grid-cols-4">
        <Card className="rounded-hc-md">
          <div className="text-sm font-semibold">Trusted origins</div>
          <div className="mt-3 text-2xl font-semibold">{origins.length}</div>
          <div className="mt-1 text-xs text-hc-muted">Origins allowed for local/dev HTTP app metadata.</div>
        </Card>
        <Card className="rounded-hc-md">
          <div className="text-sm font-semibold">Instance</div>
          <div className="mt-3 text-2xl font-semibold">{platformInstance?.name ?? "Core"}</div>
          <div className="mt-1 text-xs text-hc-muted">{platformInstance?.instance_id ?? "Loading..."}</div>
        </Card>
        <Card className="rounded-hc-md">
          <div className="text-sm font-semibold">Users</div>
          <div className="mt-3 text-2xl font-semibold">{identityUsers.length}</div>
          <div className="mt-1 text-xs text-hc-muted">Platform identities known to Core.</div>
        </Card>
        <Card className="rounded-hc-md">
          <div className="text-sm font-semibold">Tenants</div>
          <div className="mt-3 text-2xl font-semibold">{identityTenants.length}</div>
          <div className="mt-1 text-xs text-hc-muted">Tenant records managed by the platform.</div>
        </Card>
        <Card className="rounded-hc-md">
          <div className="text-sm font-semibold">Feed export</div>
          <div className="mt-3 text-2xl font-semibold">Active</div>
          <div className="mt-1 text-xs text-hc-muted">Public feed is served from `/.well-known/hc/app-catalog.json`.</div>
        </Card>
        <Card className="rounded-hc-md">
          <div className="text-sm font-semibold">Publish tokens</div>
          <div className="mt-3 text-2xl font-semibold">Planned</div>
          <div className="mt-1 text-xs text-hc-muted">Future pre-approval for trusted submitters and CI.</div>
        </Card>
        <Card className="rounded-hc-md">
          <div className="text-sm font-semibold">Tenant mode</div>
          <div className="mt-3 text-2xl font-semibold">Core-owned</div>
          <div className="mt-1 text-xs text-hc-muted">Configured by deployment and backend policy.</div>
        </Card>
      </section>}

      <div className="grid gap-4">
        {section === "instance" && <Card className="rounded-hc-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Platform instance</div>
              <div className="mt-2 text-xs text-hc-muted">Public identity used by feeds, operators, and future trust metadata.</div>
            </div>
            <StatusBadge>active</StatusBadge>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-hc-muted">Instance name</label>
              <Input value={effectiveInstanceName} onChange={(event) => setInstanceName(event.target.value)} />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-hc-muted">Public base URL</label>
              <Input value={effectivePublicBaseUrl} onChange={(event) => setPublicBaseUrl(event.target.value)} placeholder="https://core.example.com" />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => void handleSaveInstance()} disabled={!effectiveInstanceName.trim() || updatePlatformInstance.isPending}>
              Save instance
            </Button>
          </div>
        </Card>}

        {section === "trusted-origins" && <Card className="rounded-hc-md">
          <div className="text-sm font-semibold">Trusted install origins</div>
          <div className="mt-2 text-xs text-hc-muted">
            Exact-match allowlist originů (scheme+host+port) pro install/fetch manifest.
          </div>

          <div className="mt-4 grid gap-3 rounded-hc-md border border-hc-outline p-3">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-wide text-hc-muted">Origin</label>
              <Input placeholder="http://127.0.0.1:4010" value={origin} onChange={(e) => setOrigin(e.target.value)} />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-wide text-hc-muted">Poznámka</label>
              <Input placeholder="Local inventory app" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            {httpOriginDetected && (
              <label className="flex items-center gap-2 text-sm text-hc-danger">
                <input type="checkbox" checked={allowHttp} onChange={(e) => setAllowHttp(e.target.checked)} />
                Allow HTTP for this origin (unsecured transport)
              </label>
            )}

            <div className="flex justify-end">
              <Button onClick={() => void handleCreate()} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Adding…" : "Add trusted origin"}
              </Button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {isLoading && <div className="text-sm text-hc-muted">Načítám trusted origins…</div>}
            {!isLoading && origins.length === 0 && <div className="text-sm text-hc-muted">Žádné trusted origins.</div>}

            {origins.map((item) => (
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

          {message && <div className="mt-3 text-sm text-hc-primary">{message}</div>}
          {error && <div className="mt-3 text-sm text-hc-danger">{error}</div>}
        </Card>}

        {section === "app-distribution" && <Card className="rounded-hc-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">App distribution governance</div>
              <div className="mt-2 text-xs text-hc-muted">
                Catalog feed import/export is managed in Applications. This platform area owns the policy around it.
              </div>
            </div>
            <StatusBadge>partly active</StatusBadge>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <ConfigTile title="Public feed" status="active" detail="Only admin-published installed apps are exported." />
            <ConfigTile title="Publish requests" status="planned" detail="User/developer proposals awaiting admin approval." />
            <ConfigTile title="Publish tokens" status="planned" detail="Admin-issued pre-approval for namespaces, apps, or CI pipelines." />
          </div>
        </Card>}

        {section === "identity" && <div className="grid gap-4">
          <Card className="rounded-hc-md">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Users</div>
                <div className="mt-2 text-xs text-hc-muted">Create platform users, edit basic fields, and reset passwords.</div>
              </div>
              <StatusBadge>{identityUsers.length} users</StatusBadge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <Input placeholder="usr_jana" value={newUserId} onChange={(event) => setNewUserId(event.target.value)} />
              <Input placeholder="jana@example.com" value={newUserEmail} onChange={(event) => setNewUserEmail(event.target.value)} />
              <Input placeholder="Display name" value={newUserName} onChange={(event) => setNewUserName(event.target.value)} />
              <Input type="password" placeholder="Initial password" value={newUserPassword} onChange={(event) => setNewUserPassword(event.target.value)} />
              <Button onClick={() => void handleCreateUser()} disabled={createUser.isPending || !newUserId.trim() || !newUserEmail.trim() || newUserPassword.length < 8}>
                Create user
              </Button>
            </div>
            <div className="mt-4 grid gap-3">
              {identityUsers.map((user) => (
                <IdentityUserRow
                  key={user.id}
                  user={user}
                  onSelect={() => setSelectedUserId(user.id)}
                  selected={selectedUser?.id === user.id}
                  onSave={(payload) => updateUser.mutateAsync(payload)}
                  onPasswordReset={(password) => resetPassword.mutateAsync({ id: user.id, password })}
                  busy={updateUser.isPending || resetPassword.isPending}
                />
              ))}
            </div>
          </Card>

          <Card className="rounded-hc-md">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Tenants</div>
                <div className="mt-2 text-xs text-hc-muted">Manage tenant records and primary domains.</div>
              </div>
              <StatusBadge>{identityTenants.length} tenants</StatusBadge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <Input placeholder="tnt_partner" value={newTenantId} onChange={(event) => setNewTenantId(event.target.value)} />
              <Input placeholder="Tenant name" value={newTenantName} onChange={(event) => setNewTenantName(event.target.value)} />
              <Input placeholder="primary.example.com" value={newTenantDomain} onChange={(event) => setNewTenantDomain(event.target.value)} />
              <Button onClick={() => void handleCreateTenant()} disabled={createTenant.isPending || !newTenantId.trim() || !newTenantName.trim()}>
                Create tenant
              </Button>
            </div>
            <div className="mt-4 grid gap-3">
              {identityTenants.map((tenant) => (
                <IdentityTenantRow key={tenant.id} tenant={tenant} onSave={(payload) => updateTenant.mutateAsync(payload)} busy={updateTenant.isPending} />
              ))}
            </div>
          </Card>

          <Card className="rounded-hc-md">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">RBAC grants</div>
                <div className="mt-2 text-xs text-hc-muted">Assign platform-scoped and tenant-scoped privileges directly to users.</div>
              </div>
              <StatusBadge>{privilegeCatalog.length} privileges</StatusBadge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <select className="rounded-hc-md border border-hc-outline bg-transparent px-3 py-2 text-sm text-hc-text" value={selectedUser?.id ?? ""} onChange={(event) => setSelectedUserId(event.target.value)}>
                {identityUsers.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}
              </select>
              <select className="rounded-hc-md border border-hc-outline bg-transparent px-3 py-2 text-sm text-hc-text" value={grantPrivilege} onChange={(event) => setGrantPrivilege(event.target.value)}>
                <option value="">Select privilege</option>
                {privilegeCatalog.map((privilege) => <option key={privilege.id} value={privilege.id}>{privilege.id}</option>)}
              </select>
              <select className="rounded-hc-md border border-hc-outline bg-transparent px-3 py-2 text-sm text-hc-text" value={grantTenantId} onChange={(event) => setGrantTenantId(event.target.value)}>
                <option value="">Platform / all tenants</option>
                {identityTenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
              </select>
              <Button onClick={() => void handleAddGrant()} disabled={!selectedUser || !grantPrivilege || replaceUserPrivileges.isPending}>
                Add grant
              </Button>
            </div>
            {selectedUser && (
              <div className="mt-4 grid gap-2">
                {selectedUser.privileges.length === 0 && <div className="text-sm text-hc-muted">Selected user has no grants.</div>}
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
          </Card>
        </div>}

        {section === "automation" && <Card className="rounded-hc-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Automation</div>
              <div className="mt-2 text-xs text-hc-muted">Scheduled feed sync and controlled runtime actions belong here.</div>
            </div>
            <StatusBadge>planned</StatusBadge>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
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
    <div className="rounded-hc-md border border-hc-outline bg-hc-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">{title}</div>
        <StatusBadge>{status}</StatusBadge>
      </div>
      <div className="mt-2 text-xs text-hc-muted">{detail}</div>
    </div>
  );
}

function IdentityUserRow({
  user,
  selected,
  onSelect,
  onSave,
  onPasswordReset,
  busy,
}: {
  user: IdentityUser;
  selected: boolean;
  onSelect: () => void;
  onSave: (payload: { id: string; email?: string; display_name?: string | null; status?: string }) => Promise<unknown>;
  onPasswordReset: (password: string) => Promise<unknown>;
  busy: boolean;
}) {
  const [email, setEmail] = useState(user.email);
  const [displayName, setDisplayName] = useState(user.display_name ?? "");
  const [status, setStatus] = useState(user.status);
  const [password, setPassword] = useState("");

  return (
    <div className={`rounded-hc-md border p-3 ${selected ? "border-hc-primary bg-hc-primary/5" : "border-hc-outline"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="text-left" onClick={onSelect}>
          <div className="text-sm font-semibold">{user.id}</div>
          <div className="mt-1 text-xs text-hc-muted">{user.privileges.length} privilege grants</div>
        </button>
        <StatusBadge>{user.status}</StatusBadge>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-5">
        <Input value={email} onChange={(event) => setEmail(event.target.value)} />
        <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Display name" />
        <select className="rounded-hc-md border border-hc-outline bg-transparent px-3 py-2 text-sm text-hc-text" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="active">active</option>
          <option value="disabled">disabled</option>
        </select>
        <Button variant="tonal" onClick={() => void onSave({ id: user.id, email: email.trim(), display_name: displayName.trim() || null, status })} disabled={busy || !email.trim()}>
          Save
        </Button>
        <Button variant="outlined" onClick={onSelect}>Manage grants</Button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
        <Input type="password" placeholder="New password" value={password} onChange={(event) => setPassword(event.target.value)} />
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
    </div>
  );
}

function IdentityTenantRow({
  tenant,
  onSave,
  busy,
}: {
  tenant: IdentityTenant;
  onSave: (payload: { id: string; name?: string; primary_domain?: string | null; status?: string }) => Promise<unknown>;
  busy: boolean;
}) {
  const [name, setName] = useState(tenant.name);
  const [primaryDomain, setPrimaryDomain] = useState(tenant.primary_domain ?? "");
  const [status, setStatus] = useState(tenant.status);

  return (
    <div className="rounded-hc-md border border-hc-outline p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{tenant.id}</div>
          <div className="mt-1 text-xs text-hc-muted">Created {new Date(tenant.created_at).toLocaleString()}</div>
        </div>
        <StatusBadge>{tenant.status}</StatusBadge>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <Input value={name} onChange={(event) => setName(event.target.value)} />
        <Input value={primaryDomain} onChange={(event) => setPrimaryDomain(event.target.value)} placeholder="Primary domain" />
        <select className="rounded-hc-md border border-hc-outline bg-transparent px-3 py-2 text-sm text-hc-text" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="active">active</option>
          <option value="disabled">disabled</option>
        </select>
        <Button variant="tonal" onClick={() => void onSave({ id: tenant.id, name: name.trim(), primary_domain: primaryDomain.trim() || null, status })} disabled={busy || !name.trim()}>
          Save tenant
        </Button>
      </div>
    </div>
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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-hc-md border border-hc-outline p-3">
      <div>
        <div className="text-sm font-semibold">{grant.privilege}</div>
        <div className="mt-1 text-xs text-hc-muted">{definition?.label ?? "Custom privilege"} · {tenant?.name ?? grant.tenant_id ?? "platform"}</div>
      </div>
      <Button variant="ghost" onClick={onRemove} disabled={busy}>Remove</Button>
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
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="rounded-hc-md border border-hc-outline p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">{item.origin}</div>
          <div className="mt-1 text-xs text-hc-muted">Created {new Date(item.created_at).toLocaleString()}</div>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={item.is_enabled} onClick={onToggle} disabled={busy} />
          <Button variant="outlined" onClick={() => setConfirmDelete((prev) => !prev)} disabled={busy}>
            Delete
          </Button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Input value={editingNote} onChange={(e) => setEditingNote(e.target.value)} placeholder="Note" />
        <Button variant="tonal" onClick={() => onSaveNote(editingNote)} disabled={busy}>
          Save note
        </Button>
      </div>

      {confirmDelete && (
        <div className="mt-3 rounded-hc-sm border border-hc-danger/30 bg-hc-danger/10 p-3">
          <div className="text-sm text-hc-danger">Confirm delete trusted origin?</div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={onDelete} disabled={busy}>
              Confirm delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
