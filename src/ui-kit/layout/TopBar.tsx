import type { PropsWithChildren } from "react";

type TopBarProps = PropsWithChildren<{ title: string; meta?: string }>
;

export function TopBar({ title, meta, children }: TopBarProps) {
  return (
    <div className="mb-6 flex items-center justify-between rounded-hc-md border border-hc-border bg-hc-surface px-6 py-4">
      <div>
        <div className="text-sm text-hc-muted">{meta}</div>
        <div className="text-lg font-semibold">{title}</div>
      </div>
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
}
