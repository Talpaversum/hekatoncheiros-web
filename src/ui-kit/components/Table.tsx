import type { PropsWithChildren } from "react";

import { cn } from "../utils";

type TableProps = PropsWithChildren<{ className?: string }>;

export function Table({ className, children }: TableProps) {
  return (
    <div className={cn("w-full overflow-hidden rounded-hc-md border border-hc-border", className)}>
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  );
}
