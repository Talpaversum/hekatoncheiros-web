import type { PropsWithChildren } from "react";

type PageLayoutProps = PropsWithChildren<{ className?: string }>;

export function PageLayout({ className, children }: PageLayoutProps) {
  return <div className={`min-h-screen bg-hc-bg text-hc-text ${className ?? ""}`}>{children}</div>;
}
