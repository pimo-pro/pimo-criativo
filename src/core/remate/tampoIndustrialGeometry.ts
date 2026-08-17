/**
 * Fase B — geometria industrial do TAMPO (sem Three.js).
 * Fonte: cutlist `metadata.tampoAngle` + `metadata.cutouts`.
 * Origem do polígono / innerContours: canto inferior-esquerdo do AABB.
 */

import type { TampoAngleConfig } from "./tampoAngle";
import {
  getTampoAnglePlanVerticesMm,
  resolveTampoAngleEnvelopeMm,
} from "./tampoAngle";
import { TAMPO_FIXED_WIDTH_MM } from "./tampoCozinhaRules";
import type { TampoCutout, TampoCutoutCutlistEntry } from "./tampoCutouts";
import {
  isCircularTampoCutout,
  normalizeTampoCutout,
  TAMPO_CUTOUT_DEPTH_MM,
} from "./tampoCutouts";

const EPS_MM = 1e-6;

export type TampoIndustrialEnvelopeMm = {
  lengthMm: number;
  widthMm: number;
};

export type TampoPointMm = { x: number; y: number };

/** Recorte circular preservado para Fases C/E (TCN/PDF). */
export type TampoInnerCircleMm = {
  cx_mm: number;
  cy_mm: number;
  diameter_mm: number;
};

/**
 * Contorno interno no formato `innerContours` (canto BL).
 * Círculo: rectângulo inscrito + `innerCircle` (decisão Fase B).
 */
export type TampoInnerContourMm = {
  x_mm: number;
  y_mm: number;
  largura_mm: number;
  altura_mm: number;
  innerCircle?: TampoInnerCircleMm;
};

export type TampoRejectedCutout = {
  reason: string;
  x: number;
  y: number;
  tipo?: string;
};

export type TampoCutoutsToInnerContoursResult = {
  innerContours: TampoInnerContourMm[];
  rejected: TampoRejectedCutout[];
};

export type TampoCutoutInput = TampoCutout | TampoCutoutCutlistEntry;

function envelopeWidthMm(envelope: TampoIndustrialEnvelopeMm): number {
  return Math.max(1, Number(envelope.widthMm) || TAMPO_FIXED_WIDTH_MM);
}

function envelopeLengthMm(envelope: TampoIndustrialEnvelopeMm): number {
  return Math.max(1, Number(envelope.lengthMm) || 1);
}

function toCutout(raw: TampoCutoutInput, index: number): TampoCutout {
  const id = "id" in raw && typeof raw.id === "string" && raw.id.trim() ? raw.id : `cutlist-${index}`;
  return normalizeTampoCutout({
    id,
    tipo: raw.tipo,
    x: Number(raw.x) || 0,
    y: Number(raw.y) || 0,
    depth: TAMPO_CUTOUT_DEPTH_MM,
    width: raw.width,
    height: raw.height,
    diameter: raw.diameter,
  });
}

function isRectInsideEnvelope(
  xBl: number,
  yBl: number,
  width: number,
  height: number,
  envelope: TampoIndustrialEnvelopeMm
): boolean {
  const L = envelopeLengthMm(envelope);
  const W = envelopeWidthMm(envelope);
  return (
    xBl >= -EPS_MM &&
    yBl >= -EPS_MM &&
    xBl + width <= L + EPS_MM &&
    yBl + height <= W + EPS_MM
  );
}

/**
 * Polígono exterior em mm, origem no canto inferior-esquerdo do AABB.
 * Ordem CCW: trás-esq → trás-dir → frente-dir → frente-esq.
 * Sem ângulo (ou frente=trás) → retângulo length × width.
 */
export function buildTampoOuterPolygonMm(
  envelope: TampoIndustrialEnvelopeMm,
  tampoAngle?: TampoAngleConfig | null
): TampoPointMm[] {
  const widthMm = envelopeWidthMm(envelope);
  const lengthMm = envelopeLengthMm(envelope);
  const aabb = resolveTampoAngleEnvelopeMm(tampoAngle, lengthMm, widthMm);
  const v = getTampoAnglePlanVerticesMm(tampoAngle, lengthMm, widthMm);
  const toBl = (p: TampoPointMm): TampoPointMm => ({
    x: p.x + aabb.lengthMm / 2,
    y: p.y + aabb.widthMm / 2,
  });
  return [toBl(v.backL), toBl(v.backR), toBl(v.frontR), toBl(v.frontL)];
}

/**
 * Converte cutouts (origem = centro do TAMPO) para innerContours (canto BL).
 * x_bl = envelopeLength/2 + cutout.x − width/2
 * y_bl = width/2 + cutout.y − height/2
 * Recorte circular → `innerCircle` + rectângulo inscrito (lado = D/√2).
 * Recortes fora do envelope AABB são rejeitados (não entram em innerContours).
 */
