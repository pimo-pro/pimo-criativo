import Panel from "../../ui/Panel";
import type { CornerOrientation } from "../../../core/cornerCabinet/cornerCabinetRules";
import {
  isCornerDireitaInferiorV2Model,
  resolveCornerOrientationFromBox,
} from "../../../core/cornerCabinet/cornerCabinetRules";
import type { WorkspaceBox } from "../../../core/types";

type Props = {
  box: WorkspaceBox;
  onOrientationChange: (orientation: CornerOrientation) => void;
};

const OPTIONS: { id: CornerOrientation; label: string }[] = [
  { id: "direita", label: "Direita" },
  { id: "esquerda", label: "Esquerda" },
];

// eslint-disable-next-line react-refresh/only-export-components
export function isCornerOrientationPanelVisible(box: Pick<WorkspaceBox, "baseCabinetId">): boolean {
  return isCornerDireitaInferiorV2Model(box.baseCabinetId);
}

export default function CornerOrientationPanel({ box, onOrientationChange }: Props) {
  if (!isCornerOrientationPanelVisible(box)) return null;

  const current = resolveCornerOrientationFromBox(box);

  return (
    <Panel title="Direção do módulo">
      <p style={{ margin: "0 0 8px", fontSize: 13, opacity: 0.85 }}>
        Frente fixa, porta, furos e animação seguem a orientação escolhida (módulo único v2).
      </p>
      <div
        role="group"
        aria-label="Direção do módulo canto"
        style={{ display: "flex", gap: 8 }}
      >
        {OPTIONS.map((opt) => {
          const active = current === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                if (!active) onOrientationChange(opt.id);
              }}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 6,
                border: active ? "2px solid var(--accent, #3b82f6)" : "1px solid var(--border, #444)",
                background: active ? "var(--accent-muted, rgba(59,130,246,0.15))" : "transparent",
                color: "inherit",
                cursor: active ? "default" : "pointer",
                fontWeight: active ? 600 : 400,
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
