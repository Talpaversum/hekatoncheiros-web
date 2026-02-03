import type { InputHTMLAttributes } from "react";

import { cn } from "../utils";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  hasError?: boolean;
};

export function Input({ hasError, className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "w-full rounded-hc-sm border border-hc-border bg-transparent px-3 py-2 text-sm text-hc-text placeholder:text-hc-muted",
        "focus:border-hc-primary focus:outline-none focus:ring-2 focus:ring-hc-primary/40",
        hasError ? "border-hc-danger" : "",
        className,
      )}
      {...props}
    />
  );
}
