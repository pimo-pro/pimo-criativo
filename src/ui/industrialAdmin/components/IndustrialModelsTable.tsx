/**
 * Tabela somente leitura — modos do industrialModelsRegistry (Fase E).
 * Sem sorting, filtros ou side-effects.
 */

import type { CSSProperties } from "react";
import type { IndustrialModelEntry } from "../../../core/industrialAdmin/industrialModelsRegistry";

export type IndustrialModelsTableProps = {
  models: readonly IndustrialModelEntry[];
};

function formatDeps(deps: IndustrialModelEntry["dependencies"]): string {
  const keys = Object.entries(deps)
    .filter(([, v]) => Boolean(v))
    .map(([k]) => k);
  return keys.length > 0 ? keys.join(", ") : "—";
}

function formatOrder(syncOrder: number | null, adapterOrder: number | null): string {
  const sync = syncOrder == null ? "—" : String(syncOrder);
  const adapter = adapterOrder == null ? "—" : String(adapterOrder);
  return `sync ${sync} / adapter ${adapter}`;
}

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  borderBottom: "1px solid rgba(255,255,255,0.12)",
  whiteSpace: "nowrap",
  fontWeight: 600,
};

const tdStyle: CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  verticalAlign: "top",
};

export function IndustrialModelsTable({ models }: IndustrialModelsTableProps) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        data-testid="industrial-models-table"
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 12,
          color: "var(--admin-text, var(--text-main))",
        }}
      >
        <thead>
          <tr>
            <th style={thStyle}>Modelo</th>
            <th style={thStyle}>Fase</th>
            <th style={thStyle}>Peças industriais</th>
            <th style={thStyle}>Regras</th>
            <th style={thStyle}>Adapters</th>
            <th style={thStyle}>Dependências</th>
            <th style={thStyle}>Sync/Adapter order</th>
          </tr>
        </thead>
        <tbody>
          {models.map((m) => (
            <tr key={m.id} data-testid={`industrial-model-row-${m.id}`}>
              <td style={tdStyle}>
                <div style={{ fontWeight: 600 }}>{m.nomeIndustrial}</div>
                <div style={{ color: "var(--text-muted)", marginTop: 2 }}>{m.nomeTecnico}</div>
                {m.skipClassicDrawerCutlist ? (
                  <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-muted)" }}>
                    skipClassicDrawerCutlist
                  </div>
                ) : null}
              </td>
              <td style={tdStyle}>{m.phase}</td>
              <td style={tdStyle}>{m.pieceTipos.join(", ") || "—"}</td>
              <td style={tdStyle}>{m.rules.join(", ") || "—"}</td>
              <td style={tdStyle}>{m.adapters.join(", ") || "—"}</td>
              <td style={tdStyle}>{formatDeps(m.dependencies)}</td>
              <td style={tdStyle}>{formatOrder(m.syncOrder, m.adapterOrder)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
