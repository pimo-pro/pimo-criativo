/**
 * Auto-posicionamento e snapping para modelos GLB dentro da caixa.
 * Evita sobreposição, aplica grid de snap e alinhamento inteligente.
 */

import type { Dimensoes } from "../types";
import { getRulesForModel } from "./modelRules";
import type { AutoPositionResult, BehaviorRule } from "./types";

export interface BoxBoundsMm {
  width: number;
  height: number;
  depth: number;
  /** Origem da caixa (canto inferior) em mm. */
  originX?: number;
  originY?: number;
  originZ?: number;
}

export interface PlacedModelMm {
  instanceId: string;
  modelId: string;
  /** Centro ou canto de referência em mm. */
  position: { x: number; y: number; z: number };
  /** Dimensões do bbox em mm (largura, altura, profundidade). */
  size: Dimensoes;
}

const DEFAULT_SNAP_MM = 10;
const DEFAULT_MARGIN_MM = 2;

/**
 * Calcula a próxima posição automática para um novo modelo, evitando sobreposição
 * com os já colocados. Usa regras de comportamento do modelo (snap, autoPosition) se existirem.
 */
export function computeAutoPosition(
  boxBounds: BoxBoundsMm,
  placedModels: PlacedModelMm[],
  modelId: string,
  modelSizeMm: Dimensoes,
  _instanceId: string
): AutoPositionResult {
  const rules = getRulesForModel(modelId);
  let snapMm = DEFAULT_SNAP_MM;
  let autoPosition: BehaviorRule["autoPosition"] = "stack";

  for (const r of rules) {
    if (r.kind !== "behavior") continue;
    const br = r as BehaviorRule;
    if (br.snapToGridMm != null) snapMm = br.snapToGridMm;
    if (br.autoPosition != null) autoPosition = br.autoPosition;
  }

  const ox = boxBounds.originX ?? 0;
  const oy = boxBounds.originY ?? 0;
  const oz = boxBounds.originZ ?? 0;
  const W = boxBounds.width;
  const H = boxBounds.height;
  const D = boxBounds.depth;

  const margin = DEFAULT_MARGIN_MM;
  const w = modelSizeMm.largura + margin;
  const h = modelSizeMm.altura + margin;
  const d = modelSizeMm.profundidade + margin;

  const snap = (v: number) => Math.round(v / snapMm) * snapMm;

  let x: number;
  let y: number;
  let z: number;

  if (autoPosition === "align_front") {
    x = ox + w / 2;
    y = oy + h / 2;
    z = oz + d / 2;
  } else if (autoPosition === "align_center") {
    x = ox + W / 2;
    y = oy + H / 2;
    z = oz + D / 2;
  } else {
    // stack: coloca ao longo de Y (altura), depois X
    let nextY = oy;
    let nextX = ox;
    let nextZ = oz;
    for (const m of placedModels) {
      const mx = m.position.x + m.size.largura / 2;
      const my = m.position.y + m.size.altura / 2;
      const mz = m.position.z + m.size.profundidade / 2;
      if (Math.abs(mz - oz) < 1) {
        nextY = Math.max(nextY, my + m.size.altura / 2 + margin);
        nextX = Math.max(nextX, mx + m.size.largura / 2 + margin);
      }
    }
    if (nextY + h / 2 > oy + H) {
      nextY = oy;
      nextX = nextX + w;
    }
    if (nextX + w / 2 > ox + W) {
      nextX = ox;
      nextZ = nextZ + d;
    }
    x = snap(nextX + w / 2);
    y = snap(nextY + h / 2);
    z = snap(nextZ + d / 2);
  }

  const clampedX = Math.max(ox + w / 2, Math.min(ox + W - w / 2, x));
  const clampedY = Math.max(oy + h / 2, Math.min(oy + H - h / 2, y));
  const clampedZ = Math.max(oz + d / 2, Math.min(oz + D - d / 2, z));

  return {
    positionMm: { x: clampedX, y: clampedY, z: clampedZ },
    snapped: snapMm > 0,
    reason: autoPosition ?? "stack",
  };
}

/**
 * Verifica se dois volumes (AABB) se sobrepõem.
 */
export function boxesOverlap(
  aPos: { x: number; y: number; z: number },
  aSize: Dimensoes,
  bPos: { x: number; y: number; z: number },
  bSize: Dimensoes,
  marginMm: number = 0
): boolean {
  const ax1 = aPos.x - aSize.largura / 2 - marginMm;
  const ax2 = aPos.x + aSize.largura / 2 + marginMm;
  const ay1 = aPos.y - aSize.altura / 2 - marginMm;
  const ay2 = aPos.y + aSize.altura / 2 + marginMm;
  const az1 = aPos.z - aSize.profundidade / 2 - marginMm;
  const az2 = aPos.z + aSize.profundidade / 2 + marginMm;

  const bx1 = bPos.x - bSize.largura / 2 - marginMm;
  const bx2 = bPos.x + bSize.largura / 2 + marginMm;
  const by1 = bPos.y - bSize.altura / 2 - marginMm;
  const by2 = bPos.y + bSize.altura / 2 + marginMm;
  const bz1 = bPos.z - bSize.profundidade / 2 - marginMm;
  const bz2 = bPos.z + bSize.profundidade / 2 + marginMm;

  return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1 && az1 < bz2 && az2 > bz1;
}

/**
 * Aplica snapping a uma posição (em mm) conforme grid definido nas regras do modelo.
 */
export function snapPosition(
  positionMm: { x: number; y: number; z: number },
  modelId: string
): { x: number; y: number; z: number } {
  const rules = getRulesForModel(modelId);
  let snapMm = DEFAULT_SNAP_MM;
  for (const r of rules) {
    if (r.kind === "behavior" && (r as BehaviorRule).snapToGridMm != null) {
      snapMm = (r as BehaviorRule).snapToGridMm!;
      break;
    }
  }
  const s = (v: number) => Math.round(v / snapMm) * snapMm;
  return { x: s(positionMm.x), y: s(positionMm.y), z: s(positionMm.z) };
}
