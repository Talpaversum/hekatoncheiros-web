import type { ReactNode } from "react";

import { cn } from "../utils";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <div className="text-xs font-medium uppercase text-hc-muted">{eyebrow}</div>}
        <h1 className="mt-1 text-xl font-semibold">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-hc-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

type SectionHeaderProps = {
  title: string;
  description?: string;
  meta?: ReactNode;
  className?: string;
};

export function SectionHeader({ title, description, meta, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 px-4 py-3", className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-hc-muted">{description}</p>}
      </div>
      {meta && <div className="shrink-0">{meta}</div>}
    </div>
  );
}

export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("grid min-w-0 gap-1", className)}>
      <span className="text-xs font-medium text-hc-muted">{label}</span>
      {children}
      {error ? <span className="text-xs text-hc-danger">{error}</span> : hint && <span className="text-xs text-hc-muted">{hint}</span>}
    </label>
  );
}

export function StatusBadge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "info"; className?: string }) {
  const tones = {
    neutral: "border-hc-outline bg-hc-surface-variant text-hc-muted",
    success: "border-hc-success/30 bg-hc-success/10 text-hc-success",
    warning: "border-hc-warning/30 bg-hc-warning/10 text-hc-warning",
    danger: "border-hc-danger/30 bg-hc-danger/10 text-hc-danger",
    info: "border-hc-primary/30 bg-hc-primary/10 text-hc-primary",
  };

  return <span className={cn("inline-flex rounded-hc-sm border px-2 py-1 text-xs font-medium", tones[tone], className)}>{children}</span>;
}

export type Metric = {
  label: string;
  value: ReactNode;
  detail?: string;
  tone?: "neutral" | "success" | "warning" | "danger";
};

export function MetricStrip({ items, className }: { items: Metric[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {items.map((item) => {
        const tone = {
          neutral: "border-hc-outline",
          success: "border-hc-success/35",
          warning: "border-hc-warning/35",
          danger: "border-hc-danger/35",
        }[item.tone ?? "neutral"];

        return (
          <div key={item.label} className={cn("min-w-24 rounded-hc-md border bg-hc-surface px-3 py-2 text-right", tone)} title={item.detail}>
            <div className="text-base font-semibold leading-5">{item.value}</div>
            <div className="mt-0.5 text-xs text-hc-muted">{item.label}</div>
          </div>
        );
      })}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="px-4 py-8 text-center text-sm text-hc-muted">{children}</div>;
}
