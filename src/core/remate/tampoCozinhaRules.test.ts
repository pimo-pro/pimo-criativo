import { describe, expect, it } from "vitest";
import { createRematePieces } from "./rematePieceFactory";
import { buildRemateCutlistItems } from "./remateCutlist";
import { resolveRemateIndustrialSuffix } from "./labels";
import {
  applyTampoIndustrialDefaults,
  computeTampoDimensions,
  isTampoCozinhaMaterial,
  isTampoCozinhaProduct,
  shouldApplyTampoRules,
  TAMPO_FIXED_WIDTH_MM,
  TAMPO_MATERIAL_ID,
  TAMPO_MAX_LENGTH_MM,
  TAMPO_THICKNESS_MM,
  validateTampoIndustrial,
} from "./tampoCozinhaRules";
import type { WorkspaceBox } from "../types";

function makeBox(largura = 800): WorkspaceBox {
  return {
    id: "box-tampo",
    nome: "Armario_Tampo",
    dimensoes: { largura, altura: 720, profundidade: 560 },
    espessura: 19,
  } as WorkspaceBox;
}

describe("TAMPO_COZINHA — Fase 1", () => {
  it("regras: largura fixa 630, matéria mdb, esp. 30", () => {
    expect(TAMPO_FIXED_WIDTH_MM).toBe(630);
    expect(TAMPO_THICKNESS_MM).toBe(30);
    expect(TAMPO_MATERIAL_ID).toBe("mdb_laminado-30");
    expect(TAMPO_MAX_LENGTH_MM).toBe(3660);
    expect(isTampoCozinhaProduct("TAMPO_COZINHA")).toBe(true);
    expect(isTampoCozinhaMaterial("mdb_laminado-30")).toBe(true);
    expect(shouldApplyTampoRules({ materialPresetId: "mdb_laminado-30" })).toBe(true);
  });

  it("computeTampoDimensions: comprimento = largura da caixa", () => {
    const dims = computeTampoDimensions({ boxLarguraMm: 800 });
    expect(dims).toEqual({ width: 800, height: 630, depth: 30 });
  });

  it("comprimento manual respeitado até 3660", () => {
    expect(computeTampoDimensions({ lengthMm: 2000 }).width).toBe(2000);
    expect(computeTampoDimensions({ lengthMm: 4000 }).width).toBe(3660);
  });

  it("validação: largura > 630 → erro", () => {
    const v = validateTampoIndustrial({ widthMm: 800, heightMm: 631 });
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes("630"))).toBe(true);
  });

  it("validação: comprimento > 3660 → erro", () => {
    const v = validateTampoIndustrial({ widthMm: 3661, heightMm: 630 });
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes("3660"))).toBe(true);
  });

  it("cria com largura 630, matéria mdb_laminado-30, esp. 30", () => {
    const box = makeBox(900);
    const pieces = createRematePieces(
      { productType: "TAMPO_COZINHA", parentBoxId: box.id, followBox: true },
      {
        box,
        materialPresetId: "mdf_branco-19",
        thicknessMm: 19,
        boxDimsM: { widthM: 0.9, heightM: 0.72, depthM: 0.56 },
      }
    );
    expect(pieces).toHaveLength(1);
    const p = pieces[0]!;
    expect(p.productType).toBe("TAMPO_COZINHA");
    expect(p.tipo).toBe("TAMPO");
    expect(p.height).toBe(630);
    expect(p.width).toBe(900);
    expect(p.depth).toBe(30);
    expect(p.materialPresetId).toBe("mdb_laminado-30");
  });

  it("matéria mdb_laminado-30 força regras TAMPO mesmo com productType AVISTA", () => {
    const pieces = createRematePieces(
      {
        productType: "AVISTA",
        materialPresetId: "mdb_laminado-30",
        mountSlot: "FRENTE",
      },
      {
        box: null,
        materialPresetId: "mdb_laminado-30",
        thicknessMm: 19,
      }
    );
    const p = pieces[0]!;
    expect(p.productType).toBe("TAMPO_COZINHA");
    expect(p.height).toBe(630);
    expect(p.materialPresetId).toBe("mdb_laminado-30");
    expect(p.depth).toBe(30);
  });

  it("cutlist: L×A×E = comprimento×630×30, tipo remate, productType TAMPO_COZINHA", () => {
    const box = makeBox(1200);
    const remates = createRematePieces(
      { productType: "TAMPO_COZINHA", parentBoxId: box.id },
      {
        box,
        materialPresetId: "mdb_laminado-30",
        thicknessMm: 30,
        boxDimsM: { widthM: 1.2, heightM: 0.72, depthM: 0.56 },
      }
    );
    const cutlist = buildRemateCutlistItems(remates, [
      { id: box.id, nome: box.nome } as never,
    ]);
    expect(cutlist).toHaveLength(1);
    const item = cutlist[0]!;
    expect(item.tipo).toBe("remate");
    expect(item.dimensoes.largura).toBe(1200);
    expect(item.dimensoes.altura).toBe(630);
    expect(item.espessura).toBe(30);
    expect(item.materialId).toBe("mdb_laminado-30");
    expect(item.metadata?.productType).toBe("TAMPO_COZINHA");
    expect(item.metadata?.laminadoFabrica).toBe(true);
    expect(item.metadata?.remateCategory).toBe("tampo_especial");
    expect(item.metadata?.remateKind).toBe("TAMPO");
  });

  it("label industrial *_REMATE_TAMPO_01", () => {
    const piece = applyTampoIndustrialDefaults({
      id: "t1",
      tipo: "TAMPO" as const,
      width: 800,
      height: 630,
      depth: 30,
      materialPresetId: "mdb_laminado-30",
      position: { xMm: 0, yMm: 0, zMm: 0 },
      rotation: { xRad: 0, yRad: 0, zRad: 0 },
      followBox: true,
      name: "x",
      parentBoxId: "box-tampo",
    });
    expect(resolveRemateIndustrialSuffix(piece)).toBe("TAMPO");
  });
});
