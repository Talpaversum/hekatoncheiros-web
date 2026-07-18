import { useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import {
  developerProjectRequests,
  useDeveloperProjectMutation,
  useDeveloperProjects,
  useDeveloperRuntimeStatus,
  type DeveloperProject,
  type SourceType,
} from "./api";
import { useInstanceCapabilities } from "../../../data/api/capabilities";
import { readErrorMessage } from "../../../data/api/read-error-message";
import { useLocalization } from "../../../localization/LocalizationProvider";
import { Button } from "../../../ui-kit/components/Button";
import { Card } from "../../../ui-kit/components/Card";
import { Input } from "../../../ui-kit/components/Input";
import { EmptyState, Field, PageHeader, SectionHeader, StatusBadge } from "../../../ui-kit/components/Page";
import { Table } from "../../../ui-kit/components/Table";
import { Select } from "../../../ui-kit/components/Select";
import { ToastNotice } from "../../../ui-kit/components/ToastNotice";

const reached = (project: DeveloperProject | undefined, statuses: DeveloperProject["status"][]) => Boolean(project && statuses.includes(project.status));

const developerSections = ["overview", "projects", "deployments", "logs", "connections"] as const;

export function DeveloperToolsPage() {
  const location = useLocation();
  if (location.pathname.endsWith("/add")) return <AddProjectWorkflow />;
  return <DeveloperWorkspace />;
}

function DeveloperWorkspace() {
  const { t } = useLocalization();
  const projects = useDeveloperProjects();
  const location = useLocation();
  const segment = location.pathname.split("/").filter(Boolean).at(-1);
  const active = developerSections.includes(segment as (typeof developerSections)[number]) ? segment : "overview";
  const items = useMemo(() => projects.data?.items ?? [], [projects.data?.items]);
  const latest = items.slice(0, 5);
  const metrics = [
    ["developerProject.metric.projects", items.length],
    ["developerProject.metric.running", items.filter((item) => ["healthy", "running"].includes(item.runtime_status)).length],
    ["developerProject.metric.updates", items.filter((item) => item.update_status === "update_available").length],
    ["developerProject.metric.invalid", items.filter((item) => item.update_status === "validation_failed" || item.status === "source_invalid").length],
    ["developerProject.metric.runtimeErrors", items.filter((item) => item.runtime_status === "error").length],
  ] as const;
  const projectId = location.pathname.match(/\/projects\/([^/]+)$/)?.[1];
  const selected = projectId ? items.find((item) => item.project_id === decodeURIComponent(projectId)) : undefined;

  return <div className="space-y-5">
    <PageHeader eyebrow={t("authorPortal.eyebrow")} title={t("authorPortal.developerTools")} description={t("developerProject.workspaceDescription")} actions={<Link to="/core/developer/add"><Button>{t("developerProject.addProject")}</Button></Link>} />
    <nav className="flex gap-1 overflow-x-auto border-b border-hc-outline" aria-label={t("authorPortal.developerTools")}>
      {developerSections.map((section) => <Link key={section} to={`/core/developer/${section}`} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${active === section ? "border-hc-primary text-hc-text" : "border-transparent text-hc-muted"}`}>{t(`developerProject.section.${section}`)}</Link>)}
    </nav>
    {projects.isLoading ? <Card><EmptyState>{t("common.loading")}</EmptyState></Card> : projectId ? <ProjectSummary project={selected} /> : active === "overview" ? <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{metrics.map(([label, value]) => <Card key={label}><div className="text-xs text-hc-muted">{t(label)}</div><div className="mt-2 text-2xl font-semibold">{value}</div></Card>)}</div>
      <ProjectTable items={latest} title={t("developerProject.recentProjects")} />
      <ProjectTable items={items.filter((item) => item.last_deployment_at).slice(0, 5)} title={t("developerProject.recentDeployments")} />
    </> : active === "projects" ? <ProjectTable items={items} title={t("developerProject.projects")} /> : <Card><SectionHeader title={t(`developerProject.section.${active}`)} /><EmptyState>{t("developerProject.sectionComingSoon")}</EmptyState></Card>}
  </div>;
}

function ProjectTable({ items, title }: { items: DeveloperProject[]; title: string }) {
  const { t } = useLocalization();
  return <Card className="p-0"><SectionHeader title={title} />{items.length ? <Table className="rounded-none border-x-0"><thead><tr><th>{t("developerProject.displayName")}</th><th>{t("developerProject.sourceType")}</th><th>{t("developerProject.validation")}</th><th>{t("developerProject.deploymentStatus")}</th><th>{t("developerProject.runtime")}</th><th>{t("developerProject.lastChanged")}</th><th /></tr></thead><tbody>{items.map((item) => <tr key={item.project_id}><td className="font-medium">{item.display_name}</td><td>{t(`developerProject.source.${item.source_type}`)}</td><td><StatusBadge tone={item.update_status === "validation_failed" ? "danger" : "neutral"}>{t(`developerProject.update.${item.update_status}`)}</StatusBadge></td><td>{item.deployment_status}</td><td>{item.runtime_status}</td><td>{new Date(item.updated_at).toLocaleString()}</td><td><Link className="text-hc-primary" to={`/core/developer/projects/${encodeURIComponent(item.project_id)}`}>{t("developerProject.open")}</Link></td></tr>)}</tbody></Table> : <EmptyState>{t("developerProject.emptyProjects")}</EmptyState>}</Card>;
}

function ProjectSummary({ project }: { project?: DeveloperProject }) {
  const { t } = useLocalization();
  if (!project) return <Card><EmptyState>{t("developerProject.notFound")}</EmptyState></Card>;
  return <div className="space-y-4"><Card><SectionHeader title={project.display_name} description={t("developerProject.projectEntityDescription")} /><dl className="grid gap-3 text-sm md:grid-cols-3"><Item label={t("developerProject.sourceRevision")} value={project.source_revision ?? "-"} /><Item label={t("developerProject.validatedRevision")} value={project.validated_revision ?? "-"} /><Item label={t("developerProject.deployedRevision")} value={project.deployed_revision ?? "-"} /><Item label={t("developerProject.deploymentStatus")} value={project.deployment_status} /><Item label={t("developerProject.runtime")} value={project.runtime_status} /><Item label={t("developerProject.installedApp")} value={project.installed_app_id ?? "-"} /></dl></Card></div>;
}

function AddProjectWorkflow() {
  const { t } = useLocalization();
  const capabilities = useInstanceCapabilities();
  const projects = useDeveloperProjects();
  const [selectedId, setSelectedId] = useState("new");
  const project = selectedId === "new" ? undefined : projects.data?.items.find((item) => item.project_id === selectedId) ?? projects.data?.items[0];
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [originUrl, setOriginUrl] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<SourceType | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [trustConfirmed, setTrustConfirmed] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [runtimeType, setRuntimeType] = useState<DeveloperProject["runtime_type"]>("already_running_service");
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "danger" } | null>(null);

  const createDraft = useDeveloperProjectMutation(developerProjectRequests.createDraft);
  const saveDraft = useDeveloperProjectMutation(developerProjectRequests.saveDraft);
  const testOrigin = useDeveloperProjectMutation(developerProjectRequests.testOrigin);
  const trustOrigin = useDeveloperProjectMutation(developerProjectRequests.trustOrigin);
  const validateSource = useDeveloperProjectMutation(developerProjectRequests.validateSource);
  const install = useDeveloperProjectMutation(developerProjectRequests.install);
  const runtime = useDeveloperRuntimeStatus(project?.project_id ?? "", project?.status === "installed");
  const busy = createDraft.isPending || saveDraft.isPending || testOrigin.isPending || trustOrigin.isPending || validateSource.isPending || install.isPending;

  const effectiveName = displayName ?? project?.display_name ?? "";
  const effectiveOrigin = originUrl ?? project?.origin_url ?? "";
  const effectiveSourceType = sourceType ?? project?.source_type ?? "manifest";
  const effectiveSourceUrl = sourceUrl ?? project?.manifest_url ?? project?.feed_url ?? "";
  const run = async (action: () => Promise<DeveloperProject>, success: string) => {
    setNotice(null);
    try { const result = await action(); setSelectedId(result.project_id); setNotice({ message: success, tone: "success" }); }
    catch (error) { setNotice({ message: readErrorMessage(error), tone: "danger" }); }
  };
  const selectProject = (projectId: string) => { const selectedProject = projects.data?.items.find((item) => item.project_id === projectId); setSelectedId(projectId); setDisplayName(null); setOriginUrl(null); setSourceType(null); setSourceUrl(null); setTrustConfirmed(false); setRuntimeType(selectedProject?.runtime_type ?? "already_running_service"); setWizardStep(selectedProject?.wizard_step ?? 1); };
  const persist = async (nextStep: number) => {
    if (!project || selectedId === "new") {
      const result = await createDraft.mutateAsync({ source_type: effectiveSourceType, display_name: effectiveName || undefined });
      setSelectedId(result.project_id); setWizardStep(nextStep); return result;
    }
    const result = await saveDraft.mutateAsync({ projectId: project.project_id, input: { wizard_step: nextStep, display_name: effectiveName || undefined, origin_url: effectiveOrigin || null, manifest_url: effectiveSourceType === "manifest" ? effectiveSourceUrl || null : null, feed_url: effectiveSourceType === "private_feed" ? effectiveSourceUrl || null : null, runtime_type: runtimeType, wizard_state_json: { trust_confirmed: trustConfirmed } } });
    setWizardStep(nextStep); return result;
  };

  if (capabilities.isLoading || projects.isLoading) return <Card><EmptyState>{t("common.loading")}</EmptyState></Card>;

  const connectivityPassed = reached(project, ["connectivity_ok", "origin_trusted", "source_invalid", "source_valid", "installed"]);
  const originTrusted = reached(project, ["origin_trusted", "source_invalid", "source_valid", "installed"]);
  const sourceValid = reached(project, ["source_valid", "installed"]);
  const selected = project?.manifest_result_json?.selected;
  const manifest = selected?.manifest;
  const integration = manifest?.integration as { slug?: string; api?: { exposes?: { base_path?: string } }; ui?: { nav_entries?: unknown[] } } | undefined;
  const licensing = manifest?.licensing as { required?: boolean; issuer_url?: string } | undefined;

  return <div className="space-y-5">
    <PageHeader eyebrow={t("authorPortal.developerTools")} title={t("developerProject.addProject")} description={t("developerProject.wizardDescription")} actions={<Link to="/core/developer/projects"><Button variant="outlined">{t("developerProject.cancel")}</Button></Link>} />
    {notice && <ToastNotice message={notice.message} tone={notice.tone} onDismiss={() => setNotice(null)} />}
    {projects.data?.items.some((item) => item.status === "draft") && <Field label={t("developerProject.resumeDraft")}><Select value={selectedId} onChange={(event) => selectProject(event.target.value)}><option value="new">{t("developerProject.newProject")}</option>{projects.data.items.filter((item) => item.status === "draft").map((item) => <option key={item.project_id} value={item.project_id}>{item.display_name}</option>)}</Select></Field>}
    <div className="flex gap-1 overflow-x-auto">{Array.from({ length: 10 }, (_, index) => <div key={index} className={`h-1.5 min-w-8 flex-1 ${index + 1 <= wizardStep ? "bg-hc-primary" : "bg-hc-outline"}`} />)}</div>
    {wizardStep === 1 && <Step number={1} title={t("developerProject.wizard.sourceType")} state="active"><Field label={t("developerProject.sourceType")}><Select value={effectiveSourceType} onChange={(event) => setSourceType(event.target.value as SourceType)}>{(["github", "gitlab", "git", "local_workspace", "manifest", "private_feed"] as SourceType[]).map((type) => <option key={type} value={type}>{t(`developerProject.source.${type}`)}</option>)}</Select></Field></Step>}
    {wizardStep === 2 && <Step number={2} title={t("developerProject.wizard.sourceSelection")} state="active"><Field label={t("developerProject.originUrl")}><Input type="url" value={effectiveOrigin} onChange={(event) => setOriginUrl(event.target.value)} /></Field>{["manifest", "private_feed"].includes(effectiveSourceType) ? <Field label={t(effectiveSourceType === "manifest" ? "developerProject.manifestUrl" : "developerProject.feedUrl")}><Input type="url" value={effectiveSourceUrl} onChange={(event) => setSourceUrl(event.target.value)} /></Field> : <EmptyState>{t("developerProject.connectionRequired")}</EmptyState>}</Step>}
    {wizardStep === 3 && <Step number={3} title={t("developerProject.wizard.discovery")} state="active"><Field label={t("developerProject.manifestPath")}><Input value={project?.manifest_path ?? ""} readOnly /></Field><p className="text-sm text-hc-muted">{t("developerProject.discoveryHint")}</p></Step>}
    {wizardStep === 4 && <Step number={4} title={t("developerProject.wizard.details")} state="active"><Field label={t("developerProject.displayName")}><Input value={effectiveName} onChange={(event) => setDisplayName(event.target.value)} /></Field><Link className="text-sm text-hc-primary" to="/core/help">{t("developerProject.specification")}</Link></Step>}
    {wizardStep === 5 && <Step number={5} title={t("developerProject.wizard.runtime")} state="active"><Field label={t("developerProject.runtimeType")}><Select value={runtimeType} onChange={(event) => setRuntimeType(event.target.value as DeveloperProject["runtime_type"])}>{["dockerfile", "docker_compose", "external_runtime", "already_running_service"].map((type) => <option key={type} value={type}>{t(`developerProject.runtimeType.${type}`)}</option>)}</Select></Field></Step>}
    {wizardStep === 6 && <Step number={6} title={t("developerProject.wizard.connectivity")} state="active">{project && effectiveOrigin ? <><Button disabled={busy} onClick={() => void run(() => testOrigin.mutateAsync(project.project_id), t("developerProject.connectivityChecked"))}>{t("developerProject.testOrigin")}</Button>{project.connectivity_result_json && <Result tone={project.connectivity_result_json.reachable ? "success" : "danger"}>{project.connectivity_result_json.reachable ? t("developerProject.httpResult", { status: String(project.connectivity_result_json.status_code), latency: String(project.connectivity_result_json.latency_ms) }) : project.connectivity_result_json.error ?? t("developerProject.connectionFailed")}</Result>}{connectivityPassed && <><p className="text-sm text-hc-danger">{t("developerProject.trustWarning")}</p><label className="flex gap-2 text-sm"><input type="checkbox" checked={trustConfirmed} onChange={(event) => setTrustConfirmed(event.target.checked)} />{t("developerProject.confirmTrust")}</label><Button disabled={busy || !trustConfirmed || originTrusted} onClick={() => void run(() => trustOrigin.mutateAsync(project.project_id), t("developerProject.originTrusted"))}>{t("developerProject.trustOrigin")}</Button></>}</> : <Locked />}</Step>}
    {wizardStep === 7 && <Step number={7} title={t("developerProject.wizard.validation")} state="active">{project && (originTrusted || !["manifest", "private_feed"].includes(effectiveSourceType)) ? <><Button disabled={busy} onClick={() => void run(() => validateSource.mutateAsync(project.project_id), t("developerProject.sourceValidated"))}>{t("developerProject.validateSource")}</Button>{project.manifest_result_json && <Result tone={project.manifest_result_json.valid ? "success" : "danger"}>{project.manifest_result_json.valid ? t("developerProject.validSource") : <ul className="list-disc pl-5">{project.manifest_result_json.errors.map((error) => <li key={error}>{error}</li>)}</ul>}</Result>}</> : <Locked />}</Step>}
    {wizardStep === 8 && <Step number={8} title={t("developerProject.wizard.review")} state="active">{selected ? <dl className="grid gap-2 text-sm md:grid-cols-2"><Item label={t("developerProject.appId")} value={selected.app_id} /><Item label={t("developerProject.appName")} value={selected.app_name} /><Item label={t("developerProject.routes")} value={integration?.api?.exposes?.base_path ?? "-"} /><Item label={t("developerProject.ui")} value={integration?.slug ?? "-"} /><Item label={t("developerProject.runtimeType")} value={t(`developerProject.runtimeType.${runtimeType}`)} /><Item label={t("developerProject.licensing")} value={licensing?.required ? licensing.issuer_url ?? t("developerProject.required") : t("developerProject.notRequired")} /></dl> : <Locked />}</Step>}
    {wizardStep === 9 && <Step number={9} title={t("developerProject.wizard.deploy")} state="active">{project && sourceValid ? <Button disabled={busy || project.status === "installed"} onClick={() => void run(async () => { const result = await install.mutateAsync(project.project_id); setWizardStep(10); return result; }, t("developerProject.installed"))}>{t("developerProject.install")}</Button> : <Locked />}</Step>}
    {wizardStep === 10 && <Step number={10} title={t("developerProject.wizard.result")} state={project?.status === "installed" ? "complete" : "active"}>{project?.status === "installed" ? <><div className="flex gap-2"><StatusBadge tone="warning">{t("developerProject.localUnverified")}</StatusBadge><StatusBadge tone={runtime.data?.runtime.status === "healthy" ? "success" : "neutral"}>{runtime.data?.runtime.status ?? t("common.loading")}</StatusBadge></div><div className="flex gap-3">{runtime.data && <Link className="text-hc-primary" to={runtime.data.open_url}>{t("developerProject.openApplication")}</Link>}<Link className="text-hc-primary" to={`/core/developer/projects/${project.project_id}`}>{t("developerProject.openProject")}</Link></div></> : <Locked />}</Step>}
    <div className="flex flex-wrap justify-between gap-2"><div>{wizardStep > 1 && <Button variant="outlined" disabled={busy} onClick={() => setWizardStep((value) => Math.max(1, value - 1))}>{t("developerProject.back")}</Button>}</div><div className="flex gap-2"><Link to="/core/developer/projects"><Button variant="outlined" disabled={busy} onClick={() => project && void persist(wizardStep)}>{t("developerProject.saveExit")}</Button></Link>{wizardStep < 10 && <Button disabled={busy} onClick={() => void persist(Math.min(10, wizardStep + 1))}>{t("developerProject.next")}</Button>}</div></div>
  </div>;
}

function Step({ number, title, state, children }: { number: number; title: string; state: "active" | "complete" | "locked"; children: ReactNode }) {
  const { t } = useLocalization();
  return <Card className="space-y-4"><div className="-mx-4 -mt-4 flex min-h-12 items-center justify-between gap-3 border-b border-hc-outline px-4 py-3"><h2 className="text-sm font-semibold">{number}. {title}</h2><StatusBadge tone={state === "complete" ? "success" : state === "active" ? "info" : "neutral"}>{t(`developerProject.state.${state}`)}</StatusBadge></div>{children}</Card>;
}

function Locked() { const { t } = useLocalization(); return <p className="text-sm text-hc-muted">{t("developerProject.completePrevious")}</p>; }
function Result({ tone, children }: { tone: "success" | "danger"; children: ReactNode }) { return <div className={`border-l-4 p-3 text-sm ${tone === "success" ? "border-hc-success bg-hc-success/10" : "border-hc-danger bg-hc-danger/10 text-hc-danger"}`}>{children}</div>; }
function Item({ label, value }: { label: string; value: string }) { return <div><dt className="text-hc-muted">{label}</dt><dd className="break-words font-medium">{value}</dd></div>; }
