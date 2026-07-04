import type { SelectHTMLAttributes } from "react";

import { cn } from "../utils";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  hasError?: boolean;
};

export function Select({ hasError, className, children, ...props }: SelectProps) {
  return (
    <div className="relative w-full">
      <select
        className={cn(
          "w-full appearance-none rounded-hc-md border border-hc-outline bg-hc-surface px-3 py-2 pr-9 text-sm text-hc-text shadow-sm",
          "focus:border-hc-primary focus:outline-none focus:ring-2 focus:ring-hc-primary/30",
          "disabled:cursor-not-allowed disabled:opacity-60",
          "[&>option]:bg-hc-surface [&>option]:text-hc-text",
          hasError ? "border-hc-danger" : "",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 h-0 w-0 -translate-y-1/2 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-hc-muted" />
    </div>
  );
}
