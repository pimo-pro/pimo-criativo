/**
 * Z-02.2 — política de attachment do gizmo de escala.
 * Scale só em caixas cadOnly (GLB / modelos externos / decorativos).
 * Peças industriais (caixa paramétrica, remate, rodapé, hemati, DIV/SEP, parede, sala) ficam de fora.
 */

export type ScaleGizmoSelection = {
  selectedRemateId: string | null;
  selectedRodapeId: string | null;
  selectedHematiId: string | null;
  selectedDivSep: { boxId: string; kind: "div" | "sep"; itemId: string } | null;
  selectedWallIndex: number | null;
  selectedRoomElementId: string | null;
  selectedRoomUtilityId: string | null;
  groupMemberCount: number;
  boxEntry: { cadOnly?: boolean; locked?: boolean } | undefined;
};

export function isIndustrialScaleTarget(selection: ScaleGizmoSelection): boolean {
  if (selection.selectedRemateId) return true;
  if (selection.selectedRodapeId) return true;
  if (selection.selectedHematiId) return true;
  if (selection.selectedDivSep) return true;
  if (selection.selectedWallIndex !== null) return true;
  if (selection.selectedRoomElementId) return true;
  if (selection.selectedRoomUtilityId) return true;
  if (selection.groupMemberCount >= 2) return true;
  if (selection.boxEntry?.locked === true) return true;
  if (selection.boxEntry && selection.boxEntry.cadOnly !== true) return true;
  return false;
}

/** true só quando o gizmo TransformControls em modo scale deve anexar à caixa cadOnly. */
export function shouldAttachScaleGizmo(selection: ScaleGizmoSelection): boolean {
  if (isIndustrialScaleTarget(selection)) return false;
  return selection.boxEntry?.cadOnly === true;
}
