import type { PropsWithChildren } from "react";

type TopBarProps = PropsWithChildren<{ title: string; meta?: string }>
;

export function TopBar({ title, meta, children }: TopBarProps) {
  return (
    <div className="mb-4 flex items-center justify-between border-b border-hc-outline bg-hc-surface px-4 py-3">
      <div>
        <div className="text-sm text-hc-muted">{meta}</div>
        <div className="text-lg font-semibold">{title}</div>
      </div>
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
}
