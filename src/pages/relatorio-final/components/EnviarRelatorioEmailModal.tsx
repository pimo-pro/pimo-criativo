import { useState } from "react";
import Button from "@/components/ui/Button";
import { reportInput, reportLabel } from "../reportStyles";
import { R } from "../uiLabels";
import EditableModal from "./EditableModal";

type Props = {
  open: boolean;
  isSubmitting?: boolean;
  onConfirm: (recipientEmail: string) => void;
  onCancel: () => void;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EnviarRelatorioEmailModal({
  open,
  isSubmitting = false,
  onConfirm,
  onCancel,
}: Props) {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setRecipientEmail("");
      setError(null);
    }
  }

  const handleClose = () => {
    if (isSubmitting) return;
    setRecipientEmail("");
    setError(null);
    onCancel();
  };

  const handleConfirm = () => {
    if (isSubmitting) return;
    const email = recipientEmail.trim();
    if (!email) {
      setError(R.emailObrigatorio);
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      setError(R.emailInvalido);
      return;
    }
    onConfirm(email);
  };

  return (
    <EditableModal
      open={open}
      title={R.emailTitulo}
      onClose={handleClose}
      closeDisabled={isSubmitting}
      maxWidth={440}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            {R.cancelar}
          </Button>
          <Button type="button" variant="primary" onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? R.emailAEnviar : R.emailEnviar}
          </Button>
        </>
      }
    >
      <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--text-muted)" }}>
        {R.emailHint}
      </p>
      <label>
        <span style={reportLabel}>{R.emailDestinatario} *</span>
        <input
          type="email"
          style={reportInput}
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
          disabled={isSubmitting}
          placeholder={R.emailPlaceholder}
          autoComplete="email"
        />
      </label>
      {error ? (
        <p style={{ margin: "6px 0 0", fontSize: 11, color: "#f87171" }}>{error}</p>
      ) : null}
    </EditableModal>
  );
}
