import type { PropsWithChildren } from "react";

import { cn } from "../utils";

type CardProps = PropsWithChildren<{ className?: string }>;

export function Card({ className, children }: CardProps) {
  return (
    <div
      className={cn("rounded-hc-lg bg-hc-surface p-5 shadow-hc-card", className)}
    >
      {children}
    </div>
  );
}
