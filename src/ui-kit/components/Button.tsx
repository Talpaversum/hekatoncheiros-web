import type { ButtonHTMLAttributes } from "react";

import { cn } from "../utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variantClasses: Record<Variant, string> = {
  primary: "bg-hc-primary text-hc-primary-foreground hover:opacity-90",
  secondary: "bg-hc-surface text-hc-text border border-hc-border hover:border-hc-primary",
  ghost: "bg-transparent text-hc-text hover:bg-white/5",
  danger: "bg-hc-danger text-hc-danger-foreground hover:opacity-90",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "rounded-hc-sm px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-hc-primary",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
