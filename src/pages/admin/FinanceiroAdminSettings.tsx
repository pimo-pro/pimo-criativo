/**
 * P3.6 — Configurações financeiras ADMIN (ADM / montagem / portes).
 * Grava defaults globais (localStorage) e, se houver projeto aberto, no ProjectState.
 */

import { useMemo, useState } from "react";
import {
  AdminPageHeader,
  adminLabelStyle,
  adminPageShellStyle,
  AdminStickyActionBar,
} from "../../components/admin/AdminUi";
import Button from "../../components/ui/Button";
import { useToast } from "../../context/ToastContext";
import { useProject } from "../../context/useProject";
import { useSettings } from "../../context/SettingsContext";
import {
  loadGlobalFinanceiroAdminSettings,
  normalizeFinanceiroAdminSettings,
  saveGlobalFinanceiroAdminSettings,
  type FinanceiroAdminSettings,
  type FinanceiroMontagemMode,
  type FinanceiroValorMode,
} from "../../core/financeiro";
import { financeiroAdminDefaultsFromCentral } from "../../core/pricing/centralPricingConfig";
import { getSettings } from "../../core/settings/settingsService";

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: 14,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const grid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

export default function FinanceiroAdminSettings() {
  const { showToast } = useToast();
  const { project, actions } = useProject();
  const { updateSettings } = useSettings();
  const externalDraft = useMemo(
    () =>
      normalizeFinanceiroAdminSettings(
        project?.financeiroAdminSettings ??
          getSettings().financeiroAdmin ??
          loadGlobalFinanceiroAdminSettings()
      ),
    [project?.financeiroAdminSettings]
  );
  const [draft, setDraft] = useState<FinanceiroAdminSettings>(externalDraft);
  const [syncedFinanceiroSettings, setSyncedFinanceiroSettings] = useState(
    project?.financeiroAdminSettings
  );
  if (project?.financeiroAdminSettings !== syncedFinanceiroSettings) {
    setSyncedFinanceiroSettings(project?.financeiroAdminSettings);
    setDraft(externalDraft);
  }

  const handleSave = () => {
    const next = normalizeFinanceiroAdminSettings(draft);
    saveGlobalFinanceiroAdminSettings(next);
    const result = updateSettings({ financeiroAdmin: next });
    try {
      actions.setFinanceiroAdminSettings(next);
    } catch {
      /* projeto pode não estar disponível em alguns contextos */
    }
    setDraft(next);
    showToast(
      result.success
        ? "Configurações financeiras ADMIN guardadas (sync remoto se autenticado)."
        : result.message,
      result.success ? "info" : "error"
    );
  };

  const handleReset = () => {
    const next = financeiroAdminDefaultsFromCentral();
    setDraft(next);
  };

  return (
    <div style={adminPageShellStyle}>
      <AdminPageHeader
        title="Financeiro — ADM / Montagem / Portes"
        subtitle="Regras administrativas aplicadas ao Painel Financeiro Unificado e aos PDFs. IVA continua a aplicar-se sobre o subtotal de materiais."
      />

      <AdminStickyActionBar>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Defaults de fábrica + projeto atual
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <Button type="button" variant="secondary" onClick={handleReset}>
            Restaurar defaults
          </Button>
          <Button type="button" onClick={handleSave}>
            Guardar
          </Button>
        </div>
      </AdminStickyActionBar>

      <div style={cardStyle}>
        <h3 style={{ margin: 0, fontSize: 14 }}>ADM</h3>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={draft.adm.enabled}
            onChange={(e) =>
              setDraft((p) => ({ ...p, adm: { ...p.adm, enabled: e.target.checked } }))
            }
          />
          Ativo
        </label>
        <div style={grid2}>
          <div>
            <span style={adminLabelStyle}>Modo</span>
            <select
              className="input"
              value={draft.adm.mode}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  adm: { ...p.adm, mode: e.target.value as FinanceiroValorMode },
                }))
              }
            >
              <option value="percentagem">% sobre subtotal materiais</option>
              <option value="fixo">Valor fixo (€)</option>
            </select>
          </div>
          <div>
            <span style={adminLabelStyle}>
              {draft.adm.mode === "percentagem" ? "Percentagem (%)" : "Valor (€)"}
            </span>
            <input
              className="input"
              type="number"
              min={0}
              step="0.01"
              value={draft.adm.valor}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  adm: { ...p.adm, valor: Number(e.target.value) || 0 },
                }))
              }
            />
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ margin: 0, fontSize: 14 }}>Montagem</h3>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={draft.montagem.enabled}
            onChange={(e) =>
              setDraft((p) => ({
                ...p,
                montagem: { ...p.montagem, enabled: e.target.checked },
              }))
            }
          />
          Ativo
        </label>
        <div style={grid2}>
          <div>
            <span style={adminLabelStyle}>Modo</span>
            <select
              className="input"
              value={draft.montagem.mode}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  montagem: {
                    ...p.montagem,
                    mode: e.target.value as FinanceiroMontagemMode,
                  },
                }))
              }
            >
              <option value="eur_por_m2">€ / m² (montagem_caixa_m2)</option>
              <option value="fixo_por_caixa">€ fixo por caixa</option>
              <option value="percentagem_por_caixa">% × nº caixas (sobre subtotal)</option>
              <option value="fixo_total">€ fixo total</option>
              <option value="percentagem_subtotal">% sobre subtotal</option>
            </select>
          </div>
          <div>
            <span style={adminLabelStyle}>Valor</span>
            <input
              className="input"
              type="number"
              min={0}
              step="0.01"
              value={draft.montagem.valor}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  montagem: { ...p.montagem, valor: Number(e.target.value) || 0 },
                }))
              }
            />
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ margin: 0, fontSize: 14 }}>Portes (transporte)</h3>
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
          Fórmula: max(mínimo, taxaBase +€/kg×peso +€/m³×volume + €/km×distância). No projeto,
          Portes = 0 até o utilizador marcar «Incluir portes».
        </p>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={draft.portes.enabled}
            onChange={(e) =>
              setDraft((p) => ({
                ...p,
                portes: { ...p.portes, enabled: e.target.checked },
              }))
            }
          />
          Ativo
        </label>
        <div style={grid2}>
          {(
            [
              ["taxaBase", "Taxa base (€)"],
              ["porKg", "€ / kg"],
              ["porM3", "€ / m³"],
              ["porKm", "€ / km"],
              ["minimo", "Mínimo (€)"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <span style={adminLabelStyle}>{label}</span>
              <input
                className="input"
                type="number"
                min={0}
                step="0.01"
                value={draft.portes[key]}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    portes: { ...p.portes, [key]: Number(e.target.value) || 0 },
                  }))
                }
              />
            </div>
          ))}
          <div>
            <span style={adminLabelStyle}>Distância default (km)</span>
            <input
              className="input"
              type="number"
              min={0}
              step="0.1"
              value={draft.distanciaKmDefault}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  distanciaKmDefault: Number(e.target.value) || 0,
                }))
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
