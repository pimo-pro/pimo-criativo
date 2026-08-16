import { useEffect, useMemo, useState, type ChangeEvent, type CSSProperties } from "react";
import { useProject } from "../../../context/useProject";
import { useUiStore } from "../../../stores/uiStore";
import Panel from "../../ui/Panel";
import { listOfficialMaterials } from "../../../core/materials/materials.api";
import type {
  RemateCompletoRules,
  RemateMountSlot,
  RematePiece,
  RemateProductOptions,
  RemateProductType,
} from "../../../core/remate/rematePieceTypes";
import type { ProjectActions } from "../../../context/projectTypes";
import {
  REMATE_MOUNT_SLOT_LABELS,
  REMATE_PRODUCT_TYPE_LABELS,
} from "../../../core/remate/rematePieceTypes";
import {
  DEFAULT_AVISTA_WIDTH_MM,
  defaultCompletoRules,
  defaultMountSlotForProduct,
  inferProductTypeFromLegacy,
} from "../../../core/remate/remateProductRules";
import { getMaterialByIdOrLabel } from "../../../core/materials/service";
import WoodGrainRotationToggle from "../material/WoodGrainRotationToggle";
import WoodGrainLockToggle from "../material/WoodGrainLockToggle";
import GroupedMaterialSelect from "../material/GroupedMaterialSelect";
import { measureRemateGap, measureRemateGapToBox } from "../../../core/remate/remateGapMeasure";
import RemateRulesSection from "./RemateRulesSection";
import TampoCutoutPropertiesPanel from "./TampoCutoutPropertiesPanel";
import TampoUnionPanel from "./TampoUnionPanel";
import { OPPOSITE_MOUNT_SLOT } from "../../../core/remate/remateCloneUtils";
import { resolveRematePieceNomeForRemate } from "../../../core/remate/labels";
import { isLRemateExt, isLRemateInt } from "../../../core/remate/remateLGeometry";

type Props = { remateId: string };

function useTextField(
  value: string,
  onCommit: (next: string) => void
): {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
} {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);
  return {
    value: draft,
    onChange: (e) => setDraft(e.target.value),
    onBlur: () => {
      const trimmed = draft.trim();
      if (!trimmed) {
        setDraft(value);
        return;
      }
      onCommit(trimmed);
      setDraft(trimmed);
    },
  };
}

function useNumericField(
  value: number,
  onCommit: (next: number) => void,
  min = 1
): {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
} {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);
  return {
    value: draft,
    onChange: (e) => setDraft(e.target.value),
    onBlur: () => {
      const parsed = Number(draft);
      if (draft.trim() === "" || Number.isNaN(parsed)) {
        setDraft(String(value));
        return;
      }
      const clamped = Math.max(min, parsed);
      onCommit(clamped);
      setDraft(String(clamped));
    },
  };
}

const MOUNT_SLOTS: RemateMountSlot[] = ["FRENTE", "DIR", "ESQ", "CIMA", "FUNDO"];
const PRODUCTS: RemateProductType[] = [
  "AVISTA",
  "COMPLETO",
  "L",
  "RODAPE",
  "RODAPE_L",
  "TAMPO_COZINHA",
];

const lDimCardStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 6,
  border: "1px solid var(--border-muted, #333)",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

type LRemateDimensionsCardsProps = {
  ext: RematePiece;
  int: RematePiece | undefined;
  thicknessMm: number;
  actions: Pick<ProjectActions, "updateRemate">;
};

