import { describe, expect, it } from "vitest";
import {
  computeTampoAngleDegFromLengths,
  getTampoAnglePlanVerticesMm,
  normalizeTampoAngleConfig,
} from "./tampoAngle";
import {
  buildTampoOuterPolygonMm,
  tampoCutoutsToInnerContours,
} from "./tampoIndustrialGeometry";
import { TAMPO_FIXED_WIDTH_MM } from "./tampoCozinhaRules";
import { createTampoCutout, TAMPO_CUTOUT_DEFAULTS } from "./tampoCutouts";

const W = TAMPO_FIXED_WIDTH_MM;

describe("Fase B — polígono exterior TAMPO", () => {
  it("rectângulo simples: origem BL, CCW, 1800×630", () => {
    const poly = buildTampoOuterPolygonMm({ lengthMm: 1800, widthMm: W }, null);
    expect(poly).toHaveLength(4);
    expect(poly[0]!.x).toBeCloseTo(0, 5);
    expect(poly[0]!.y).toBeCloseTo(0, 5);
    expect(poly[1]!.x).toBeCloseTo(1800, 5);
    expect(poly[1]!.y).toBeCloseTo(0, 5);
    expect(poly[2]!.x).toBeCloseTo(1800, 5);
    expect(poly[2]!.y).toBeCloseTo(W, 5);
    expect(poly[3]!.x).toBeCloseTo(0, 5);
    expect(poly[3]!.y).toBeCloseTo(W, 5);
  });

  it("milan (frente ≠ trás): trapézio com lado esquerdo a esquadria", () => {
    const cfg = normalizeTampoAngleConfig({
      frontLengthMm: 1995,
      backLengthMm: 2303,
      angleDeg: computeTampoAngleDegFromLengths(1995, 2303, W),
    });
    expect(cfg).not.toBeNull();
    const poly = buildTampoOuterPolygonMm({ lengthMm: 1995, widthMm: W }, cfg);
    expect(poly).toHaveLength(4);
    expect(poly[0]!.x).toBeCloseTo(0, 5);
    expect(poly[0]!.y).toBeCloseTo(0, 5);
    expect(poly[1]!.x).toBeCloseTo(2303, 5);
    expect(poly[1]!.y).toBeCloseTo(0, 5);
    expect(poly[2]!.x).toBeCloseTo(1995, 5);
    expect(poly[2]!.y).toBeCloseTo(W, 5);
    expect(poly[3]!.x).toBeCloseTo(0, 5);
    expect(poly[3]!.y).toBeCloseTo(W, 5);
  });
});

describe("Fase B — recortes → innerContours (centro → canto BL)", () => {
  const envelope = { lengthMm: 1800, widthMm: W };

  it("fogão centrado: x_bl = L/2 + x − w/2, y_bl = 630/2 + y − h/2", () => {
    const fogao = TAMPO_CUTOUT_DEFAULTS.TAMPO_CUTOUT_FOGAO;
    const { innerContours, rejected } = tampoCutoutsToInnerContours(
      [{ tipo: "TAMPO_CUTOUT_FOGAO", x: 0, y: 0, width: fogao.width, height: fogao.height }],
      envelope
    );
    expect(rejected).toEqual([]);
    expect(innerContours).toHaveLength(1);
    const c = innerContours[0]!;
    expect(c.x_mm).toBeCloseTo(1800 / 2 + 0 - fogao.width / 2, 5);
    expect(c.y_mm).toBeCloseTo(W / 2 + 0 - fogao.height / 2, 5);
    expect(c.x_mm).toBeCloseTo(620, 5);
    expect(c.y_mm).toBeCloseTo(70, 5);
    expect(c.largura_mm).toBe(560);
    expect(c.altura_mm).toBe(490);
    expect(c.innerCircle).toBeUndefined();
  });

  it("recorte fora do envelope → rejeitar", () => {
    const { innerContours, rejected } = tampoCutoutsToInnerContours(
      [{ tipo: "TAMPO_CUTOUT_RETANGULAR", x: 900, y: 0, width: 200, height: 200 }],
      envelope
    );
    expect(innerContours).toEqual([]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toBe("fora do envelope");
  });

  it("círculo centrado → innerCircle + rectângulo inscrito", () => {
    const diameter = 180;
    const { innerContours, rejected } = tampoCutoutsToInnerContours(
      [{ tipo: "TAMPO_CUTOUT_CIRCULAR", x: 0, y: 0, diameter }],
      envelope
    );
    expect(rejected).toEqual([]);
    expect(innerContours).toHaveLength(1);
    const c = innerContours[0]!;
    expect(c.innerCircle).toEqual({
      cx_mm: 900,
      cy_mm: 315,
      diameter_mm: 180,
    });
    const side = diameter / Math.SQRT2;
    expect(c.largura_mm).toBeCloseTo(side, 5);
    expect(c.altura_mm).toBeCloseTo(side, 5);
    expect(c.x_mm).toBeCloseTo(900 - side / 2, 5);
    expect(c.y_mm).toBeCloseTo(315 - side / 2, 5);
  });

  it("aceita TampoCutout de fábrica (createTampoCutout)", () => {
    const cut = createTampoCutout("TAMPO_CUTOUT_PIA", { x: 0, y: 0 });
    const { innerContours, rejected } = tampoCutoutsToInnerContours([cut], envelope);
    expect(rejected).toEqual([]);
    expect(innerContours[0]!.largura_mm).toBe(500);
    expect(innerContours[0]!.altura_mm).toBe(400);
    expect(innerContours[0]!.x_mm).toBeCloseTo(1800 / 2 - 250, 5);
    expect(innerContours[0]!.y_mm).toBeCloseTo(W / 2 - 200, 5);
  });
});

describe("Fase B — getTampoAnglePlanVerticesMm em core/remate (sem src/3d)", () => {
  it("sem ângulo → retângulo centrado", () => {
    const v = getTampoAnglePlanVerticesMm(null, 1200, W);
    expect(v.frontR.x - v.frontL.x).toBeCloseTo(1200, 5);
    expect(v.backR.x - v.backL.x).toBeCloseTo(1200, 5);
    expect(v.frontL.y - v.backL.y).toBeCloseTo(W, 5);
    expect(v.frontL.x).toBeCloseTo(-600, 5);
  });

  it("frente < trás → trapézio, lado esquerdo a esquadria", () => {
    const cfg = normalizeTampoAngleConfig({
      frontLengthMm: 1995,
      backLengthMm: 2303,
      angleDeg: computeTampoAngleDegFromLengths(1995, 2303, W),
    });
    const v = getTampoAnglePlanVerticesMm(cfg, 1995, W);
    expect(v.frontL.x).toBeCloseTo(v.backL.x, 5);
    expect(v.frontR.x - v.frontL.x).toBeCloseTo(1995, 5);
    expect(v.backR.x - v.backL.x).toBeCloseTo(2303, 5);
  });
});
