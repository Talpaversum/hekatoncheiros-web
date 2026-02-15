import { useEffect, type MouseEvent, type ReactNode } from "react";

type DialogProps = {
  open: boolean;
  title?: string;
  disableClose?: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function Dialog({ open, title, disableClose = false, onClose, children }: DialogProps) {
  useEffect(() => {
    if (!open || disableClose) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disableClose, onClose, open]);

  if (!open) {
    return null;
  }

  const handleBackdropClick = () => {
    if (!disableClose) {
      onClose();
    }
  };

  const handlePanelClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={handleBackdropClick}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "Dialog"}
        className="w-full max-w-xl rounded-hc-md border border-hc-outline bg-hc-surface p-5 shadow-2xl"
        onClick={handlePanelClick}
      >
        {children}
      </div>
    </div>
  );
}
