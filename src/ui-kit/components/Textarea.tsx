import type { TextareaHTMLAttributes } from "react";

import { cn } from "../utils";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  hasError?: boolean;
};

export function Textarea({ hasError, className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "w-full resize-y rounded-hc-md border border-hc-outline bg-hc-surface px-3 py-2 text-sm text-hc-text placeholder:text-hc-muted",
        "focus:border-hc-primary focus:outline-none focus:ring-2 focus:ring-hc-primary/30",
        hasError ? "border-hc-danger" : "",
        className,
      )}
      {...props}
    />
  );
}
