import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createInviteCodeRemote,
  deleteInviteCodeRemote,
  getInviteCodesRemote,
  setInviteCodeActiveRemote,
} from "../../../api/inviteCodesApi";
import type {
  InviteAssignableRole,
  InviteCodeRecord,
  InviteUsageMode,
} from "../../../core/auth/inviteCodeRules";
import { deriveInviteStatus, normalizeInviteCode } from "../../../core/auth/inviteCodeRules";
import Button from "../../ui/Button";
import FormGroup from "../../ui/FormGroup";
import Input from "../../ui/Input";
import Section from "../../ui/Section";
import "../../ui/ui.css";

type Props = {
  onError: (_msg: string) => void;
  onSuccess: (_msg: string) => void;
};

const ROLE_OPTIONS: { value: InviteAssignableRole; label: string }[] = [
  { value: "pro", label: "Pro" },
  { value: "ultra", label: "Ultra" },
  { value: "ultra+", label: "Ultra+" },
];

export default function InviteCodesAdminSection({ onError, onSuccess }: Props) {
  const [codes, setCodes] = useState<InviteCodeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [role, setRole] = useState<InviteAssignableRole>("pro");
  const [usageMode, setUsageMode] = useState<InviteUsageMode>("single");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getInviteCodesRemote();
      setCodes(list);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Falha ao carregar códigos");
      setCodes([]);
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(
    () => [...codes].sort((a, b) => a.code.localeCompare(b.code)),
    [codes]
  );

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = normalizeInviteCode(code);
    if (!normalized) {
      onError("Indique o código");
      return;
    }
    setSaving(true);
    try {
      await createInviteCodeRemote({ code: normalized, role, usageMode });
      setCode("");
      setRole("pro");
      setUsageMode("single");
      onSuccess(`Código ${normalized} criado.`);
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Falha ao criar código");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (item: InviteCodeRecord, active: boolean) => {
    setBusyId(item.id);
    try {
      await setInviteCodeActiveRemote(item.id, active);
      onSuccess(active ? `Código ${item.code} reactivado.` : `Código ${item.code} desactivado.`);
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Falha ao actualizar código");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item: InviteCodeRecord) => {
    if (!window.confirm(`Remover permanentemente o código ${item.code}?`)) return;
    setBusyId(item.id);
    try {
      await deleteInviteCodeRemote(item.id);
      onSuccess(`Código ${item.code} removido.`);
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Falha ao remover código");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Section title={`Códigos de convite (${codes.length})`}>
      <form onSubmit={(e) => void handleCreate(e)} className="ui-form-group">
        <div className="ui-grid ui-grid--2">
          <Input
            label="Código"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ex.: PIMO-PRO-2026"
            required
          />
          <div className="ui-form-group">
            <label className="ui-input__label" htmlFor="invite-role">
              Role
            </label>
            <select
              id="invite-role"
              className="ui-input"
              value={role}
              onChange={(e) => setRole(e.target.value as InviteAssignableRole)}
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="ui-form-group">
            <label className="ui-input__label" htmlFor="invite-usage">
              Uso
            </label>
            <select
              id="invite-usage"
              className="ui-input"
              value={usageMode}
              onChange={(e) => setUsageMode(e.target.value as InviteUsageMode)}
            >
              <option value="single">Único</option>
              <option value="multi">Múltiplo (ilimitado)</option>
            </select>
          </div>
        </div>
        <FormGroup>
          <Button type="submit" variant="primary" disabled={saving || loading}>
            {saving ? "A guardar…" : "Adicionar código"}
          </Button>
        </FormGroup>
      </form>

      {loading ? (
        <p style={{ margin: 0, color: "var(--text-muted, #71717a)" }}>A carregar…</p>
      ) : sorted.length === 0 ? (
        <p style={{ margin: 0 }}>Nenhum código de convite.</p>
      ) : (
        <div className="ui-table-wrapper">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Role</th>
                <th>Modo</th>
                <th>Usos</th>
                <th>Estado</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((item) => {
                const status = item.status ?? deriveInviteStatus(item);
                const busy = busyId === item.id;
                return (
                  <tr key={item.id}>
                    <td>
                      <code>{item.code}</code>
                    </td>
                    <td>{item.role}</td>
                    <td>{item.usageMode === "multi" ? "Múltiplo" : "Único"}</td>
                    <td>
                      {item.usedCount}
                      {item.usageMode === "single" ? " / 1" : ""}
                    </td>
                    <td>{status}</td>
                    <td>
                      <div className="ui-inline-actions">
                        {item.active ? (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void handleToggle(item, false)}
                          >
                            Desactivar
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void handleToggle(item, true)}
                          >
                            Reactivar
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void handleDelete(item)}
                        >
                          Remover
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
