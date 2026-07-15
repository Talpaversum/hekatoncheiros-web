import type { PropsWithChildren } from "react";

import { hasPrivilege } from "../access/privileges";
import { useContextQuery } from "../data/api/context";
import { useLocalization } from "../localization/LocalizationProvider";
import { Card } from "../ui-kit/components/Card";

type RequirePrivilegeProps = PropsWithChildren<{
  required: string;
}>;

export function RequirePrivilege({ required, children }: RequirePrivilegeProps) {
  const { data, isLoading } = useContextQuery(true);
  const { t } = useLocalization();

  if (isLoading) {
    return (
      <Card>
        <div className="text-lg font-semibold">{t("access.loading")}</div>
      </Card>
    );
  }

  const privileges = data?.privileges ?? [];
  if (!hasPrivilege(privileges, required)) {
    return (
      <Card>
        <div className="text-lg font-semibold">{t("access.forbidden")}</div>
        <div className="mt-2 text-sm text-hc-muted">{t("access.denied")}</div>
      </Card>
    );
  }

  return <>{children}</>;
}
