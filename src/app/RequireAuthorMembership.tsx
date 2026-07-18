import type { PropsWithChildren } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAuthorOverview } from "../data/api/author-portal";
import { useLocalization } from "../localization/LocalizationProvider";
import { Card } from "../ui-kit/components/Card";
import { EmptyState } from "../ui-kit/components/Page";

export function RequireAuthorMembership({ children }: PropsWithChildren) {
  const { t } = useLocalization(); const overview = useAuthorOverview(); const { authorId } = useParams();
  if (overview.isLoading) return <Card><EmptyState>{t("common.loading")}</EmptyState></Card>;
  if (!overview.data?.profiles.some((profile) => profile.author_id === authorId)) return <Navigate to="/core/developer" replace />;
  return children;
}
