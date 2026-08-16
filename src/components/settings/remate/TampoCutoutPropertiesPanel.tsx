import { useState } from "react";
import type { RematePiece } from "../../../core/remate/rematePieceTypes";
import type { TampoCutout } from "../../../core/remate/tampoCutouts";
import {
  isCircularTampoCutout,
  normalizeTampoCutout,
  TAMPO_CUTOUT_TYPE_LABELS,
  validateAllTampoCutouts,
  validateTampoCutout,
} from "../../../core/remate/tampoCutouts";
import AdicionarRecorteModal from "./AdicionarRecorteModal";

type Props = {
  remate: RematePiece;
  onChangeCutouts: (_cutouts: TampoCutout[]) => void;
};

export default function TampoCutoutPropertiesPanel({ remate, onChangeCutouts }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cutouts = remate.cutouts ?? [];

  const commit = (next: TampoCutout[]) => {
    const v = validateAllTampoCutouts(next, {
      width: remate.width,
      height: remate.height,
    });
    if (!v.ok) {
      setError(v.errors[0] ?? "Recorte inválido.");
      return;
    }
    setError(null);
    onChangeCutouts(next.map(normalizeTampoCutout));
  };

  const patchCutout = (id: string, patch: Partial<TampoCutout>) => {
    const next = cutouts.map((c) =>
      c.id === id ? normalizeTampoCutout({ ...c, ...patch }) : c
    );
    const target = next.find((c) => c.id === id);
    if (target) {
      const single = validateTampoCutout(target, {
        width: remate.width,
        height: remate.height,
      });
      if (!single.ok) {
        setError(single.errors[0] ?? "Recorte inválido.");
        return;
      }
    }
    commit(next);
  };

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Recortes do Tampo</span>
        <button type="button" className="btn btn-sm" onClick={() => setModalOpen(true)}>
          Adicionar
        </button>
      </div>

      {cutouts.length === 0 ? (
        <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>
          Sem recortes. Fogão, pia, retangular ou circular.
        </p>
      ) : (
        cutouts.map((c) => (
          <div
            key={c.id}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              padding: 8,
              borderRadius: 6,
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12 }}>{TAMPO_CUTOUT_TYPE_LABELS[c.tipo]}</span>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={() => commit(cutouts.filter((x) => x.id !== c.id))}
              >
                Remover
              </button>
            </div>

            {isCircularTampoCutout(c.tipo) ? (
              <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 11 }}>
                Diâmetro (mm)
                <input
                  className="input input-sm"
                  type="number"
                  min={1}
                  value={c.diameter ?? 0}
                  onChange={(e) =>
                    patchCutout(c.id, { diameter: Math.max(1, Number(e.target.value) || 1) })
                  }
                />
              </label>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 11 }}>
                  Largura
                  <input
                    className="input input-sm"
                    type="number"
                    min={1}
                    value={c.width ?? 0}
                    onChange={(e) =>
                      patchCutout(c.id, { width: Math.max(1, Number(e.target.value) || 1) })
                    }
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 11 }}>
                  Altura
                  <input
                    className="input input-sm"
                    type="number"
                    min={1}
                    value={c.height ?? 0}
                    onChange={(e) =>
                      patchCutout(c.id, { height: Math.max(1, Number(e.target.value) || 1) })
                    }
                  />
                </label>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 11 }}>
                X (mm)
                <input
                  className="input input-sm"
                  type="number"
                  value={c.x}
                  onChange={(e) => patchCutout(c.id, { x: Number(e.target.value) || 0 })}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 11 }}>
                Y (mm)
                <input
                  className="input input-sm"
                  type="number"
                  value={c.y}
                  onChange={(e) => patchCutout(c.id, { y: Number(e.target.value) || 0 })}
                />
              </label>
            </div>
          </div>
        ))
      )}

      {error ? (
        <p style={{ margin: 0, fontSize: 11, color: "var(--danger, #f87171)" }}>{error}</p>
      ) : null}

      <AdicionarRecorteModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        tampoWidthMm={remate.width}
        tampoHeightMm={remate.height}
        onConfirm={(cutout) => commit([...cutouts, cutout])}
      />
    </div>
  );
}
