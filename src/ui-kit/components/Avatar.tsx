import type { HTMLAttributes } from "react";

import { cn } from "../utils";

type AvatarProps = HTMLAttributes<HTMLDivElement> & {
  initials?: string;
};

export function Avatar({ initials = "U", className, ...props }: AvatarProps) {
  return (
    <div
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full bg-hc-primary text-sm font-semibold text-hc-on-primary",
        className,
      )}
      {...props}
    >
      {initials}
    </div>
  );
}
