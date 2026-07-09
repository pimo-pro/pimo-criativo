import type { ProjectState } from "../../context/projectTypes";
import type { CutPiece } from "../../core/cutlayout/cutLayoutTypes";
import { isIndustrialDoorPanelTipo } from "../../core/doors/industrialDoorPanels";
import { isMaterialMadeira } from "../../core/materials/nestingGrainLock";
import type { WorkspaceBox } from "../../core/types";
import { readRotationSnapIndexFromMetadata } from "../../core/remate/remateIndustrialMetadata";
import { buildRemateIndustrialViewerMetadata } from "../../core/remate/remateIndustrialMetadata";

function resolveBoxWoodGrainLock(box: WorkspaceBox): boolean | undefined {
  if (box.lockWoodGrain === true) return true;
  if (box.lockWoodGrain === false) return false;
  if (isMaterialMadeira(box.material)) return true;

  const door = box.doorsLayer?.[0];
  if (door?.lockWoodGrain === true) return true;
  if (door?.lockWoodGrain === false) return false;
  if (isMaterialMadeira(door?.material ?? door?.materialId)) return true;

  const drawer = box.drawersLayer?.[0];
  if (drawer?.lockWoodGrain === true) return true;
  if (drawer?.lockWoodGrain === false) return false;
  if (isMaterialMadeira(drawer?.material ?? drawer?.materialId)) return true;

  return box.lockWoodGrain;
}

/**
 * Resolve bloqueio de veio por peça a partir do projeto (sem alterar cutlist industrial).
 */
export function resolveLockWoodGrainFromProject(
  project: ProjectState,
  cp: CutPiece
): boolean | undefined {
  const meta = cp.metadata;
  if (meta?.lockWoodGrain === true) return true;
  if (meta?.lockWoodGrain === false) return false;

  const materialId = cp.materialId;
  if (isMaterialMadeira(materialId)) return true;

  const remateId = typeof meta?.remateId === "string" ? meta.remateId : undefined;
  if (remateId) {
    const remate = (project.remates ?? []).find((r) => r.id === remateId);
    if (remate?.lockWoodGrain === true) return true;
    if (remate?.lockWoodGrain === false) return false;
    if (isMaterialMadeira(remate?.materialPresetId)) return true;
    if (remate?.parentBoxId) {
      const box = project.workspaceBoxes.find((b) => b.id === remate.parentBoxId);
      if (box) {
        const inherited = resolveBoxWoodGrainLock(box);
        if (inherited === true) return true;
      }
    }
    return remate?.lockWoodGrain;
  }

  const rodapeId = typeof meta?.rodapeId === "string" ? meta.rodapeId : undefined;
  if (rodapeId) {
    const rodape = (project.rodapes ?? []).find((r) => r.id === rodapeId);
    if (rodape?.lockWoodGrain === true) return true;
    if (rodape?.lockWoodGrain === false) return false;
    if (isMaterialMadeira(rodape?.materialId)) return true;
    return rodape?.lockWoodGrain;
  }

  const boxId = cp.boxId;
  if (!boxId) return undefined;
  const box = project.workspaceBoxes.find((b) => b.id === boxId);
  if (!box) return undefined;

  const panelId = typeof meta?.panelId === "string" ? meta.panelId : undefined;
  const tipo = cp.pieceTipo ?? "";

  if (
    (tipo === "gaveta_frente_ext" || tipo === "gaveta_frente_int" || tipo === "gaveta_frente") &&
    panelId &&
    box.panelIds?.gavetas
  ) {
    const drawerIdx = box.panelIds.gavetas.indexOf(panelId);
    if (drawerIdx >= 0) {
      const drawer = box.drawersLayer?.[drawerIdx];
      if (drawer?.lockWoodGrain === true) return true;
      if (drawer?.lockWoodGrain === false) return false;
      if (isMaterialMadeira(drawer?.material ?? drawer?.materialId)) return true;
      return drawer?.lockWoodGrain;
    }
  }
  if (tipo === "gaveta_frente_ext" || tipo === "gaveta_frente_int" || tipo === "gaveta_frente") {
    const drawer = box.drawersLayer?.[0];
    if (drawer?.lockWoodGrain === true) return true;
    if (drawer?.lockWoodGrain === false) return false;
    if (isMaterialMadeira(drawer?.material ?? drawer?.materialId)) return true;
    return drawer?.lockWoodGrain;
  }

  if (isIndustrialDoorPanelTipo(tipo) || tipo === "frente_fixa") {
    if (panelId && box.panelIds?.portas) {
      const doorIdx = box.panelIds.portas.indexOf(panelId);
      if (doorIdx >= 0) {
        const door = box.doorsLayer?.[doorIdx];
        if (door?.lockWoodGrain === true) return true;
        if (door?.lockWoodGrain === false) return false;
        if (isMaterialMadeira(door?.material ?? door?.materialId)) return true;
        return door?.lockWoodGrain;
      }
    }
    if (panelId && box.panelIds?.frente_fixa === panelId) {
      const door = box.doorsLayer?.[0];
      if (door?.lockWoodGrain === true) return true;
      if (door?.lockWoodGrain === false) return false;
      if (isMaterialMadeira(door?.material ?? door?.materialId ?? box.material)) return true;
      return door?.lockWoodGrain ?? box.lockWoodGrain;
    }
    const door = box.doorsLayer?.[0];
    if (door?.lockWoodGrain === true) return true;
    if (door?.lockWoodGrain === false) return false;
    if (isMaterialMadeira(door?.material ?? door?.materialId)) return true;
    return door?.lockWoodGrain;
  }

  if (box.lockWoodGrain === true) return true;
  if (box.lockWoodGrain === false) return false;
  if (isMaterialMadeira(box.material)) return true;
  return resolveBoxWoodGrainLock(box);
}

/**
 * Preserva rotationSnapIndex do viewer até ao nesting/corte.
 * Remates de madeira no mesmo módulo herdam o eixo da porta/frente principal.
 */
export function resolveRotationSnapIndexFromProject(
  project: ProjectState,
  cp: CutPiece
): 0 | 1 | 2 | 3 | undefined {
  const fromMeta = readRotationSnapIndexFromMetadata(cp.metadata);
  const remateId = typeof cp.metadata?.remateId === "string" ? cp.metadata.remateId : undefined;
  if (!remateId) return fromMeta;

  const remate = (project.remates ?? []).find((r) => r.id === remateId);
  if (!remate) return fromMeta;

  const remateSnap = buildRemateIndustrialViewerMetadata(remate).rotationSnapIndex;
  if (!remate.parentBoxId) return fromMeta ?? remateSnap;

  const box = project.workspaceBoxes.find((b) => b.id === remate.parentBoxId);
  if (!box) return fromMeta ?? remateSnap;

  const woodLocked =
    remate.lockWoodGrain === true ||
    isMaterialMadeira(remate.materialPresetId) ||
    resolveBoxWoodGrainLock(box) === true;

  if (!woodLocked) return fromMeta ?? remateSnap;

  const door = box.doorsLayer?.[0];
  const drawer = box.drawersLayer?.[0];
  const doorWood =
    door &&
    (door.lockWoodGrain === true || isMaterialMadeira(door.material ?? door.materialId));
  const drawerWood =
    drawer &&
    (drawer.lockWoodGrain === true || isMaterialMadeira(drawer.material ?? drawer.materialId));

  if (doorWood || drawerWood) {
    return fromMeta ?? remateSnap ?? 0;
  }

  return fromMeta ?? remateSnap;
}
