import { describe, expect, it } from "vitest";
import {
  computeTampoAngleDegFromLengths,
  normalizeTampoAngleConfig,
} from "../../../core/remate/tampoAngle";
import { buildTampoAngleShape, getTampoAnglePlanVerticesMm } from "./tampoAngleGeometry";
import {
  createTampoPostformingGeometry,
  createTampoPostformingGeometryFromShape,
} from "./tampoPostformingGeometry";

describe("TAMPO Fase 5 — geometria ângulo", () => {
  it("sem angleConfig → vértices retângulo", () => {
    const v = getTampoAnglePlanVerticesMm(null, 1200, 630);
    expect(v.frontR.x - v.frontL.x).toBeCloseTo(1200, 5);
    expect(v.backR.x - v.backL.x).toBeCloseTo(1200, 5);
    expect(v.frontL.y - v.backL.y).toBeCloseTo(630, 5);
  });

  it("tampo1: frente 1995 / trás 2303 → trapézio", () => {
    const angle = computeTampoAngleDegFromLengths(1995, 2303, 630);
    const cfg = normalizeTampoAngleConfig({
      frontLengthMm: 1995,
      backLengthMm: 2303,
      angleDeg: angle,
    });
    expect(cfg).not.toBeNull();
    const v = getTampoAnglePlanVerticesMm(cfg, 1995, 630);
    expect(v.frontR.x - v.frontL.x).toBeCloseTo(1995, 5);
    expect(v.backR.x - v.backL.x).toBeCloseTo(2303, 5);
    expect(v.frontL.y).toBeCloseTo(315, 5);
    expect(v.backL.y).toBeCloseTo(-315, 5);
  });

  it("tampo2: frente 1633 / trás 1818 → trapézio", () => {
    const angle = computeTampoAngleDegFromLengths(1633, 1818, 630);
    const cfg = normalizeTampoAngleConfig({
      frontLengthMm: 1633,
      backLengthMm: 1818,
      angleDeg: angle,
    });
    const v = getTampoAnglePlanVerticesMm(cfg, 1633, 630);
    expect(v.frontR.x - v.frontL.x).toBeCloseTo(1633, 5);
    expect(v.backR.x - v.backL.x).toBeCloseTo(1818, 5);
  });

  it("buildTampoAngleShape devolve Shape", () => {
    const shape = buildTampoAngleShape(null, 1000, 630);
    expect(shape).toBeTruthy();
    expect(shape.getPoints().length).toBeGreaterThanOrEqual(4);
  });

  it("FromShape produz geometria com vértices", () => {
    const angle = computeTampoAngleDegFromLengths(1995, 2303, 630);
    const cfg = normalizeTampoAngleConfig({
      frontLengthMm: 1995,
      backLengthMm: 2303,
      angleDeg: angle,
    });
    const shape = buildTampoAngleShape(cfg, 1995, 630);
    const geom = createTampoPostformingGeometryFromShape(shape, 0.03);
    expect(geom.attributes.position.count).toBeGreaterThan(0);
    geom.dispose();
  });

  it("caminho retangular createTampoPostformingGeometry intacto", () => {
    const geom = createTampoPostformingGeometry(1.2, 0.63, 0.03);
    expect(geom.attributes.position.count).toBeGreaterThan(0);
    geom.dispose();
  });
});
