import type { ButtonHTMLAttributes } from "react";

import { cn } from "../utils";

type Variant = "filled" | "tonal" | "outlined" | "ghost" | "danger";

const variantClasses: Record<Variant, string> = {
  filled: "bg-hc-primary text-hc-on-primary hover:brightness-95",
  tonal: "bg-hc-surface-variant text-hc-text hover:bg-hc-surface",
  outlined: "border border-hc-outline text-hc-text hover:border-hc-primary",
  ghost: "bg-transparent text-hc-text hover:bg-hc-surface-variant/60",
  danger: "bg-hc-danger text-hc-on-danger hover:brightness-95",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md";
};

export function Button({ variant = "filled", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-hc-md text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-hc-primary/40 disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "min-h-8 px-2.5 py-1 text-xs" : "min-h-9 px-3 py-1.5",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
