import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { Button } from "./Button";

type ToastNoticeProps = {
  message: string | null;
  tone?: "success" | "danger";
  onDismiss: () => void;
  timeoutMs?: number;
};

export function ToastNotice({ message, tone = "success", onDismiss, timeoutMs = 4500 }: ToastNoticeProps) {
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timeout = window.setTimeout(() => onDismissRef.current(), timeoutMs);
    return () => window.clearTimeout(timeout);
  }, [message, timeoutMs]);

  if (!message) {
    return null;
  }

  const toneClasses =
    tone === "danger"
      ? "border-hc-danger/35 bg-hc-danger/10 text-hc-danger"
      : "border-hc-success/30 bg-hc-success/10 text-hc-success";

  return createPortal(
    <div className="fixed right-4 top-20 z-50 w-[min(420px,calc(100vw-2rem))]">
      <div className={`rounded-hc-md border px-4 py-3 shadow-lg backdrop-blur ${toneClasses}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm font-medium leading-5">{message}</div>
          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={onDismiss}>
            Close
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
