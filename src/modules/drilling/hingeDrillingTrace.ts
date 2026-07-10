import { isHolePipelineTraceEnabled } from "../../core/cutlayout/utils/holeGeomInvariant";

export type HingeDrillingTraceStage =
  | "buildPanelDrillingResult"
  | "calcDobradica"
  | "calcDobradicaFixacao";

export type HingeDrillingTraceEntry = {
  stage: HingeDrillingTraceStage;
  tipo: string;
  larguraMm: number;
  alturaMm: number;
  openingHeightMm?: number;
  bottomGapMm?: number;
  hingeSide?: string;
  offsetsIn?: number[];
  offsetsAfterSanitize?: number[];
  oySamples?: Array<{ oy: number; yTopDown: number }>;
  holesOut?: Array<{ x: number; y: number; tipo?: string }>;
  note?: string;
};

const traceLog: HingeDrillingTraceEntry[] = [];

export function isHingeDrillingTraceEnabled(): boolean {
  return isHolePipelineTraceEnabled();
}

export function shouldTraceHingePiece(larguraMm: number, alturaMm: number): boolean {
  return isHingeDrillingTraceEnabled() || (larguraMm === 758 && alturaMm === 598);
}

export function traceHingeDrilling(entry: HingeDrillingTraceEntry): void {
  if (!shouldTraceHingePiece(entry.larguraMm, entry.alturaMm) && !isHingeDrillingTraceEnabled()) return;
  traceLog.push(entry);
  console.log("[HINGE-DRILL-TRACE]", JSON.stringify(entry, null, 2));
}

export function getHingeDrillingTraceLog(): HingeDrillingTraceEntry[] {
  return [...traceLog];
}

export function clearHingeDrillingTraceLog(): void {
  traceLog.length = 0;
}
