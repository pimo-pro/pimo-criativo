import {
  TAMPO_PRESETS,
  createRemateInputFromTampoPreset,
  type TampoPresetId,
} from "../../../core/remate/tampoPresets";
import type { CreateRematePieceInput } from "../../../core/remate/rematePieceTypes";

type Props = {
  parentBoxId?: string;
  onConfirm: (_input: CreateRematePieceInput) => void;
};

export default function TampoPresetSelector({ parentBoxId, onConfirm }: Props) {
  const handle = (id: TampoPresetId) => {
    onConfirm(
      createRemateInputFromTampoPreset(id, {
        parentBoxId,
        followBox: Boolean(parentBoxId),
      })
    );
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
      <div style={{ fontSize: 12, fontWeight: 600 }}>Modelos TAMPO pré-definidos</div>
      <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>
        630×30 mm · MDB laminado · ângulo (trapézio) incluído. Postforming, recortes e união
        permanecem disponíveis após criar.
      </p>
      {TAMPO_PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          className="btn btn-sm"
          onClick={() => handle(p.id)}
          style={{ textAlign: "left" }}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
