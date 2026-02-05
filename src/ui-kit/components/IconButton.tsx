import type { ButtonHTMLAttributes } from "react";

import { cn } from "../utils";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "tonal" | "ghost";
};

const variantClasses: Record<NonNullable<IconButtonProps["variant"]>, string> = {
  default: "bg-hc-surface text-hc-text hover:bg-hc-surface-variant",
  tonal: "bg-hc-surface-variant text-hc-text hover:bg-hc-surface",
  ghost: "bg-transparent text-hc-text hover:bg-hc-surface-variant/60",
};

export function IconButton({ variant = "ghost", className, ...props }: IconButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-hc-primary/40",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
