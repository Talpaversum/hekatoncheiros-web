import type { PropsWithChildren } from "react";

import { hasPrivilege } from "../access/privileges";
import { useContextQuery } from "../data/api/context";
import { Card } from "../ui-kit/components/Card";

type RequirePrivilegeProps = PropsWithChildren<{
  required: string;
}>;

export function RequirePrivilege({ required, children }: RequirePrivilegeProps) {
  const { data, isLoading } = useContextQuery(true);

  if (isLoading) {
    return (
      <Card>
        <div className="text-lg font-semibold">Načítám oprávnění…</div>
      </Card>
    );
  }

  const privileges = data?.privileges ?? [];
  if (!hasPrivilege(privileges, required)) {
    return (
      <Card>
        <div className="text-lg font-semibold">403 Forbidden</div>
        <div className="mt-2 text-sm text-hc-muted">Nemáš oprávnění pro zobrazení této stránky.</div>
      </Card>
    );
  }

  return <>{children}</>;
}
