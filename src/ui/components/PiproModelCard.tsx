/**
 * Cartão público de modelo pipro — snapshot 3D + metadados + editar.
 */

import type { PiproModelRecord } from "../../core/pipro/piproDesignTypes";
import { PiproDesignViewer } from "../pipro/PiproDesignViewer";

export type PiproModelCardProps = {
  model: PiproModelRecord;
  onEdit?: (modelId: string) => void;
};

export function summarizePiproModel(model: PiproModelRecord) {
  const pieceCount = model.pieces.length;
  const holeCount = model.pieces.reduce((n, p) => n + (p.drillHoles?.length ?? 0), 0);
  const drawerCount = model.pieces.filter(
    (p) => p.kind === "gaveta" || String(p.tipo).toLowerCase().includes("gav")
  ).length;
  const doorCount = model.pieces.filter(
    (p) => p.kind === "porta" || String(p.tipo).toLowerCase().includes("porta")
  ).length;
  return { pieceCount, holeCount, drawerCount, doorCount };
}

export function PiproModelCard({ model, onEdit }: PiproModelCardProps) {
  const stats = summarizePiproModel(model);
  const dims = model.dimensions;
  const created = new Date(model.createdAt).toLocaleString("pt-PT");

  return (
    <article
      data-testid="pipro-model-card"
      data-model-id={model.id}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 10,
        padding: 12,
        background: "rgba(15,23,42,0.35)",
      }}
    >
      <div style={{ height: 180, minHeight: 180 }}>
        <PiproDesignViewer
          dimensions={dims}
          pieces={model.pieces}
          showDrill
          showOrla
          showCnc
          compact
        />
      </div>

      <h2 style={{ margin: 0, fontSize: 16 }}>{model.nome}</h2>

      <dl style={{ margin: 0, display: "grid", gap: 4, fontSize: 12 }}>
        <div>
          <dt style={{ display: "inline", color: "var(--text-muted)" }}>Dimensões: </dt>
          <dd style={{ display: "inline", margin: 0 }}>
            {Math.round(dims.largura)}×{Math.round(dims.altura)}×{Math.round(dims.profundidade)} mm
            {" · "}e={Math.round(dims.espessura)}
          </dd>
        </div>
        <div>
          <dt style={{ display: "inline", color: "var(--text-muted)" }}>Material: </dt>
          <dd style={{ display: "inline", margin: 0 }}>{model.materials.bodyMaterialId}</dd>
        </div>
        <div>
          <dt style={{ display: "inline", color: "var(--text-muted)" }}>Peças: </dt>
          <dd style={{ display: "inline", margin: 0 }}>{stats.pieceCount}</dd>
        </div>
        <div>
          <dt style={{ display: "inline", color: "var(--text-muted)" }}>Furos: </dt>
          <dd style={{ display: "inline", margin: 0 }}>{stats.holeCount}</dd>
        </div>
        <div>
          <dt style={{ display: "inline", color: "var(--text-muted)" }}>Gavetas / Portas: </dt>
          <dd style={{ display: "inline", margin: 0 }}>
            {stats.drawerCount} / {stats.doorCount}
          </dd>
        </div>
        <div>
          <dt style={{ display: "inline", color: "var(--text-muted)" }}>Criado: </dt>
          <dd style={{ display: "inline", margin: 0 }}>{created}</dd>
        </div>
      </dl>

      <button
        type="button"
        data-testid="pipro-model-edit-btn"
        onClick={() => onEdit?.(model.id)}
      >
        Editar no Workspace
      </button>
    </article>
  );
}

export default PiproModelCard;
