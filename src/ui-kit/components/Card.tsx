import type { HTMLAttributes } from "react";

import { cn } from "../utils";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn("rounded-hc-md border border-hc-outline bg-hc-surface p-4", className)}
      {...props}
    >
      {children}
    </div>
  );
}
