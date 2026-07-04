import type { HTMLAttributes } from "react";

import { cn } from "../utils";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn("rounded-hc-lg bg-hc-surface p-5 shadow-hc-card", className)}
      {...props}
    >
      {children}
    </div>
  );
}
