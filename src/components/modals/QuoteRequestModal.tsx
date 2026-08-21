// Modal de captação de dados do cliente antes de "Salvar e pedir orçamento".

import { useEffect, useState, type CSSProperties } from "react";
import { ModalPortal } from "../ui/ModalPortal";

export type QuoteRequestFieldsInput = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes: string;
};

export type QuoteRequestModalProps = {
  open: boolean;
  isSubmitting?: boolean;
  /** Utilizador autenticado: esconde o campo Nome (preenchido em background). */
  isAuthenticated?: boolean;
  /** Username da sessão autenticada — usado como nome quando isAuthenticated=true. */
  authenticatedUserName?: string;
  onConfirm: (fields: QuoteRequestFieldsInput) => void;
  onCancel: () => void;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fieldStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  marginBottom: 14,
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
};

const errorStyle: CSSProperties = {
  fontSize: 11,
  color: "#f87171",
};

export default function QuoteRequestModal({
  open,
  isSubmitting = false,
  isAuthenticated = false,
  authenticatedUserName = "",
  onConfirm,
  onCancel,
}: QuoteRequestModalProps) {
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof QuoteRequestFieldsInput, string>>>({});

  // Utilizador autenticado: preencher nome em background sempre que o modal abre.
  useEffect(() => {
    if (open && isAuthenticated) {
      setCustomerName(authenticatedUserName.trim());
    }
  }, [open, isAuthenticated, authenticatedUserName]);

  if (!open) return null;

  const handleCancel = () => {
    if (isSubmitting) return;
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setNotes("");
    setErrors({});
    onCancel();
  };

  const handleConfirm = () => {
    if (isSubmitting) return;
    const nextErrors: Partial<Record<keyof QuoteRequestFieldsInput, string>> = {};
    if (!isAuthenticated && !customerName.trim()) nextErrors.customerName = "Indique o nome do cliente.";
    if (!customerEmail.trim()) {
      nextErrors.customerEmail = "Indique o email do cliente.";
    } else if (!EMAIL_REGEX.test(customerEmail.trim())) {
      nextErrors.customerEmail = "Email com formato inválido.";
    }
    if (!customerPhone.trim()) nextErrors.customerPhone = "Indique o telefone do cliente.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onConfirm({
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone.trim(),
      notes: notes.trim(),
    });
  };

  return (
    <ModalPortal>
      <div
        className="modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Dados do cliente para pedido de orçamento"
        onClick={(e) => e.target === e.currentTarget && handleCancel()}
      >
        <div className="modal-card" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">Dados do cliente</div>
            <button type="button" className="modal-close" onClick={handleCancel} aria-label="Fechar" disabled={isSubmitting}>
              ×
            </button>
          </div>

          <p style={{ fontSize: 12, opacity: 0.85, marginBottom: 16 }}>
            {isAuthenticated
              ? "Confirme o email e telefone para enviarmos o pedido de orçamento."
              : "Precisamos destes dados para enviar o pedido de orçamento."}
          </p>

          {!isAuthenticated ? (
            <div style={fieldStyle}>
              <span style={labelStyle}>Nome *</span>
              <input
                type="text"
                className="input input-sm"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                disabled={isSubmitting}
                placeholder="Nome do cliente"
              />
              {errors.customerName ? <span style={errorStyle}>{errors.customerName}</span> : null}
            </div>
          ) : null}

          <div style={fieldStyle}>
            <span style={labelStyle}>Email *</span>
            <input
              type="email"
              className="input input-sm"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              disabled={isSubmitting}
              placeholder="cliente@exemplo.com"
            />
            {errors.customerEmail ? <span style={errorStyle}>{errors.customerEmail}</span> : null}
          </div>

          <div style={fieldStyle}>
            <span style={labelStyle}>Telefone *</span>
            <input
              type="tel"
              className="input input-sm"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              disabled={isSubmitting}
              placeholder="912345678"
            />
            {errors.customerPhone ? <span style={errorStyle}>{errors.customerPhone}</span> : null}
          </div>

          <div style={fieldStyle}>
            <span style={labelStyle}>Notas (opcional)</span>
            <textarea
              className="input input-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
              rows={3}
              style={{ resize: "vertical", minHeight: 60 }}
            />
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <button type="button" className="modal-action" onClick={handleCancel} disabled={isSubmitting}>
              Cancelar
            </button>
            <button type="button" className="modal-action" onClick={handleConfirm} disabled={isSubmitting}>
              {isSubmitting ? "A enviar…" : "Confirmar e enviar"}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
