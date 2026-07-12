import { getMaterialByIdOrLabel } from "../../../core/materials/service";
import { isMaterialMadeira } from "../../../core/materials/nestingGrainLock";

type Props = {
  materialId: string;
  allowPieceRotation?: boolean;
  onChange: (allow: boolean) => void;
  compact?: boolean;
};

/** Toggle "Rotação do veio (YY)" — visível apenas para materiais com veio (madeira). */
export default function WoodGrainRotationToggle({
  materialId,
  allowPieceRotation,
  onChange,
  compact = false,
}: Props) {
  const mat = getMaterialByIdOrLabel(materialId);
  const madeira = isMaterialMadeira(materialId) || mat?.materialMadeira === true;
  if (!madeira) return null;

  const checked = allowPieceRotation === true;
  const label = compact ? "Rotação do veio (YY)" : "Rotação do veio (YY)";

  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 12,
        marginTop: compact ? 0 : 4,
      }}
      title="Desligado = veio fixo (Viewer e nesting). Ligado = roda fibra no Viewer e permite rotação 90° no nesting/TCN."
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
