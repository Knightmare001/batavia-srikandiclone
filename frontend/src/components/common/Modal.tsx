import type { ReactNode } from "react";
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className="modal" role="dialog" aria-modal="true">
        <header className="modal-header">
          <h2>{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            data-tooltip="Tutup"
            aria-label="Tutup"
          >
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
