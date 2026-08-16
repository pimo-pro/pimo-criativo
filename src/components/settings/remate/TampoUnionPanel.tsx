import { useState } from "react";
import type { RematePiece } from "../../../core/remate/rematePieceTypes";
import type { TampoUnion, TampoUnionDirection } from "../../../core/remate/tampoUnion";
import {
  createTampoUnion,
  TAMPO_UNION_DIRECTION_LABELS,
  TAMPO_UNION_DIRECTIONS,
  TAMPO_UNION_OVERLAP_DEFAULT_MM,
  TAMPO_UNION_OVERLAP_MAX_MM,
  TAMPO_UNION_OVERLAP_MIN_MM,
  validateTampoUnion,
} from "../../../core/remate/tampoUnion";

type Props = {
  remate: RematePiece;
  otherTampos: RematePiece[];
  onChangeUnion: (_union: TampoUnion | null) => void;
};

export default function TampoUnionPanel({ remate, otherTampos, onChangeUnion }: Props) {
  const existing = remate.union ?? null;
  const [targetId, setTargetId] = useState(existing?.targetTampoId ?? otherTampos[0]?.id ?? "");
  const [direction, setDirection] = useState<TampoUnionDirection>(existing?.direction ?? "LEFT");
  const [overlapMm, setOverlapMm] = useState(
    existing?.overlapMm ?? TAMPO_UNION_OVERLAP_DEFAULT_MM
  );
  const [error, setError] = useState<string | null>(null);

  const target = otherTampos.find((t) => t.id === targetId) ?? null;
  const draftUnion: TampoUnion = {
    id: existing?.id ?? `draft-${remate.id}`,
    targetTampoId: targetId,
    direction,
    overlapMm,
  };
  const validation = validateTampoUnion(draftUnion, remate, target);

  const labelOf = (t: RematePiece) => t.nomePersonalizado?.trim() || t.name || t.id;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 10,
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600 }}>União entre Tampos</div>
      <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>
        Este tampo (A) recebe o encaixe; o alvo (B) entra {TAMPO_UNION_OVERLAP_MIN_MM}–
        {TAMPO_UNION_OVERLAP_MAX_MM} mm. Postforming do alvo mantém-se intacto.
      </p>

      {otherTampos.length === 0 ? (
        <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>
          Não há outro tampo no projecto para unir.
        </p>
      ) : (
        <>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
            Tampo alvo (B)
            <select
              className="select input-sm"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              {otherTampos.map((t) => (
                <option key={t.id} value={t.id}>
                  {labelOf(t)}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
            Direcção do encaixe
            <select
              className="select input-sm"
              value={direction}
              onChange={(e) => setDirection(e.target.value as TampoUnionDirection)}
            >
              {TAMPO_UNION_DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {TAMPO_UNION_DIRECTION_LABELS[d]}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
            Overlap (mm)
            <input
              className="input input-sm"
              type="number"
              min={TAMPO_UNION_OVERLAP_MIN_MM}
              max={TAMPO_UNION_OVERLAP_MAX_MM}
              step={1}
              value={overlapMm}
              onChange={(e) =>
                setOverlapMm(Number(e.target.value) || TAMPO_UNION_OVERLAP_DEFAULT_MM)
              }
            />
          </label>

          {!validation.ok ? (
            <p style={{ margin: 0, fontSize: 11, color: "var(--danger, #f87171)" }}>
              {validation.errors[0]}
            </p>
          ) : null}
          {error ? (
            <p style={{ margin: 0, fontSize: 11, color: "var(--danger, #f87171)" }}>{error}</p>
          ) : null}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-sm"
              disabled={!validation.ok}
              onClick={() => {
                const v = validateTampoUnion(draftUnion, remate, target);
                if (!v.ok) {
                  setError(v.errors[0] ?? "União inválida.");
                  return;
                }
                setError(null);
                onChangeUnion(
                  createTampoUnion({
                    targetTampoId: draftUnion.targetTampoId,
                    direction: draftUnion.direction,
                    overlapMm: draftUnion.overlapMm,
                  })
                );
              }}
            >
              Aplicar União
            </button>
            {existing ? (
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={() => {
                  setError(null);
                  onChangeUnion(null);
                }}
              >
                Remover União
              </button>
            ) : null}
          </div>

          {existing ? (
            <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>
              Activa: {TAMPO_UNION_DIRECTION_LABELS[existing.direction]} · {existing.overlapMm}{" "}
              mm · alvo {existing.targetTampoId}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
