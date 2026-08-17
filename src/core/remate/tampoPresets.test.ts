import { describe, expect, it } from "vitest";
import { createRematePieces } from "./rematePieceFactory";
import { buildRemateCutlistItems } from "./remateCutlist";
import {
  TAMPO_PRESET_1,
  TAMPO_PRESET_2,
  createRemateInputFromTampoPreset,
} from "./tampoPresets";
import { normalizeTampoAngleConfig } from "./tampoAngle";
import { getTampoAnglePlanVerticesMm } from "../../3d/viewer-engine/remate/tampoAngleGeometry";
import { buildTampoAngleShape } from "../../3d/viewer-engine/remate/tampoAngleGeometry";
import { createTampoPostformingGeometryFromShape } from "../../3d/viewer-engine/remate/tampoPostformingGeometry";
import { isTampoVisualPiece } from "../../3d/viewer-engine/remate/TampoPieceVisualizer";
import { TAMPO_MATERIAL_ID, TAMPO_FIXED_WIDTH_MM, TAMPO_THICKNESS_MM } from "./tampoCozinhaRules";

describe("TAMPO presets — modelos pré-definidos", () => {
  it("preset1: frente 1995 / trás 2303 → trapézio correcto", () => {
    expect(TAMPO_PRESET_1.angleConfig.frontLengthMm).toBe(1995);
    expect(TAMPO_PRESET_1.angleConfig.backLengthMm).toBe(2303);
    expect(TAMPO_PRESET_1.angleConfig.angleDeg).toBeCloseTo(26.1, 1);
    const cfg = normalizeTampoAngleConfig(TAMPO_PRESET_1.angleConfig);
    const v = getTampoAnglePlanVerticesMm(cfg, TAMPO_PRESET_1.width, 630);
    expect(v.frontR.x - v.frontL.x).toBeCloseTo(1995, 5);
    expect(v.backR.x - v.backL.x).toBeCloseTo(2303, 5);
  });

  it("preset2: frente 1633 / trás 1818 → trapézio correcto", () => {
    expect(TAMPO_PRESET_2.angleConfig.frontLengthMm).toBe(1633);
    expect(TAMPO_PRESET_2.angleConfig.backLengthMm).toBe(1818);
    expect(TAMPO_PRESET_2.angleConfig.angleDeg).toBeCloseTo(16.4, 1);
    const cfg = normalizeTampoAngleConfig(TAMPO_PRESET_2.angleConfig);
    const v = getTampoAnglePlanVerticesMm(cfg, TAMPO_PRESET_2.width, 630);
    expect(v.frontR.x - v.frontL.x).toBeCloseTo(1633, 5);
    expect(v.backR.x - v.backL.x).toBeCloseTo(1818, 5);
  });

  it("createRematePieces a partir do preset1 — dims industriais + angleConfig", () => {
    const input = createRemateInputFromTampoPreset("tampo1");
    const pieces = createRematePieces(input, {
      materialPresetId: TAMPO_MATERIAL_ID,
      thicknessMm: TAMPO_THICKNESS_MM,
    });
    expect(pieces).toHaveLength(1);
    const p = pieces[0]!;
    expect(p.productType).toBe("TAMPO_COZINHA");
    expect(p.tipo).toBe("TAMPO");
    expect(p.materialPresetId).toBe(TAMPO_MATERIAL_ID);
    expect(p.width).toBe(1995);
    expect(p.height).toBe(TAMPO_FIXED_WIDTH_MM);
    expect(p.depth).toBe(TAMPO_THICKNESS_MM);
    expect(p.angleConfig).not.toBeNull();
    expect(p.angleConfig!.frontLengthMm).toBe(1995);
    expect(p.angleConfig!.backLengthMm).toBe(2303);
    expect(isTampoVisualPiece(p)).toBe(true);
  });

  it("createRematePieces a partir do preset2", () => {
    const pieces = createRematePieces(createRemateInputFromTampoPreset("tampo2"), {
      materialPresetId: TAMPO_MATERIAL_ID,
      thicknessMm: TAMPO_THICKNESS_MM,
    });
    const p = pieces[0]!;
    expect(p.width).toBe(1633);
    expect(p.angleConfig!.frontLengthMm).toBe(1633);
    expect(p.angleConfig!.backLengthMm).toBe(1818);
  });

  it("cutlist: 1 linha + metadata.tampoAngle (sem peças extra)", () => {
    const pieces = createRematePieces(createRemateInputFromTampoPreset("tampo1"), {
      materialPresetId: TAMPO_MATERIAL_ID,
      thicknessMm: TAMPO_THICKNESS_MM,
    });
    const items = buildRemateCutlistItems(pieces, []);
    expect(items).toHaveLength(1);
    expect(items[0]!.metadata?.tampoAngle).toMatchObject({
      frontLengthMm: 1995,
      backLengthMm: 2303,
    });
    expect(items[0]!.tipo).toBe("remate");
  });

  it("integração visual: shape → postforming FromShape (caminho TampoPieceVisualizer)", () => {
    const cfg = normalizeTampoAngleConfig(TAMPO_PRESET_1.angleConfig);
    const shape = buildTampoAngleShape(cfg, TAMPO_PRESET_1.width, 630);
    const geom = createTampoPostformingGeometryFromShape(shape, 0.03);
    expect(geom.attributes.position.count).toBeGreaterThan(0);
    geom.dispose();
  });
});