export function tampoCutoutsToInnerContours(
  cutouts: readonly TampoCutoutInput[] | undefined,
  envelope: TampoIndustrialEnvelopeMm
): TampoCutoutsToInnerContoursResult {
  const innerContours: TampoInnerContourMm[] = [];
  const rejected: TampoRejectedCutout[] = [];
  if (!cutouts?.length) return { innerContours, rejected };

  const L = envelopeLengthMm(envelope);
  const W = envelopeWidthMm(envelope);
  const env: TampoIndustrialEnvelopeMm = { lengthMm: L, widthMm: W };

  for (let i = 0; i < cutouts.length; i++) {
    const c = toCutout(cutouts[i]!, i);
    if (isCircularTampoCutout(c.tipo)) {
      const diameter = Number(c.diameter) || 0;
      if (!(diameter > 0)) {
        rejected.push({ reason: "dimensões inválidas", x: c.x, y: c.y, tipo: c.tipo });
        continue;
      }
      const cx = L / 2 + c.x;
      const cy = W / 2 + c.y;
      const aabbW = diameter;
      const aabbH = diameter;
      const aabbX = cx - aabbW / 2;
      const aabbY = cy - aabbH / 2;
      if (!isRectInsideEnvelope(aabbX, aabbY, aabbW, aabbH, env)) {
        rejected.push({ reason: "fora do envelope", x: c.x, y: c.y, tipo: c.tipo });
        continue;
      }
      const side = diameter / Math.SQRT2;
      innerContours.push({
        x_mm: cx - side / 2,
        y_mm: cy - side / 2,
        largura_mm: side,
        altura_mm: side,
        innerCircle: { cx_mm: cx, cy_mm: cy, diameter_mm: diameter },
      });
      continue;
    }

    const width = Number(c.width) || 0;
    const height = Number(c.height) || 0;
    if (!(width > 0) || !(height > 0)) {
      rejected.push({ reason: "dimensões inválidas", x: c.x, y: c.y, tipo: c.tipo });
      continue;
    }
    const xBl = L / 2 + c.x - width / 2;
    const yBl = W / 2 + c.y - height / 2;
    if (!isRectInsideEnvelope(xBl, yBl, width, height, env)) {
      rejected.push({ reason: "fora do envelope", x: c.x, y: c.y, tipo: c.tipo });
      continue;
    }
    innerContours.push({
      x_mm: xBl,
      y_mm: yBl,
      largura_mm: width,
      altura_mm: height,
    });
  }

  return { innerContours, rejected };
}

export function isTampoCozinhaCutlistMetadata(
  metadata: Record<string, unknown> | undefined | null
): boolean {
  return metadata?.productType === "TAMPO_COZINHA";
}

function parseTampoAngleFromMetadata(
  metadata: Record<string, unknown> | undefined | null
): TampoAngleConfig | null {
  const raw = metadata?.tampoAngle;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const frontLengthMm = Number(o.frontLengthMm);
  const backLengthMm = Number(o.backLengthMm);
  if (!Number.isFinite(frontLengthMm) || !Number.isFinite(backLengthMm)) return null;
  return {
    frontLengthMm,
    backLengthMm,
    angleDeg: Number(o.angleDeg) || 0,
  };
}

function parseTampoCutoutsFromMetadata(
  metadata: Record<string, unknown> | undefined | null
): TampoCutoutCutlistEntry[] {
  const raw = metadata?.cutouts;
  if (!Array.isArray(raw)) return [];
  const out: TampoCutoutCutlistEntry[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const tipo = String(o.tipo ?? "");
    if (!tipo.startsWith("TAMPO_CUTOUT_")) continue;
    out.push({
      tipo: tipo as TampoCutoutCutlistEntry["tipo"],
      x: Number(o.x) || 0,
      y: Number(o.y) || 0,
      width: o.width != null ? Number(o.width) : undefined,
      height: o.height != null ? Number(o.height) : undefined,
      diameter: o.diameter != null ? Number(o.diameter) : undefined,
    });
  }
  return out;
}

export type TampoPieceLayoutGeometryMm = {
  outerPolygonMm: TampoPointMm[];
  innerContours?: Array<{ x_mm: number; y_mm: number; largura_mm: number; altura_mm: number }>;
};

/**
 * Ponte Fase C: metadata da cutlist → geometria no CutPiece (AABB inalterado).
 */
export function buildTampoPieceGeometryFromMetadata(
  envelope: TampoIndustrialEnvelopeMm,
  metadata: Record<string, unknown> | undefined | null
): TampoPieceLayoutGeometryMm {
  const tampoAngle = parseTampoAngleFromMetadata(metadata);
  const geoEnvelope = resolveTampoAngleEnvelopeMm(
    tampoAngle,
    envelopeLengthMm(envelope),
    envelopeWidthMm(envelope)
  );
  const outerPolygonMm = buildTampoOuterPolygonMm(geoEnvelope, tampoAngle);
  const { innerContours } = tampoCutoutsToInnerContours(
    parseTampoCutoutsFromMetadata(metadata),
    geoEnvelope
  );
  return {
    outerPolygonMm,
    innerContours:
      innerContours.length > 0
        ? innerContours.map(({ x_mm, y_mm, largura_mm, altura_mm, innerCircle }) => ({
            x_mm,
            y_mm,
            largura_mm,
            altura_mm,
            ...(innerCircle ? { innerCircle } : {}),
          }))
        : undefined,
  };
}
