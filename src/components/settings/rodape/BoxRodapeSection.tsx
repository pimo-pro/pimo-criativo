import { useProject } from "../../../context/useProject";
import { usePimoViewerContext } from "../../../hooks/usePimoViewerContext";
import { useUiStore } from "../../../stores/uiStore";
import Panel from "../../ui/Panel";
import type { CreateRodapeInput, RodapeKind } from "../../../core/rodape/rodapeTypes";
import { rodapeKindLabel } from "../../../core/rodape/rodapeTypes";

type Props = {
  boxId: string;
  /** Conteúdo embutido no drawer de Remate (sem Panel lateral). */
  embedded?: boolean;
};

const TOGGLES: Array<{ kind: RodapeKind; label: string }> = [
  { kind: "SIMPLE", label: "Roda pé simples" },
  { kind: "L", label: "Roda pé L (2 peças)" },
  { kind: "U", label: "Roda pé U (3 peças)" },
  { kind: "FULL", label: "Roda pé Full Wall" },
];

export default function BoxRodapeSection({ boxId, embedded = false }: Props) {
  const { project, actions } = useProject();
  const { viewerApi } = usePimoViewerContext();
  const setSelectedObject = useUiStore((s) => s.setSelectedObject);
  const setSelectedTool = useUiStore((s) => s.setSelectedTool);
  const box = project.workspaceBoxes.find((b) => b.id === boxId);
  const defaultMaterialId = box?.material || project.materialId || project.material.tipo;
  const rodapes = (project.rodapes ?? []).filter((r) => r.parentBoxId === boxId);

  const byKind = (kind: RodapeKind) => rodapes.filter((r) => r.kind === kind);

  const toggle = (kind: RodapeKind) => {
    const existing = byKind(kind);
    if (existing.length > 0) {
      existing.forEach((r) => actions.removeRodape(r.id));
      return;
    }
    const input: CreateRodapeInput = { kind, parentBoxId: boxId, materialId: defaultMaterialId };
    if (kind === "FULL" && project.room?.walls?.[0]) {
      input.parentWallId = project.room.walls[0].id;
    }
    actions.createBoxRodape(input);
  };

  const rodapeContent = (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {TOGGLES.map((item) => {
          const active = byKind(item.kind);
          return (
            <div
              key={item.kind}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                padding: "6px 8px",
                border: "1px solid var(--border-subtle)",
                borderRadius: 6,
              }}
            >
              <span style={{ fontSize: 12 }}>{item.label}</span>
              <button
                type="button"
                className={active.length ? "btn btn-danger" : "btn"}
                style={{ fontSize: 11, padding: "4px 10px" }}
                onClick={() => toggle(item.kind)}
              >
                {active.length ? "Remover" : "Adicionar"}
              </button>
            </div>
          );
        })}
      </div>

      {rodapes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          {rodapes.map((rodape) => (
            <button
              key={rodape.id}
              type="button"
              className="btn"
              style={{
                border: "1px solid var(--border-subtle)",
                borderRadius: 6,
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                opacity: rodape.visible === false ? 0.55 : 1,
                textAlign: "left",
              }}
              onClick={() => {
                setSelectedObject({ type: "rodape", id: rodape.id });
                setSelectedTool("home");
                viewerApi.selectRodape?.(rodape.id);
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: 12 }}>{rodapeKindLabel(rodape.kind, rodape.partIndex)}</strong>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {rodape.dimensions.widthMm} × {rodape.heightMm} mm
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );

  if (embedded) {
    return (
      <div
        style={{
          padding: 12,
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-main)" }}>Roda Pé</div>
        <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.45 }}>
          Rodapé inferior inteligente — alinhado à base do módulo.
        </p>
        {rodapeContent}
      </div>
    );
  }

  return (
    <Panel title="Roda Pé" description="Rodapé inferior inteligente — alinhado à base do módulo.">
      {rodapeContent}
    </Panel>
  );
}
