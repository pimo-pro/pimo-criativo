import { useMemo } from "react";
import { useProject } from "../../../context/useProject";
import Panel from "../../ui/Panel";
import { listOfficialMaterials, resolveSeparadorMaterialForBox, resolveFrenteFixaMaterialForBox } from "../../../core/materials/materials.api";
import { getViewerMaterialId } from "../../../core/materials/service";
import { normalizeOrlaPresets } from "../../../core/orla/orlaPresets";
import WoodGrainRotationToggle from "./WoodGrainRotationToggle";
import { resolveDoorLabel } from "../../../core/doors/doorLabels";
import { isCornerDireitaInferiorModel } from "../../../core/cornerCabinet";

type SelecionarMaterialSectionProps = {
  boxId: string;
  /** Conteúdo sem Panel (ex.: dentro de UnifiedPopover). */
  embedded?: boolean;
  onViewerMaterialChange?: (_boxId: string, _materialId: string) => void;
  onDoorMaterialChange?: (_boxId: string, _doorLayerId: string, _materialId: string) => void;
  onDrawerMaterialChange?: (_boxId: string, _drawerLayerId: string, _materialId: string) => void;
  onFixedFrontMaterialChange?: (_boxId: string, _materialId: string) => void;
};

export default function SelecionarMaterialSection({
  boxId,
  embedded = false,
  onViewerMaterialChange,
  onDoorMaterialChange,
  onDrawerMaterialChange,
  onFixedFrontMaterialChange,
}: SelecionarMaterialSectionProps) {
  const { project, actions } = useProject();
  const box = project.workspaceBoxes.find((item) => item.id === boxId);
  const woodMaterials = useMemo(
    () => listOfficialMaterials().filter((material) => material.industrial && material.visual),
    []
  );
  const orlaPresets = normalizeOrlaPresets(project.orlaPresets);

  if (!box) return null;

  const fallbackMaterialId = box.material || project.materialId || project.material.tipo;
  const currentMaterialId = fallbackMaterialId;
  const hasDoor = box.portaTipo !== "sem_porta" && (box.doorsLayer?.length ?? 0) > 0;
  const hasDrawers = (box.gavetas ?? 0) > 0 && (box.drawersLayer?.length ?? 0) > 0;
  const hasSeparadores = (box.separadores?.length ?? 0) > 0;
  const hasFixedFront = isCornerDireitaInferiorModel(box.baseCabinetId);
  const separadorMaterialId =
    box.separadorMaterialId ??
    resolveSeparadorMaterialForBox(box, currentMaterialId).materialId;
  const fixedFrontMaterialId =
    box.frenteFixaMaterialId ??
    resolveFrenteFixaMaterialForBox(box, currentMaterialId).materialId;

  const content = (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <section style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
          Material da Caixa
        </div>
        <select
          className="select"
          value={currentMaterialId}
          onChange={(e) => {
            const materialId = e.target.value;
            actions.setWorkspaceBoxMaterial(boxId, materialId);
            onViewerMaterialChange?.(boxId, getViewerMaterialId(materialId));
          }}
        >
          {woodMaterials.map((material) => (
            <option key={material.canonicalId} value={material.canonicalId}>
              {material.label}
            </option>
          ))}
        </select>
        <WoodGrainRotationToggle
          materialId={currentMaterialId}
          allowPieceRotation={box.allowPieceRotation}
          onChange={(allow) => actions.setWorkspaceBoxAllowPieceRotation(boxId, allow)}
        />
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
          Orla
        </div>
        <select
          className="select"
          value={box.orlaPresetId ?? ""}
          onChange={(e) => actions.setBoxOrlaPreset(boxId, e.target.value || null)}
        >
          <option value="">Sem orla</option>
          {orlaPresets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.nome}
            </option>
          ))}
        </select>
      </section>

      {hasSeparadores && (
        <section style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
            Separador
          </div>
          <select
            className="select"
            value={separadorMaterialId}
            onChange={(e) => {
              const materialId = e.target.value;
              const isBodyDefault = materialId === currentMaterialId;
              actions.setWorkspaceBoxSeparadorMaterial(
                boxId,
                isBodyDefault ? undefined : materialId
              );
            }}
          >
            {woodMaterials.map((material) => (
              <option key={material.canonicalId} value={material.canonicalId}>
                {material.label}
              </option>
            ))}
          </select>
        </section>
      )}

      {hasFixedFront && (
        <section style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
            Material da frente fixa
          </div>
          <select
            className="select"
            value={fixedFrontMaterialId}
            onChange={(e) => {
              const materialId = e.target.value;
              const isBodyDefault = materialId === currentMaterialId;
              actions.setWorkspaceBoxFrenteFixaMaterial(
                boxId,
                isBodyDefault ? undefined : materialId
              );
              onFixedFrontMaterialChange?.(boxId, getViewerMaterialId(materialId));
            }}
          >
            {woodMaterials.map((material) => (
              <option key={material.canonicalId} value={material.canonicalId}>
                {material.label}
              </option>
            ))}
          </select>
        </section>
      )}

      {hasDoor &&
        (box.doorsLayer ?? []).map((door, index) => {
          const doorMaterialId = door.material ?? door.materialId ?? fallbackMaterialId;
          const label = resolveDoorLabel(door, index, box.doorsLayer ?? []);
          return (
            <section key={door.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                {label}
              </div>
              <select
                className="select"
                value={doorMaterialId}
                onChange={(e) => {
                  const materialId = e.target.value;
                  actions.setDoorMaterial(boxId, door.id, materialId);
                  onDoorMaterialChange?.(boxId, door.id, getViewerMaterialId(materialId));
                }}
              >
                {woodMaterials.map((material) => (
                  <option key={material.canonicalId} value={material.canonicalId}>
                    {material.label}
                  </option>
                ))}
              </select>
              <WoodGrainRotationToggle
                materialId={doorMaterialId}
                allowPieceRotation={door.allowPieceRotation}
                onChange={(allow) => actions.setDoorAllowPieceRotation(boxId, door.id, allow)}
                compact
              />
            </section>
          );
        })}

      {hasDrawers &&
        (box.drawersLayer ?? []).map((drawer, index) => {
          const drawerMaterialId = drawer.material ?? fallbackMaterialId;
          const label =
            (box.drawersLayer?.length ?? 0) > 1
              ? `Gaveta ${index + 1} — frente`
              : "Gaveta — frente";
          return (
            <section key={drawer.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                {label}
              </div>
              <select
                className="select"
                value={drawerMaterialId}
                onChange={(e) => {
                  const materialId = e.target.value;
                  actions.setDrawerMaterial(boxId, drawer.id, materialId);
                  onDrawerMaterialChange?.(boxId, drawer.id, getViewerMaterialId(materialId));
                }}
              >
                {woodMaterials.map((material) => (
                  <option key={material.canonicalId} value={material.canonicalId}>
                    {material.label}
                  </option>
                ))}
              </select>
              <WoodGrainRotationToggle
                materialId={drawerMaterialId}
                allowPieceRotation={drawer.allowPieceRotation}
                onChange={(allow) => actions.setDrawerAllowPieceRotation(boxId, drawer.id, allow)}
                compact
              />
            </section>
          );
        })}
    </div>
  );

  if (embedded) return content;

  return (
    <Panel title="Selecionar Material" titleHelpText="Material da caixa e orla do box selecionado.">
      {content}
    </Panel>
  );
}
