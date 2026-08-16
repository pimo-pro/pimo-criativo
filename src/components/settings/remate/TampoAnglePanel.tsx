import { useMemo, useState } from "react";
import type { RematePiece } from "../../../core/remate/rematePieceTypes";
import type { TampoAngleConfig } from "../../../core/remate/tampoAngle";
import {
  computeTampoAngleDegFromLengths,
  normalizeTampoAngleConfig,
  validateTampoAngleConfig,
} from "../../../core/remate/tampoAngle";

type Props = {
  remate: RematePiece;
  onChangeAngleConfig: (_cfg: TampoAngleConfig | null) => void;
};

export default function TampoAnglePanel({ remate, onChangeAngleConfig }: Props) {
  const existing = normalizeTampoAngleConfig(remate.angleConfig, remate.height);
  const [frontLengthMm, setFrontLengthMm] = useState<number>(
    existing?.frontLengthMm ?? remate.width
  );
  const [backLengthMm, setBackLengthMm] = useState<number>(
    existing?.backLengthMm ?? remate.width
  );
  const [error, setError] = useState<string | null>(null);

  const angleDeg = useMemo(
    () => computeTampoAngleDegFromLengths(frontLengthMm, backLengthMm, remate.height),
    [frontLengthMm, backLengthMm, remate.height]
  );

  const draft: TampoAngleConfig = {
    frontLengthMm,
    backLengthMm,
    angleDeg,
  };

  const validation = validateTampoAngleConfig(draft, {
    widthMm: remate.width,
    heightMm: remate.height,
  });

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
      <div style={{ fontSize: 12, fontWeight: 600 }}>Ângulo do Tampo</div>
      <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>
        Frente e trás podem diferir (trapézio). Largura industrial mantém-se {remate.height} mm.
        O ângulo é calculado automaticamente.
      </p>

      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
        Comprimento frontal (mm)
        <input
          className="input input-sm"
          type="number"
          min={1}
          value={frontLengthMm}
          onChange={(e) => setFrontLengthMm(Math.max(1, Number(e.target.value) || 1))}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
        Comprimento traseiro (mm)
        <input
          className="input input-sm"
          type="number"
          min={1}
          value={backLengthMm}
          onChange={(e) => setBackLengthMm(Math.max(1, Number(e.target.value) || 1))}
        />
      </label>

      <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>
        Frente: {frontLengthMm} mm · Trás: {backLengthMm} mm · Ângulo: {angleDeg.toFixed(1)}°
      </p>

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
            const v = validateTampoAngleConfig(draft, {
              widthMm: remate.width,
              heightMm: remate.height,
            });
            if (!v.ok) {
              setError(v.errors[0] ?? "Configuração inválida.");
              return;
            }
            setError(null);
            onChangeAngleConfig(normalizeTampoAngleConfig(draft, remate.height));
          }}
        >
          Aplicar Ângulo
        </button>
        {existing ? (
          <button
            type="button"
            className="btn btn-sm btn-danger"
            onClick={() => {
              setError(null);
              setFrontLengthMm(remate.width);
              setBackLengthMm(remate.width);
              onChangeAngleConfig(null);
            }}
          >
            Remover Ângulo
          </button>
        ) : null}
      </div>
    </div>
  );
}