function LRemateDimensionsCards({ ext, int, thicknessMm, actions }: LRemateDimensionsCardsProps) {
  const extWidthField = useNumericField(ext.width ?? 1, (width) => {
    actions.updateRemate(ext.id, { width });
  });
  const extHeightField = useNumericField(ext.height ?? 1, (height) => {
    actions.updateRemate(ext.id, { height });
  });
  const intWidthField = useNumericField(int?.width ?? 1, (width) => {
    if (!int) return;
    actions.updateRemate(int.id, { width });
  });
  const intHeightField = useNumericField(int?.height ?? 1, (height) => {
    if (!int) return;
    actions.updateRemate(int.id, { height });
  });

  return (
    <>
      <div style={lDimCardStyle}>
        <div style={{ fontWeight: 600, fontSize: 12 }}>Remate L EXT (rem_L_ext)</div>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          Comprimento (mm)
          <input className="input input-sm" type="number" min={1} {...extWidthField} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          Largura (mm)
          <input className="input input-sm" type="number" min={1} {...extHeightField} />
        </label>
        <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>
          Espessura: {thicknessMm} mm (material)
        </p>
      </div>

      {int ? (
        <div style={lDimCardStyle}>
          <div style={{ fontWeight: 600, fontSize: 12 }}>Remate L INT (rem_L_int)</div>
          <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>
            Unida geometricamente à ext — medidas independentes.
          </p>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
            Comprimento (mm)
            <input className="input input-sm" type="number" min={1} {...intWidthField} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
            Largura (mm)
            <input className="input input-sm" type="number" min={1} {...intHeightField} />
          </label>
          <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>
            Espessura: {thicknessMm} mm (material)
          </p>
        </div>
      ) : null}
    </>
  );
}

