import { cn } from "../utils";

export type TabItem<T extends string> = {
  id: T;
  label: string;
  count?: number;
};

export function TabBar<T extends string>({ items, active, onChange, className }: { items: TabItem<T>[]; active: T; onChange: (id: T) => void; className?: string }) {
  return (
    <div className={cn("flex gap-1 overflow-x-auto border-b border-hc-outline", className)} role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={active === item.id}
          className={cn(
            "inline-flex min-h-9 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-1.5 text-sm font-medium transition",
            active === item.id ? "border-hc-primary text-hc-text" : "border-transparent text-hc-muted hover:text-hc-text",
          )}
          onClick={() => onChange(item.id)}
        >
          {item.label}
          {item.count !== undefined && <span className="rounded-hc-sm bg-hc-surface-variant px-1.5 py-0.5 text-xs text-hc-muted">{item.count}</span>}
        </button>
      ))}
    </div>
  );
}
