import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import GlobalSettingsEditor from "../../components/admin/GlobalSettingsEditor";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import PageContainer from "../../components/ui/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import Section from "../../components/ui/Section";
import "../../components/ui/ui.css";
import { getGlobalSettingsRemote, patchGlobalSettingsRemote } from "../../api/globalSettingsApi";
import { useToast } from "../../context/ToastContext";
import { validateGlobalSettings } from "../../core/globalSettings/globalSettingsService";
import { isObject } from "../../core/settings/settingsMerge";

function formatDocumentFromRemote(remote: {
  version: string;
  updatedAt: string | null;
  settings: Record<string, unknown>;
}): string {
  const st = remote.settings;
  const settingsNorm = Array.isArray(st) ? {} : st;
  const fileShape = {
    version: remote.version,
    updatedAt: remote.updatedAt ?? null,
    settings: settingsNorm,
  };
  return JSON.stringify(fileShape, null, 2);
}

/**
 * Valida o texto do textarea como documento compatível com GET /config/global + `validateGlobalSettings`.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function validateGlobalSettingsJsonText(text: string): { valid: boolean; errors: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { valid: false, errors: ["JSON inválido (sintaxe)."] };
  }
  if (!isObject(parsed)) {
    return { valid: false, errors: ["A raiz do JSON deve ser um objeto."] };
  }
  const o = parsed as Record<string, unknown>;
  const doc = {
    status: "ok" as const,
    version: o.version,
    updatedAt: o.updatedAt ?? null,
    settings: o.settings,
  };
  return validateGlobalSettings(doc);
}

export default function GlobalSettingsAdminPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [text, setText] = useState("");
  const [baseline, setBaseline] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const dirty = useMemo(() => text !== baseline, [text, baseline]);

  const loadFromServer = useCallback(async () => {
    setLoading(true);
    setValidationErrors([]);
    try {
      const remote = await getGlobalSettingsRemote();
      if (!remote || remote.status !== "ok") {
        showToast("Não foi possível carregar as configurações globais.", "error");
        setText("");
        setBaseline("");
        return;
      }
      const formatted = formatDocumentFromRemote(remote);
      setText(formatted);
      setBaseline(formatted);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadFromServer();
  }, [loadFromServer]);

  const handleValidate = () => {
    const r = validateGlobalSettingsJsonText(text);
    setValidationErrors(r.errors);
    if (r.valid) {
      showToast("Documento válido.", "info");
    } else {
      showToast("Validação falhou — veja os erros abaixo.", "warning");
    }
  };

  const handleReload = () => {
    if (dirty && !window.confirm("Descartar alterações locais e recarregar do servidor?")) {
      return;
    }
    void loadFromServer();
  };

  const handleSave = async () => {
    const r = validateGlobalSettingsJsonText(text);
    setValidationErrors(r.errors);
    if (!r.valid) {
      showToast("Corrija os erros antes de guardar.", "error");
      return;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      showToast("JSON inválido.", "error");
      return;
    }

    const version = typeof parsed.version === "string" ? parsed.version.trim() : "";
    const settings = parsed.settings;
    if (!version || !isObject(settings)) {
      showToast("Estrutura inválida (version ou settings).", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await patchGlobalSettingsRemote({ version, settings });
      if (!res || res.status !== "ok") {
        showToast("O servidor recusou a gravação.", "error");
        return;
      }
      const formatted = formatDocumentFromRemote(res);
      setText(formatted);
      setBaseline(formatted);
      setValidationErrors([]);
      showToast("Configuração global guardada.", "info");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao guardar.";
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Configuração global"
        subtitle="Editar o documento publicado em GET /config/global (api/data/global-settings.json). Apenas admin.full_access."
      />
      <Section>
        <Card>
          <p style={{ marginTop: 0, fontSize: 14, color: "var(--text-muted, #71717a)" }}>
            Estado:{" "}
            {loading ? (
              <span>A carregar…</span>
            ) : dirty ? (
              <span style={{ color: "var(--color-warning, #ca8a04)", fontWeight: 600 }}>
                Alterações não guardadas
              </span>
            ) : (
              <span>Igual ao servidor</span>
            )}
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
            <Button type="button" variant="secondary" disabled={loading} onClick={() => void handleReload()}>
              Recarregar
            </Button>
            <Button type="button" variant="secondary" disabled={loading || saving} onClick={handleValidate}>
              Validar
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={loading || saving || !dirty}
              onClick={() => void handleSave()}
            >
              Guardar
            </Button>
            <Link to="/me" style={{ alignSelf: "center", fontSize: 14, fontWeight: 600 }}>
              Voltar
            </Link>
          </div>

          <GlobalSettingsEditor
            value={text}
            onChange={(next) => {
              setText(next);
              if (validationErrors.length > 0) setValidationErrors([]);
            }}
            validationErrors={validationErrors}
            disabled={loading || saving}
          />
        </Card>
      </Section>
    </PageContainer>
  );
}