export default function RematePropertiesPanel({ remateId }: Props) {
  const { project, actions } = useProject();
  const setSelectedObject = useUiStore((s) => s.setSelectedObject);
  const selectedObject = useUiStore((s) => s.selectedObject);
  const remate = (project.remates ?? []).find((r) => r.id === remateId);
  const materials = useMemo(() => listOfficialMaterials().filter((m) => m.industrial), []);

  const parentBox = remate?.parentBoxId
    ? project.workspaceBoxes.find((b) => b.id === remate.parentBoxId)
    : null;

  const targetRemate =
    remate && selectedObject.type === "remate" && selectedObject.id !== remateId
      ? (project.remates ?? []).find((r) => r.id === selectedObject.id)
      : null;

  const selectedWorkspaceBox =
    remate && project.selectedWorkspaceBoxId && project.selectedWorkspaceBoxId !== remate.parentBoxId
      ? project.workspaceBoxes.find((b) => b.id === project.selectedWorkspaceBoxId)
      : null;

  const gapMeasure = useMemo(() => {
    if (!remate) return null;
    if (targetRemate) {
      return measureRemateGap(remate, { targetRemate });
    }
    if (parentBox) {
      return measureRemateGap(remate, { parentBox });
    }
    if (selectedWorkspaceBox) {
      return measureRemateGapToBox(remate, selectedWorkspaceBox);
    }
    return null;
  }, [
    remate,
    remate?.position.xMm,
    remate?.position.yMm,
    remate?.position.zMm,
    remate?.width,
    remate?.height,
    parentBox,
    targetRemate,
    selectedWorkspaceBox,
  ]);

  const widthField = useNumericField(remate?.width ?? 1, (width) => {
    if (!remate) return;
    actions.updateRemate(remate.id, { width });
  });
  const heightField = useNumericField(remate?.height ?? 1, (height) => {
    if (!remate) return;
    actions.updateRemate(remate.id, { height });
  });

  const boxNameById = useMemo(() => {
    const out: Record<string, string> = {};
    for (const box of project.workspaceBoxes) {
      if (box?.id) out[box.id] = typeof box.nome === "string" ? box.nome : box.id;
    }
    return out;
  }, [project.workspaceBoxes]);

  const autoNome = useMemo(() => {
    if (!remate) return "";
    return resolveRematePieceNomeForRemate(remate, boxNameById);
  }, [remate, boxNameById]);

  const lGroupPieces = useMemo(() => {
    if (!remate) return null;
    const pt = remate.productType ?? inferProductTypeFromLegacy(remate);
    if (pt !== "L" || !remate.parentGroupId) return null;
    const group = (project.remates ?? []).filter(
      (r) => r.parentGroupId === remate.parentGroupId && r.productType === "L"
    );
    const ext = group.find((r) => isLRemateExt(r));
    const int = group.find((r) => isLRemateInt(r));
    if (!ext) return null;
    return { ext, int };
  }, [remate, project.remates]);

  const nomeField = useTextField(autoNome, (trimmed) => {
    if (!remate) return;
    actions.updateRemate(remate.id, {
      nomePersonalizado: trimmed === autoNome ? undefined : trimmed,
    });
  });

  if (!remate) return null;

  const productType = remate.productType ?? inferProductTypeFromLegacy(remate);
  const productOptions = remate.productOptions ?? {};
  const faceEditable = productType === "AVISTA" || productType === "COMPLETO";
  const isMain = !remate.partRole || remate.partRole === "MAIN";
  const isCompleto = productType === "COMPLETO";
  const isTampo = productType === "TAMPO_COZINHA";

  const material = getMaterialByIdOrLabel(remate.materialPresetId);
  const thicknessMm = Number(material?.espessura) || 19;

  const feetHeightMm = parentBox?.feetEnabled !== false
    ? Number(parentBox?.feetHeight ?? (parentBox?.pe_cm ?? 10) * 10) || 0
    : 0;

  const patchOptions = (patch: RemateProductOptions) =>
    actions.updateRemate(remate.id, {
      productOptions: { ...productOptions, ...patch },
      followBox: Boolean(remate.parentBoxId),
    });

  const patchCompletoRules = (rulePatch: Partial<RemateCompletoRules>) => {
    const currentRules = productOptions.completoRules ?? defaultCompletoRules();
    patchOptions({ completoRules: { ...currentRules, ...rulePatch } });
  };

  const completoRules = productOptions.completoRules ?? defaultCompletoRules();

  return (
    <Panel title="Propriedades do Remate" description={autoNome}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          Nome da peça
          <input className="input input-sm" type="text" {...nomeField} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          Tipo de produto
          <select
            className="select input-sm"
            value={productType}
            onChange={(e) =>
              actions.updateRemate(remate.id, {
                productType: e.target.value as RemateProductType,
                mountSlot: defaultMountSlotForProduct(e.target.value as RemateProductType),
                followBox: Boolean(remate.parentBoxId),
              })
            }
          >
            {PRODUCTS.map((p) => (
              <option key={p} value={p}>
                {REMATE_PRODUCT_TYPE_LABELS[p]}
              </option>
            ))}
          </select>
        </label>

        {faceEditable ? (
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
            Face de montagem
            <select
              className="select input-sm"
              value={remate.mountSlot ?? defaultMountSlotForProduct(productType)}
              onChange={(e) =>
                actions.updateRemate(remate.id, {
                  mountSlot: e.target.value as RemateMountSlot,
                  followBox: Boolean(remate.parentBoxId),
                })
              }
            >
              {MOUNT_SLOTS.map((slot) => (
                <option key={slot} value={slot}>
                  {REMATE_MOUNT_SLOT_LABELS[slot]}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {productType === "AVISTA" ? (
          <>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Largura avista (mm)
              <input
                className="input input-sm"
                type="number"
                min={10}
                value={productOptions.avistaWidthMm ?? DEFAULT_AVISTA_WIDTH_MM}
                onChange={(e) =>
                  patchOptions({
                    avistaWidthMm: Math.max(10, Number(e.target.value) || DEFAULT_AVISTA_WIDTH_MM),
                  })
                }
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={productOptions.avistaFlushToDoor ?? false}
                onChange={(e) => patchOptions({ avistaFlushToDoor: e.target.checked })}
              />
              Encostar à porta (~20 mm)
            </label>
          </>
        ) : null}

        {productType === "COMPLETO" && isMain ? (
          <>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Largura extra (mm)
              <input
                className="input input-sm"
                type="number"
                min={0}
                value={productOptions.coverageExtraMm ?? 0}
                onChange={(e) =>
                  patchOptions({ coverageExtraMm: Math.max(0, Number(e.target.value) || 0) })
                }
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={productOptions.includeTopBottomRemates ?? false}
                onChange={(e) =>
                  patchOptions({ includeTopBottomRemates: e.target.checked })
                }
              />
              Remate cima + remate fundo
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={productOptions.asPuxador ?? false}
                onChange={(e) => patchOptions({ asPuxador: e.target.checked })}
              />
              Modo puxador
            </label>
          </>
        ) : null}

        {productType === "L" && remate.partIndex !== 2 ? (
          <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>
            Remate L — posição CIMA (topo). Variantes DIR/ESQ/FUNDO serão reintroduzidas numa fase posterior.
          </p>
        ) : null}

        {isTampo ? (
          <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>
            Tampo / Remate Especial — largura fixa 630 mm, matéria MDB Laminado 30, laminado de fábrica (sem orla clássica).
          </p>
        ) : null}

        {isTampo ? (
          <TampoCutoutPropertiesPanel
            remate={remate}
            onChangeCutouts={(cutouts) => actions.updateRemate(remate.id, { cutouts })}
          />
        ) : null}

        {isTampo ? (
          <TampoUnionPanel
            remate={remate}
            otherTampos={(project.remates ?? []).filter(
              (r) =>
                r.id !== remate.id &&
                (r.productType === "TAMPO_COZINHA" || r.tipo === "TAMPO")
            )}
            onChangeUnion={(union) => actions.updateRemate(remate.id, { union })}
          />
        ) : null}

        {remate.placementMode === "FREE" ? (
          <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>Posição livre</p>
        ) : null}

        {lGroupPieces ? (
          <LRemateDimensionsCards
            ext={lGroupPieces.ext}
            int={lGroupPieces.int}
            thicknessMm={thicknessMm}
            actions={actions}
          />
        ) : (
          <>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Comprimento (mm)
              <input
                className="input input-sm"
                type="number"
                min={1}
                max={isTampo ? 3660 : undefined}
                {...widthField}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Largura (mm)
              <input
                className="input input-sm"
                type="number"
                min={1}
                readOnly={isTampo}
                disabled={isTampo}
                {...heightField}
              />
            </label>
            <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>
              Espessura: {thicknessMm} mm (material)
            </p>
          </>
        )}

        {gapMeasure ? (
          <div
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid var(--border-muted, #333)",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Distância ({gapMeasure.targetLabel})</div>
            {gapMeasure.overlapping ? (
              <span style={{ color: "var(--text-muted)" }}>Peças sobrepostas (0 mm nos eixos)</span>
            ) : (
              <>
                <div>Distância X: {gapMeasure.gapXMm} mm</div>
                <div>Distância Y: {gapMeasure.gapYMm} mm</div>
              </>
            )}
          </div>
        ) : null}

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          Material
          <GroupedMaterialSelect
            materials={materials}
            value={remate.materialPresetId}
            onChange={(materialId) =>
              actions.updateRemate(remate.id, { materialPresetId: materialId })
            }
            selectClassName="select input-sm"
            disabled={isTampo}
          />
        </label>

        <WoodGrainRotationToggle
          materialId={remate.materialPresetId}
          allowPieceRotation={remate.allowPieceRotation}
          onChange={(allow) => actions.updateRemate(remate.id, { allowPieceRotation: allow })}
        />

        <WoodGrainLockToggle
          materialId={remate.materialPresetId}
          lockWoodGrain={remate.lockWoodGrain}
          onChange={(lock) => actions.updateRemate(remate.id, { lockWoodGrain: lock })}
        />

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={remate.followBox}
            onChange={(e) => actions.updateRemate(remate.id, { followBox: e.target.checked })}
            disabled={!remate.parentBoxId}
          />
          Seguir módulo (mantém offset à face)
        </label>

        {/* Regras de dimensionamento — só para tipo COMPLETO */}
        {isCompleto && isMain ? (
          <RemateRulesSection
            rules={completoRules}
            feetHeightMm={feetHeightMm}
            onChange={patchCompletoRules}
          />
        ) : null}

        {remate.parentBoxId ? (
          <button
            type="button"
            className="btn"
            onClick={() => actions.resnapRemateToFace(remate.id)}
          >
            Reencostar à face
          </button>
        ) : null}

        <button
          type="button"
          className="btn"
          onClick={() => {
            const newId = actions.duplicateRemate(remate.id);
            if (newId) {
              setSelectedObject({ type: "remate", id: newId });
              window.viewerCore?.selectRemate?.(newId);
            }
          }}
        >
          Duplicar Remate
        </button>

        {OPPOSITE_MOUNT_SLOT[remate.mountSlot ?? "FRENTE"] && productType !== "L" && !isTampo ? (
          <button
            type="button"
            className="btn"
            onClick={() => {
              const newId = actions.createOppositeRemate(remate.id);
              if (newId) {
                setSelectedObject({ type: "remate", id: newId });
                window.viewerCore?.selectRemate?.(newId);
              }
            }}
          >
            Criar Remate Oposto
          </button>
        ) : null}

        <button type="button" className="btn btn-danger" onClick={() => actions.removeRemate(remate.id)}>
          Remover remate
        </button>
      </div>
    </Panel>
  );
}
