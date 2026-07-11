import { isHolePipelineTraceEnabled } from "../../core/cutlayout/utils/holeGeomInvariant";

export type DoorDrillingTraceStage =
  | "buildPanelDrillingResult"
  | "cutlistFromBoxes"
  | "sanitizeDoorPanelDrillHoles"
  | "barrier_before_copyHolesLocalInvariant";

export type DoorDrillingTraceEntry = {
  stage: DoorDrillingTraceStage;
  context?: string;
  pieceId?: string;
  tipo?: string;
  larguraMm: number;
  alturaMm: number;
  openingHeightMm?: number;
  holesIn?: Array<{ x: number; y: number; tipo?: string }>;
  holesOut?: Array<{ x: number; y: number; tipo?: string }>;
  dropped?: Array<{ x: number; y: number; tipo?: string; reason: string }>;
  note?: string;
};

const traceLog: DoorDrillingTraceEntry[] = [];

export function isDoorDrillingTraceEnabled(): boolean {
  return isHolePipelineTraceEnabled();
}

/** Trace automático para port_esq 760×498 (e equivalentes). */
export function shouldTraceDoorPiece(larguraMm: number, alturaMm: number): boolean {
  return isDoorDrillingTraceEnabled() || (larguraMm === 760 && alturaMm === 498);
}

export function traceDoorDrilling(entry: DoorDrillingTraceEntry): void {
  if (!shouldTraceDoorPiece(entry.larguraMm, entry.alturaMm) && !isDoorDrillingTraceEnabled()) return;
  traceLog.push(entry);
  console.log("[DOOR-DRILL-TRACE]", JSON.stringify(entry, null, 2));
}

export function getDoorDrillingTraceLog(): DoorDrillingTraceEntry[] {
  return [...traceLog];
}

export function clearDoorDrillingTraceLog(): void {
  traceLog.length = 0;
}
