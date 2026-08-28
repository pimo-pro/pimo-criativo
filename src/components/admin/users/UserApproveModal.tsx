import { useState, type FormEvent } from "react";

import { approveUserRemote, type RemoteUserPublic } from "../../../api/usersApi";
import Button from "../../ui/Button";
import Card from "../../ui/Card";
import PageHeader from "../../ui/PageHeader";
import "../../ui/ui.css";

const APPROVE_ROLE_OPTIONS = [
  { value: "pro", label: "Pro" },
  { value: "ultra", label: "Ultra" },
  { value: "ultra+", label: "Ultra+" },
] as const;

export type UserApproveModalProps = {
  open: boolean;
  user: RemoteUserPublic | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
};

export default function UserApproveModal({
  open,
  user,
  onClose,
  onSaved,
  onError,
  onSuccess,
}: UserApproveModalProps) {
  const [role, setRole] = useState<"pro" | "ultra" | "ultra+">("pro");
  const [submitting, setSubmitting] = useState(false);

  if (!open || !user) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await approveUserRemote(user.id, role);
      onSuccess(`Conta ${user.username} aprovada como ${role}.`);
      onSaved();
      onClose();
    } catch (er) {
      onError(er instanceof Error ? er.message : "Erro ao aprovar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ui-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div style={{ maxWidth: 440, width: "100%" }} onClick={(e) => e.stopPropagation()}>
        <Card>
          <PageHeader
            title="Aprovar conta"
            subtitle={`${user.username} (${user.email}) — pedido: ${user.requestedRole ?? "pro"}`}
          />
          <form onSubmit={(e) => void handleSubmit(e)}>
            <label className="ui-form-group">
              <span className="ui-input__label">Role final</span>
              <select
                className="ui-input"
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
                disabled={submitting}
                style={{ width: "100%", padding: "10px 12px" }}
              >
                {APPROVE_ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="ui-inline-actions" style={{ marginTop: 16 }}>
              <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? "A aprovar…" : "Aprovar"}
              </Button>
              <Button type="button" disabled={submitting} onClick={onClose}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
