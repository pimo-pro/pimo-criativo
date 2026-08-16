import { useMemo, useState } from "react";
import type { TampoCutout, TampoCutoutTipo } from "../../../core/remate/tampoCutouts";
import {
  createTampoCutout,
  isCircularTampoCutout,
  TAMPO_CUTOUT_DEFAULTS,
  TAMPO_CUTOUT_TYPE_LABELS,
  validateTampoCutout,
} from "../../../core/remate/tampoCutouts";

const CUTOUT_TYPES: TampoCutoutTipo[] = [
  "TAMPO_CUTOUT_FOGAO",
  "TAMPO_CUTOUT_PIA",
  "TAMPO_CUTOUT_RETANGULAR",
  "TAMPO_CUTOUT_CIRCULAR",
];

type Props = {
  open: boolean;
  onClose: () => void;
  tampoWidthMm: number;
  tampoHeightMm: number;
  onConfirm: (_cutout: TampoCutout) => void;
};

export default function AdicionarRecorteModal({
  open,
  onClose,
  tampoWidthMm,
  tampoHeightMm,
  onConfirm,
}: Props) {
  const [tipo, setTipo] = useState<TampoCutoutTipo>("TAMPO_CUTOUT_FOGAO");
  const [width, setWidth] = useState(TAMPO_CUTOUT_DEFAULTS.TAMPO_CUTOUT_FOGAO.width);
  const [height, setHeight] = useState(TAMPO_CUTOUT_DEFAULTS.TAMPO_CUTOUT_FOGAO.height);
  const [diameter, setDiameter] = useState(TAMPO_CUTOUT_DEFAULTS.TAMPO_CUTOUT_CIRCULAR.diameter);
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);

  const draft = useMemo(() => {
    if (isCircularTampoCutout(tipo)) {
      return createTampoCutout(tipo, { diameter, x, y });
    }
    return createTampoCutout(tipo, { width, height, x, y });
  }, [tipo, width, height, diameter, x, y]);

  const validation = useMemo(
    () => validateTampoCutout(draft, { width: tampoWidthMm, height: tampoHeightMm }),
    [draft, tampoWidthMm, tampoHeightMm]
  );

  if (!open) return null;

  const handleTipoChange = (next: TampoCutoutTipo) => {
    setTipo(next);
    const def = TAMPO_CUTOUT_DEFAULTS[next];
    if ("diameter" in def) {
      setDiameter(def.diameter);
    } else {
      setWidth(def.width);
      setHeight(def.height);
    }
  };

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1400,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(400px, 92vw)",
          padding: 16,
          borderRadius: 12,
          background: "var(--modal-bg, rgba(15,23,42,0.98))",
          border: "1px solid var(--modal-border, rgba(255,255,255,0.10))",
        }}
      >
        <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Adicionar recorte ao Tampo</h3>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, marginBottom: 10 }}>
          Tipo
          <select
            className="select"
            value={tipo}
            onChange={(e) => handleTipoChange(e.target.value as TampoCutoutTipo)}
            style={{ width: "100%" }}
          >
            {CUTOUT_TYPES.map((t) => (
              <option key={t} value={t}>
                {TAMPO_CUTOUT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>

        {isCircularTampoCutout(tipo) ? (
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, marginBottom: 10 }}>
            Diâmetro (mm)
            <input
              className="input"
              type="number"
              min={1}
              value={diameter}
              onChange={(e) => setDiameter(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
        ) : (
          <>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, marginBottom: 10 }}>
              Largura (mm)
              <input
                className="input"
                type="number"
                min={1}
                value={width}
                onChange={(e) => setWidth(Math.max(1, Number(e.target.value) || 1))}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, marginBottom: 10 }}>
              Altura (mm)
              <input
                className="input"
                type="number"
                min={1}
                value={height}
                onChange={(e) => setHeight(Math.max(1, Number(e.target.value) || 1))}
              />
            </label>
          </>
        )}

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, marginBottom: 10 }}>
          Posição X — centro (mm)
          <input
            className="input"
            type="number"
            value={x}
            onChange={(e) => setX(Number(e.target.value) || 0)}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, marginBottom: 10 }}>
          Posição Y — centro (mm)
          <input
            className="input"
            type="number"
            value={y}
            onChange={(e) => setY(Number(e.target.value) || 0)}
          />
        </label>

        {!validation.ok ? (
          <p style={{ margin: "0 0 10px", fontSize: 11, color: "var(--danger, #f87171)" }}>
            {validation.errors[0]}
          </p>
        ) : (
          <p style={{ margin: "0 0 10px", fontSize: 11, color: "var(--text-muted)" }}>
            Origem no centro do tampo · espessura de recorte 30 mm
          </p>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!validation.ok}
            onClick={() => {
              if (!validation.ok) return;
              onConfirm(draft);
              onClose();
            }}
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}
