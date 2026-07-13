import type { InputHTMLAttributes } from "react";

import { cn } from "../utils";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  hasError?: boolean;
};

export function Input({ hasError, className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-hc-md border border-hc-outline bg-hc-surface px-3 text-sm text-hc-text placeholder:text-hc-muted",
        "focus:border-hc-primary focus:outline-none focus:ring-2 focus:ring-hc-primary/30",
        hasError ? "border-hc-danger" : "",
        className,
      )}
      {...props}
    />
  );
}
