import type { ReactNode, MouseEvent } from "react";
import Button from "@/components/ui/Button";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { reportModalBackdrop, reportModalPanel } from "../reportStyles";
import { R } from "../uiLabels";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export default function EditableModal({ open, title, onClose, children, footer }: Props) {
  if (!open) return null;

  const stop = (e: MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <ModalPortal>
      <div
        style={reportModalBackdrop}
        role="presentation"
        data-testid="report-editable-modal-backdrop"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          style={reportModalPanel}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          data-testid="report-editable-modal-panel"
          onClick={stop}
          onMouseDown={stop}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
            <Button type="button" variant="ghost" onClick={onClose}>
              {R.fechar}
            </Button>
          </div>
          {children}
          {footer ? (
            <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </ModalPortal>
  );
}
