import type { PropsWithChildren } from "react";
import type { InstanceCapabilities } from "../data/api/author-portal";
import { useInstanceCapabilities } from "../data/api/capabilities";
import { useLocalization } from "../localization/LocalizationProvider";
import { Card } from "../ui-kit/components/Card";
import { EmptyState } from "../ui-kit/components/Page";

export function RequireCapability({ capability, children }: PropsWithChildren<{ capability: keyof InstanceCapabilities }>) {
  const { t } = useLocalization(); const query = useInstanceCapabilities(); const state = query.data?.[capability];
  if (query.isLoading) return <Card><EmptyState>{t("common.loading")}</EmptyState></Card>;
  if (!state?.available) return <Card><EmptyState>{t("authorPortal.capabilityUnavailable")}</EmptyState></Card>;
  return children;
}
