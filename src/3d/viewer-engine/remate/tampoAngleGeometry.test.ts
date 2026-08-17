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

function geomExtentsM(cfgFront: number, cfgBack: number, baseLengthMm: number) {
  const angle = computeTampoAngleDegFromLengths(cfgFront, cfgBack, 630);
  const cfg = normalizeTampoAngleConfig({
    frontLengthMm: cfgFront,
    backLengthMm: cfgBack,
    angleDeg: angle,
  });
  const shape = buildTampoAngleShape(cfg, baseLengthMm, 630);
  const geom = createTampoPostformingGeometryFromShape(shape, 0.03);
  geom.computeBoundingBox();
  const bb = geom.boundingBox!;
  const extents = {
    x: bb.max.x - bb.min.x,
    y: bb.max.y - bb.min.y,
    z: bb.max.z - bb.min.z,
    points: geom.attributes.position.count,
  };
  geom.dispose();
  return extents;
}

describe("TAMPO Fase 5 — geometria ângulo", () => {
  it("sem angleConfig → vértices retângulo", () => {
    const v = getTampoAnglePlanVerticesMm(null, 1200, 630);
    expect(v.frontR.x - v.frontL.x).toBeCloseTo(1200, 5);
    expect(v.backR.x - v.backL.x).toBeCloseTo(1200, 5);
    expect(v.frontL.y - v.backL.y).toBeCloseTo(630, 5);
    expect(v.frontL.x).toBeCloseTo(-600, 5);
    expect(v.frontR.x).toBeCloseTo(600, 5);
  });

  it("frente == trás → retângulo centrado intacto", () => {
    const v = getTampoAnglePlanVerticesMm(null, 1995, 630);
    expect(v.frontL.x).toBeCloseTo(v.backL.x, 5);
    expect(v.frontR.x).toBeCloseTo(v.backR.x, 5);
    expect(v.frontR.x - v.frontL.x).toBeCloseTo(1995, 5);
  });

  it("frente < trás → trapézio alongado, lado esquerdo a esquadria", () => {
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
    expect(v.frontL.x).toBeCloseTo(v.backL.x, 5);
    expect(v.frontL.y).toBeCloseTo(315, 5);
    expect(v.backL.y).toBeCloseTo(-315, 5);
    const ext = geomExtentsM(1995, 2303, 1995);
    expect(ext.x).toBeGreaterThan(2.2);
    expect(ext.x).toBeCloseTo(2.303, 1);
    expect(ext.y).toBeCloseTo(0.63, 1);
    expect(ext.z).toBeCloseTo(0.03, 2);
    expect(ext.points).toBeGreaterThan(8);
  });

  it("frente > trás → trapézio invertido, shape válido", () => {
    const v = getTampoAnglePlanVerticesMm(
      normalizeTampoAngleConfig({
        frontLengthMm: 2303,
        backLengthMm: 1995,
        angleDeg: computeTampoAngleDegFromLengths(2303, 1995, 630),
      }),
      2303,
      630
    );
    expect(v.frontR.x - v.frontL.x).toBeCloseTo(2303, 5);
    expect(v.backR.x - v.backL.x).toBeCloseTo(1995, 5);
    expect(v.frontL.x).toBeCloseTo(v.backL.x, 5);
    const ext = geomExtentsM(2303, 1995, 2303);
    expect(ext.x).toBeGreaterThan(2.2);
    expect(ext.x).toBeCloseTo(2.303, 1);
    expect(ext.y).toBeCloseTo(0.63, 1);
    expect(ext.points).toBeGreaterThan(8);
  });

  it("diferença grande → shape válido", () => {
    const shape = buildTampoAngleShape(
      normalizeTampoAngleConfig({
        frontLengthMm: 1000,
        backLengthMm: 2000,
        angleDeg: computeTampoAngleDegFromLengths(1000, 2000, 630),
      }),
      1000,
      630
    );
    expect(shape.getPoints().length).toBeGreaterThanOrEqual(4);
    const ext = geomExtentsM(1000, 2000, 1000);
    expect(ext.x).toBeGreaterThan(1.8);
    expect(ext.x).toBeCloseTo(2.0, 1);
    expect(ext.y).toBeCloseTo(0.63, 1);
    expect(ext.points).toBeGreaterThan(8);
  });

  it("diferença pequena → shape válido", () => {
    const ext = geomExtentsM(1200, 1210, 1200);
    expect(ext.x).toBeGreaterThan(1.15);
    expect(ext.x).toBeCloseTo(1.21, 1);
    expect(ext.y).toBeCloseTo(0.63, 1);
    expect(ext.points).toBeGreaterThan(8);
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
    geom.computeBoundingBox();
    const bb = geom.boundingBox!;
    expect(bb.max.x - bb.min.x).toBeCloseTo(1.2, 2);
    expect(bb.max.y - bb.min.y).toBeCloseTo(0.63, 2);
    expect(bb.max.z - bb.min.z).toBeCloseTo(0.03, 2);
    geom.dispose();
  });
});
