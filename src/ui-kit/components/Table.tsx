import type { PropsWithChildren } from "react";

import { cn } from "../utils";

type TableProps = PropsWithChildren<{ className?: string }>;

export function Table({ className, children }: TableProps) {
  return (
    <div className={cn("w-full overflow-x-auto rounded-hc-md border border-hc-outline bg-hc-surface", className)}>
      <table className="w-full border-collapse text-left text-sm [&_tbody_tr]:border-t [&_tbody_tr]:border-hc-outline [&_td]:px-4 [&_td]:py-2.5 [&_th]:bg-hc-surface-variant/40 [&_th]:px-4 [&_th]:py-2 [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:text-hc-muted">{children}</table>
    </div>
  );
}
