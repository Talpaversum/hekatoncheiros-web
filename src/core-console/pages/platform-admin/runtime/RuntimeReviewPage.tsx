import { useLocalization } from "../../../../localization/LocalizationProvider";
import { Button } from "../../../../ui-kit/components/Button";
import { Card } from "../../../../ui-kit/components/Card";
import { EmptyState, PageHeader, SectionHeader, StatusBadge } from "../../../../ui-kit/components/Page";
import { Table } from "../../../../ui-kit/components/Table";
import { authorPortalRequests, useAuthorApps, useAuthorPortalMutation } from "./api";

export function RuntimeReviewPage() { const { t } = useLocalization(); const query = useAuthorApps("runtime", ""); const mutation = useAuthorPortalMutation(authorPortalRequests.appAction); const items = query.data?.items.filter((item) => item.runtime_management === "talpaversum_managed") ?? []; return <div className="space-y-5"><PageHeader eyebrow={t("nav.platformSettings")} title={t("authorPortal.runtime")} description={t("authorPortal.reviewRuntimePlan")} /><Card className="p-0"><SectionHeader title={t("authorPortal.runtime")} />{items.length ? <Table className="rounded-none border-x-0"><tbody>{items.map((item) => <tr key={item.author_app_id}><td>{item.display_name}</td><td><StatusBadge>{t(`authorPortal.status.${item.status}`)}</StatusBadge></td><td>{item.status === "runtime_pending" && <Button size="sm" onClick={() => mutation.mutate({ appId: item.author_app_id, action: "approve_runtime" })}>{t("authorPortal.approveRuntime")}</Button>}</td></tr>)}</tbody></Table> : <EmptyState>{t("authorPortal.noApplications")}</EmptyState>}</Card></div>; }
