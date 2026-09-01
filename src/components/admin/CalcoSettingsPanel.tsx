/**
 * Admin ? Ferragens ? Calco (Refs 00 e 03).
 * Precos unitarios (default 0). Ref 1503 adiada.
 */

import { useEffect, useState } from "react";
import { useCalcoConfig } from "../../hooks/useCalcoConfig";
import { useFerragens } from "../../hooks/useFerragens";
import { useToast } from "../../context/ToastContext";
import {
  CALCO_00_ID,
  CALCO_03_ID,
  CALCO_MATERIAL,
  CALCO_MEDIDA,
  CALCO_REF_00,
  CALCO_REF_03,
  type CalcoConfig,
} from "../../core/ferragens/calcoConfig";
import { formatCurrency } from "../../utils/formatting";

export default function CalcoSettingsPanel() {
  const { showToast } = useToast();
  const { config, setConfig } = useCalcoConfig();
  const { setFerragens } = useFerragens();
  const [draft, setDraft] = useState<CalcoConfig>(config);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  const syncCatalog = (cfg: CalcoConfig) => {
    const entries = [
      {
        id: CALCO_00_ID,
        nome: CALCO_MATERIAL,
        categoria: "acessorio" as const,
        medidas: CALCO_MEDIDA,
        descricao: `Cal\u00e7o Ref ${CALCO_REF_00} (I-Sensys 8645i)`,
        precoUnitario: cfg.refs["00"].precoUnitario,
      },
      {
        id: CALCO_03_ID,
        nome: CALCO_MATERIAL,
        categoria: "acessorio" as const,
        medidas: CALCO_MEDIDA,
        descricao: `Cal\u00e7o Ref ${CALCO_REF_03} (Frente Fixa)`,
        precoUnitario: cfg.refs["03"].precoUnitario,
      },
    ];
    setFerragens((prev) => {
      const next = [...prev];
      for (const entry of entries) {
        const idx = next.findIndex((f) => f.id === entry.id);
        if (idx >= 0) next[idx] = { ...next[idx], ...entry };
        else next.push(entry);
      }
      return next;
    });
  };

  const handleSave = () => {
    const next: CalcoConfig = {
      refs: {
        "00": {
          ativo: draft.refs["00"].ativo,
          precoUnitario: Math.max(0, Number(draft.refs["00"].precoUnitario) || 0),
        },
        "03": {
          ativo: draft.refs["03"].ativo,
          precoUnitario: Math.max(0, Number(draft.refs["03"].precoUnitario) || 0),
        },
      },
    };
    setConfig(next);
    syncCatalog(next);
    showToast("Configuracao de Calco guardada.", "info");
  };

  const labelStyle = { fontSize: 11, color: "var(--text-muted)", marginBottom: 4 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
        Ref 00: 1 por dobradica I-Sensys 8645i. Ref 03: 1 por porta em modulo com Frente Fixa.
        Preco default 0 — configurar manualmente. Ref 1503 adiada.
      </p>

      {(["00", "03"] as const).map((ref) => (
        <div
          key={ref}
          className="form-grid"
          style={{
            gridTemplateColumns: "80px 1fr 1fr auto",
            gap: 10,
            alignItems: "end",
            padding: 8,
            border: "1px solid var(--border)",
            borderRadius: 6,
          }}
        >
          <div>
            <div style={labelStyle}>Ref</div>
            <strong style={{ fontSize: 14 }}>{ref}</strong>
          </div>
          <div>
            <div style={labelStyle}>Preco unitario (EUR)</div>
            <input
              className="input"
              type="number"
              min={0}
              step="0.01"
              value={draft.refs[ref].precoUnitario}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  refs: {
                    ...p.refs,
                    [ref]: { ...p.refs[ref], precoUnitario: Number(e.target.value) },
                  },
                }))
              }
            />
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", paddingBottom: 8 }}>
            {CALCO_MATERIAL} — {CALCO_MEDIDA} — {formatCurrency(draft.refs[ref].precoUnitario || 0)}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, paddingBottom: 8 }}>
            <input
              type="checkbox"
              checked={draft.refs[ref].ativo}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  refs: {
                    ...p.refs,
                    [ref]: { ...p.refs[ref], ativo: e.target.checked },
                  },
                }))
              }
            />
            Ativo
          </label>
        </div>
      ))}

      <div>
        <button type="button" className="button" onClick={handleSave}>
          Guardar configuracao
        </button>
      </div>
    </div>
  );
}
