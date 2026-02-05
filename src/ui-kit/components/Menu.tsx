import { useEffect, useRef } from "react";

import { cn } from "../utils";

type MenuProps = {
  open: boolean;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
};

export function Menu({ open, onClose, className, children }: MenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className={cn(
        "absolute right-0 top-full mt-2 w-56 rounded-hc-lg bg-hc-surface px-2 py-2 shadow-hc-elevation",
        className,
      )}
    >
      {children}
    </div>
  );
}
