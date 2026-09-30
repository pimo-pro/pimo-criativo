import { useMemo } from "react";
import UnifiedPopover from "../../ui/UnifiedPopover";
import type { WorkspaceBox } from "../../../core/types";
import {
  COSTA_FIXED_THICKNESS_MM,
  listIndustrialMaterialFamilyOptions,
  listIndustrialThicknessOptionsForFamily,
  materialFamilyKeyFromMaterialId,
  resolveCostaMaterial,
  resolveCostaMaterialForBox,
  resolveIndustrialMaterialVariant,
} from "../../../core/materials/materials.api";

type CostaMaterialControlProps = {
  box: WorkspaceBox;
  projectMaterialId?: string;
  disabled?: boolean;
  onApply: (costaMaterialId: string, costaThicknessMm: number) => void;
  onReset: () => void;
};

function resolveBodyMaterialId(box: WorkspaceBox, projectMaterialId?: string): string {
  const fromBox = box.material?.trim();
  if (fromBox) return fromBox;
  const fromProject = projectMaterialId?.trim();
  if (fromProject) return fromProject;
  return "mdf_branco";
}

function resolveEffectiveFamilyKey(box: WorkspaceBox, projectMaterialId?: string): string {
  const customFamily = box.costaMaterialId
    ? materialFamilyKeyFromMaterialId(box.costaMaterialId)
    : null;
  if (customFamily) return customFamily;
  const bodyId = resolveBodyMaterialId(box, projectMaterialId);
  return materialFamilyKeyFromMaterialId(resolveCostaMaterial(bodyId).materialId) ?? "mdf_branco";
}

function resolveEffectiveThicknessMm(box: WorkspaceBox, projectMaterialId?: string): number {
  if (box.costaThicknessMm != null && Number.isFinite(box.costaThicknessMm) && box.costaThicknessMm > 0) {
    return box.costaThicknessMm;
  }
  const bodyId = resolveBodyMaterialId(box, projectMaterialId);
  return resolveCostaMaterialForBox(box, bodyId).thicknessMm;
}

export default function CostaMaterialControl({
  box,
  projectMaterialId,
  disabled = false,
  onApply,
  onReset,
}: CostaMaterialControlProps) {
  const families = useMemo(() => listIndustrialMaterialFamilyOptions(), []);
  const bodyMaterialId = resolveBodyMaterialId(box, projectMaterialId);
  const defaultCosta = resolveCostaMaterialForBox(undefined, bodyMaterialId);
  const isCustom = box.costaMaterialId != null || box.costaThicknessMm != null;
  const effective = resolveCostaMaterialForBox(box, bodyMaterialId);
  const familyKey = resolveEffectiveFamilyKey(box, projectMaterialId);
  const thicknessMm = resolveEffectiveThicknessMm(box, projectMaterialId);
  const thicknessOptions = listIndustrialThicknessOptionsForFamily(familyKey);

  const applySelection = (nextFamilyKey: string, nextThicknessMm: number) => {
    const variant = resolveIndustrialMaterialVariant(nextFamilyKey, nextThicknessMm);
    if (!variant) return;
    const isDefault =
      variant.canonicalId === defaultCosta.materialId && nextThicknessMm === COSTA_FIXED_THICKNESS_MM;
    if (isDefault) {
      onReset();
      return;
    }
    onApply(variant.canonicalId, nextThicknessMm);
  };

  return (
    <UnifiedPopover
      id="costa-material-popover"
      fullWidth
      triggerVariant="ghost"
      triggerTitle={
        disabled
          ? "Active a costa para editar o material."
          : "Material e espessura da peça COSTA (costas)."
      }
      trigger={
        <span style={{ opacity: disabled ? 0.45 : 1, pointerEvents: disabled ? "none" : "auto" }}>
          Material da costa
        </span>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0, maxWidth: "100%", width: "100%", padding: 4 }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.45 }}>
          {isCustom
            ? `Actual: ${effective.label} · ${effective.thicknessMm} mm`
            : `Padrão: ${defaultCosta.label} · ${defaultCosta.thicknessMm} mm (família do corpo)`}
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          <span style={{ color: "var(--text-muted)" }}>Material</span>
          <select
            className="input input-sm"
            value={familyKey}
            onChange={(e) => applySelection(e.target.value, thicknessMm)}
          >
            {families.map((family) => (
              <option key={family.familyKey} value={family.familyKey}>
                {family.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          <span style={{ color: "var(--text-muted)" }}>Espessura (mm)</span>
          <select
            className="input input-sm"
            value={thicknessMm}
            onChange={(e) => applySelection(familyKey, Number(e.target.value))}
          >
            {thicknessOptions.map((t) => (
              <option key={t} value={t}>
                {t} mm
              </option>
            ))}
          </select>
        </label>
        {isCustom && (
          <button type="button" className="button button-ghost" style={{ fontSize: 12 }} onClick={onReset}>
            Restaurar padrão (família + 10 mm)
          </button>
        )}
      </div>
    </UnifiedPopover>
  );
}
