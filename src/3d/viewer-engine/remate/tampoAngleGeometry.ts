import * as THREE from "three";
import type { TampoAngleConfig } from "../../../core/remate/tampoAngle";
import { normalizeTampoAngleConfig } from "../../../core/remate/tampoAngle";
import { TAMPO_FIXED_WIDTH_MM } from "../../../core/remate/tampoCozinhaRules";

export type TampoPlanVertexMm = { x: number; y: number };

/**
 * Vértices da planta (mm), centrados no envelope.
 * Frente = +Y, Trás = −Y.
 * Trapézio rectângulo: lado esquerdo a esquadria; inclinação só à direita.
 * Frente == trás → retângulo centrado (mesmo que Fases 1–4).
 */
export function getTampoAnglePlanVerticesMm(
  cfg: TampoAngleConfig | null | undefined,
  baseLengthMm: number,
  widthMm: number = TAMPO_FIXED_WIDTH_MM
): {
  frontL: TampoPlanVertexMm;
  frontR: TampoPlanVertexMm;
  backL: TampoPlanVertexMm;
  backR: TampoPlanVertexMm;
} {
  const n = normalizeTampoAngleConfig(cfg, widthMm);
  const W = Math.max(1, Number(widthMm) || TAMPO_FIXED_WIDTH_MM);
  const front = n ? n.frontLengthMm : Math.max(1, Number(baseLengthMm) || 600);
  const back = n ? n.backLengthMm : front;
  const envelope = Math.max(front, back);
  const x0 = -envelope / 2;
  const yF = W / 2;
  const yB = -W / 2;
  return {
    frontL: { x: x0, y: yF },
    frontR: { x: x0 + front, y: yF },
    backR: { x: x0 + back, y: yB },
    backL: { x: x0, y: yB },
  };
}

/**
 * Shape 2D no plano X×Y (metros), centrado.
 * Sem cfg → retângulo baseLength × width.
 * Com cfg → trapézio front/back (lado esquerdo vertical).
 */
export function buildTampoAngleShape(
  cfg: TampoAngleConfig | null | undefined,
  baseLengthMm: number,
  widthMm: number = TAMPO_FIXED_WIDTH_MM
): THREE.Shape {
  const v = getTampoAnglePlanVerticesMm(cfg, baseLengthMm, widthMm);
  const toM = (mm: number) => mm / 1000;
  const shape = new THREE.Shape();
  // Contorno CCW: frente (+Y) → esquerda → trás → direita.
  shape.moveTo(toM(v.frontL.x), toM(v.frontL.y));
  shape.lineTo(toM(v.backL.x), toM(v.backL.y));
  shape.lineTo(toM(v.backR.x), toM(v.backR.y));
  shape.lineTo(toM(v.frontR.x), toM(v.frontR.y));
  shape.closePath();
  return shape;
}
