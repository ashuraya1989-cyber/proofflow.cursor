import React, { useEffect } from "react";

export function Modal({
  open,
  title,
  onClose,
  children
}: {
  open: boolean;
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="pf-modalOverlay" onMouseDown={onClose} role="dialog" aria-modal="true">
      <div className="pf-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pf-modalHeader">
          <div style={{ fontWeight: 600, fontSize: 13 }}>{title}</div>
          <button className="pf-btn pf-btn--ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="pf-modalBody">{children}</div>
      </div>
    </div>
  );
}

