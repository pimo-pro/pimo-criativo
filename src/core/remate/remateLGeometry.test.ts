import { describe, it, expect } from "vitest";
import { getRemateEnvelopeBoundsM } from "./rematePlacement";
import {
  applyLRemateGroupCoupling,
  computeLRemateCimaIntLocalOffsetMm,
  computeLRemateExtCornerFromInt,
  computeLRemateExtCornerMm,
  computeLRemateIntCornerFromExt,
  computeLRemateSheetDimensions,
  lRemateCenterToCornerMm,
  lRemateCornerToCenterMm,
  lSecondaryMountSlot,
  normalizeLRemateGroupToCima,
  REMATE_L_CIMA_INT_ROTATION,
  resolveLRemateCompositeLeadId,
  resolveLRemateGroupCouplingLeadId,
  REMATE_L_STRIP_WIDTH_MM,
  remateLIndustrialName,
  remateLIndustrialSuffix,
  resolveLRemateRenderPose,
  resolveLRemateRotation,
  snapLRemateGroupCorners,
} from "./remateLGeometry";
import type { RematePiece } from "./rematePieceTypes";
import { buildProductPieceSpecs, computeDimensionsForProduct, defaultMountSlotForProduct } from "./remateProductRules";
import { createRematePieces } from "./rematePieceFactory";

const box = {
  id: "box-1",
  nome: "MOD1",
  dimensoes: { largura: 600, altura: 720, profundidade: 500 },
} as never;

describe("remate L geometry — khaled-pro (CIMA only)", () => {
  it("defaultMountSlotForProduct L → CIMA", () => {
    expect(defaultMountSlotForProduct("L")).toBe("CIMA");
  });

  it("buildProductPieceSpecs gera duas peças CIMA+DIR (ignora slot legado)", () => {
    const specs = buildProductPieceSpecs({ productType: "L", mountSlot: "DIR" });
    expect(specs).toHaveLength(2);
    expect(specs[0]?.partIndex).toBe(1);
    expect(specs[1]?.partIndex).toBe(2);
    expect(specs[0]?.mountSlot).toBe("CIMA");
    expect(specs[1]?.mountSlot).toBe("DIR");
  });

  it("dimensões CIMA: ext e int = largura×faixa×espessura", () => {
    const ext = computeLRemateSheetDimensions({
      primarySlot: "CIMA",
      partIndex: 1,
      boxAlturaMm: 720,
      boxLarguraMm: 600,
      thicknessMm: 19,
    });
    const int = computeLRemateSheetDimensions({
      primarySlot: "CIMA",
      partIndex: 2,
      boxAlturaMm: 720,
      boxLarguraMm: 600,
      thicknessMm: 19,
    });
    expect(ext).toEqual({ width: 600, height: REMATE_L_STRIP_WIDTH_MM, depth: 19 });
    expect(int).toEqual({ width: 600, height: REMATE_L_STRIP_WIDTH_MM, depth: 19 });
  });

  it("dimensões cima via computeDimensionsForProduct", () => {
    const a = computeDimensionsForProduct({
      box,
      productType: "L",
      mountSlot: "CIMA",
      thicknessMm: 19,
      partIndex: 1,
    });
    const b = computeDimensionsForProduct({
      box,
      productType: "L",
      mountSlot: lSecondaryMountSlot("CIMA"),
      thicknessMm: 19,
      partIndex: 2,
    });
    expect(a).toEqual({ width: 600, height: 100, depth: 19 });
    expect(b).toEqual({ width: 600, height: 100, depth: 19 });
  });

  it("dimensões cima 900×720×600: ambas peças 900×100×19", () => {
    const box900 = {
      id: "box-900",
      nome: "MOD900",
      dimensoes: { largura: 900, altura: 720, profundidade: 600 },
    } as never;
    const ext = computeDimensionsForProduct({
      box: box900,
      productType: "L",
      mountSlot: "CIMA",
      thicknessMm: 19,
      partIndex: 1,
    });
    const int = computeDimensionsForProduct({
      box: box900,
      productType: "L",
      mountSlot: lSecondaryMountSlot("CIMA"),
      thicknessMm: 19,
      partIndex: 2,
    });
    expect(ext).toEqual({ width: 900, height: 100, depth: 19 });
    expect(int).toEqual({ width: 900, height: 100, depth: 19 });
  });

  it("createRematePieces cria REMATE_L_ext e REMATE_L_int em CIMA", () => {
    const pieces = createRematePieces(
      { productType: "L", mountSlot: "DIR", parentBoxId: "box-1", followBox: true },
      {
        box,
        materialPresetId: "mdf-19",
        thicknessMm: 19,
        boxDimsM: { widthM: 0.6, heightM: 0.72, depthM: 0.5 },
      }
    );
    expect(pieces).toHaveLength(2);
    expect(pieces[0]?.name).toBe("MOD1_REMATE_L_ext");
    expect(pieces[1]?.name).toBe("MOD1_REMATE_L_int");
    expect(pieces[0]?.mountSlot).toBe("CIMA");
    expect(pieces[1]?.mountSlot).toBe("DIR");
    expect(pieces[0]?.parentGroupId).toBeTruthy();
    expect(pieces[1]?.parentGroupId).toBe(pieces[0]?.parentGroupId);
  });

  it("normalizeLRemateGroupToCima converte legado ESQ para modelo CIMA", () => {
    const ext: RematePiece = {
      id: "ext-legacy",
      tipo: "L",
      productType: "L",
      partIndex: 1,
      parentGroupId: "g1",
      mountSlot: "ESQ",
      width: 100,
      height: 720,
      depth: 19,
      materialPresetId: "m",
      position: { xMm: 0, yMm: 0, zMm: 0 },
      rotation: { xRad: 0, yRad: 0, zRad: 0 },
      followBox: true,
      name: "ext",
    };
    const int: RematePiece = { ...ext, id: "int-legacy", partIndex: 2, mountSlot: "FRENTE", name: "int" };
    const normalized = normalizeLRemateGroupToCima(ext, int, {
      boxLarguraMm: 600,
      boxAlturaMm: 720,
      thicknessMm: 19,
    });
    expect(normalized.ext.mountSlot).toBe("CIMA");
    expect(normalized.int.mountSlot).toBe("DIR");
    expect(normalized.ext).toEqual(expect.objectContaining({ width: 600, height: 100, depth: 19 }));
  });

  it("normalizeLRemateGroupToCima não repõe medidas customizadas em CIMA", () => {
    const ext: RematePiece = {
      id: "ext-custom",
      tipo: "L",
      productType: "L",
      partIndex: 1,
      parentGroupId: "g-custom",
      mountSlot: "CIMA",
      width: 800,
      height: 150,
      depth: 19,
      materialPresetId: "m",
      position: { xMm: 0, yMm: 720, zMm: 281 },
      rotation: { xRad: 0, yRad: 0, zRad: 0 },
      followBox: true,
      name: "ext",
      userDimensionsLocked: true,
    };
    const int: RematePiece = {
      ...ext,
      id: "int-custom",
      partIndex: 2,
      mountSlot: "DIR",
      width: 700,
      height: 120,
      name: "int",
    };
    const normalized = normalizeLRemateGroupToCima(ext, int, {
      boxLarguraMm: 600,
      boxAlturaMm: 720,
      thicknessMm: 19,
    });
    expect(normalized.ext.width).toBe(800);
    expect(normalized.ext.height).toBe(150);
    expect(normalized.int.width).toBe(700);
    expect(normalized.int.height).toBe(120);
  });

  it("snapLRemateGroupCorners sem ctx preserva medidas customizadas", () => {
    const bounds = getRemateEnvelopeBoundsM(0.6, 0.72, 0.5, null);
    const ext: RematePiece = {
      id: "ext-snap",
      tipo: "L",
      productType: "L",
      partIndex: 1,
      parentGroupId: "g-snap",
      mountSlot: "CIMA",
      width: 800,
      height: 150,
      depth: 19,
      materialPresetId: "m",
      position: { xMm: 0, yMm: 0, zMm: 0 },
      rotation: { xRad: 0, yRad: 0, zRad: 0 },
      followBox: true,
      name: "ext",
    };
    const int: RematePiece = {
      ...ext,
      id: "int-snap",
      partIndex: 2,
      mountSlot: "DIR",
      width: 700,
      height: 120,
      name: "int",
    };
    const snapped = snapLRemateGroupCorners(ext, int, bounds);
    expect(snapped.ext.width).toBe(800);
    expect(snapped.ext.height).toBe(150);
    expect(snapped.int.width).toBe(700);
    expect(snapped.int.height).toBe(120);
  });

  it("união geométrica cima: int encaixada em ext em Z pela espessura, mesma X/Y", () => {
    const bounds = getRemateEnvelopeBoundsM(0.9, 0.72, 0.6, null);
    const ext = {
      width: 900,
      height: 100,
      depth: 19,
      mountSlot: "CIMA" as const,
      partIndex: 1 as const,
    };
    const extCorner = computeLRemateExtCornerMm("CIMA", ext, bounds);
    const intCorner = computeLRemateIntCornerFromExt(extCorner, ext, "CIMA");
    expect(intCorner.xMm).toBe(extCorner.xMm);
    expect(intCorner.yMm).toBe(extCorner.yMm);
    expect(intCorner.zMm).toBe(extCorner.zMm - ext.depth);
    expect(extCorner.yMm).toBe(bounds.maxY * 1000);
  });

  it("snap cima 900×720×600: peças no envelope do topo, int atrás em Z", () => {
    const bounds = getRemateEnvelopeBoundsM(0.9, 0.72, 0.6, null);
    const snapped = snapLRemateGroupCorners(
      {
        id: "ext",
        tipo: "L",
        productType: "L",
        partIndex: 1,
        parentGroupId: "g-cima",
        width: 900,
        height: 100,
        depth: 19,
        materialPresetId: "m",
        position: { xMm: 0, yMm: 0, zMm: 0 },
        rotation: { xRad: 0, yRad: 0, zRad: 0 },
        followBox: true,
        name: "ext",
        mountSlot: "CIMA",
      },
      {
        id: "int",
        tipo: "L",
        productType: "L",
        partIndex: 2,
        parentGroupId: "g-cima",
        width: 900,
        height: 100,
        depth: 19,
        materialPresetId: "m",
        position: { xMm: 0, yMm: 0, zMm: 0 },
        rotation: { xRad: 0, yRad: 0, zRad: 0 },
        followBox: true,
        name: "int",
        mountSlot: "DIR",
      },
      bounds
    );
    expect(snapped.ext.position.yMm).toBe(bounds.maxY * 1000);
    expect(snapped.int.position.yMm).toBe(snapped.ext.position.yMm);
    expect(snapped.int.position.zMm).toBe(snapped.ext.position.zMm - snapped.ext.depth);
  });

  it("cima int: rotação 90° em X; ext mantém rotação zero", () => {
    const bounds = getRemateEnvelopeBoundsM(0.9, 0.72, 0.6, null);
    const snapped = snapLRemateGroupCorners(
      {
        id: "ext",
        tipo: "L",
        productType: "L",
        partIndex: 1,
        parentGroupId: "g-cima-rot",
        width: 900,
        height: 100,
        depth: 19,
        materialPresetId: "m",
        position: { xMm: 0, yMm: 0, zMm: 0 },
        rotation: { xRad: 0, yRad: 0, zRad: 0 },
        followBox: true,
        name: "ext",
        mountSlot: "CIMA",
      },
      {
        id: "int",
        tipo: "L",
        productType: "L",
        partIndex: 2,
        parentGroupId: "g-cima-rot",
        width: 900,
        height: 100,
        depth: 19,
        materialPresetId: "m",
        position: { xMm: 0, yMm: 0, zMm: 0 },
        rotation: { xRad: 0, yRad: 0, zRad: 0 },
        followBox: true,
        name: "int",
        mountSlot: "DIR",
      },
      bounds
    );
    expect(snapped.ext.rotation).toEqual({ xRad: 0, yRad: 0, zRad: 0 });
    expect(snapped.int.rotation).toEqual(REMATE_L_CIMA_INT_ROTATION);
    const extPose = resolveLRemateRenderPose(snapped.ext, bounds);
    const intPose = resolveLRemateRenderPose(snapped.int, bounds);
    expect(extPose.rotation).toEqual({ xRad: 0, yRad: 0, zRad: 0 });
    expect(intPose.rotation).toEqual(REMATE_L_CIMA_INT_ROTATION);
    expect(resolveLRemateRotation(snapped.int)).toEqual(REMATE_L_CIMA_INT_ROTATION);
  });

  it("resolveLRemateCompositeLeadId resolve ext a partir de int CIMA", () => {
    const ext: RematePiece = {
      id: "ext-cima",
      tipo: "L",
      productType: "L",
      partIndex: 1,
      parentGroupId: "g-cima",
      mountSlot: "CIMA",
      width: 600,
      height: 100,
      depth: 19,
      materialPresetId: "m",
      position: { xMm: 0, yMm: 720, zMm: 481 },
      rotation: { xRad: 0, yRad: 0, zRad: 0 },
      followBox: true,
      name: "ext",
    };
    const int: RematePiece = {
      ...ext,
      id: "int-cima",
      partIndex: 2,
      mountSlot: "DIR",
      name: "int",
    };
    expect(resolveLRemateCompositeLeadId("int-cima", [ext, int])).toBe("ext-cima");
  });

  it("canto ↔ centro converte sem perda", () => {
    const piece = { width: 600, height: 100, depth: 19 };
    const corner = { xMm: 0, yMm: 720, zMm: 481 };
    const center = lRemateCornerToCenterMm(piece, corner);
    expect(lRemateCenterToCornerMm(piece, center)).toEqual(corner);
  });

  it("computeLRemateCimaIntLocalOffsetMm encaixa int atrás da espessura ext", () => {
    const offset = computeLRemateCimaIntLocalOffsetMm({ height: 100, depth: 19 });
    expect(offset).toEqual({ xMm: 0, yMm: -40.5, zMm: -59.5 });
  });

  it("coupling CIMA com rotação Y mantém encaixe pela espessura", () => {
    const ext: RematePiece = {
      id: "ext-r",
      tipo: "L",
      productType: "L",
      partIndex: 1,
      parentGroupId: "g-rot",
      mountSlot: "CIMA",
      width: 600,
      height: 100,
      depth: 19,
      materialPresetId: "m",
      position: { xMm: 0, yMm: 720, zMm: 281 },
      rotation: { xRad: 0, yRad: Math.PI / 2, zRad: 0 },
      followBox: true,
      name: "ext",
      placementMode: "FREE",
    };
    const int: RematePiece = {
      ...ext,
      id: "int-r",
      partIndex: 2,
      mountSlot: "DIR",
      name: "int",
      position: { xMm: 0, yMm: 0, zMm: 0 },
      rotation: REMATE_L_CIMA_INT_ROTATION,
    };
    const coupled = applyLRemateGroupCoupling([ext, int], "ext-r");
    const nextInt = coupled.find((p) => p.id === "int-r");
    expect(nextInt?.position.xMm).not.toBe(ext.position.xMm);
    expect(nextInt?.position.zMm).not.toBe(ext.position.zMm - ext.depth);
    const back = computeLRemateExtCornerFromInt(nextInt!.position, ext, "CIMA");
    expect(back.xMm).toBeCloseTo(ext.position.xMm, 3);
    expect(back.yMm).toBeCloseTo(ext.position.yMm, 3);
    expect(back.zMm).toBeCloseTo(ext.position.zMm, 3);
  });

  it("applyLRemateGroupCoupling move parceiro ao mover ext (CIMA Z)", () => {
    const bounds = getRemateEnvelopeBoundsM(0.6, 0.72, 0.5, null);
    const base = snapLRemateGroupCorners(
      {
        id: "ext",
        tipo: "L",
        productType: "L",
        partIndex: 1,
        parentGroupId: "g1",
        width: 600,
        height: 100,
        depth: 19,
        materialPresetId: "m",
        position: { xMm: 0, yMm: 0, zMm: 0 },
        rotation: { xRad: 0, yRad: 0, zRad: 0 },
        followBox: true,
        name: "ext",
        mountSlot: "CIMA",
      },
      {
        id: "int",
        tipo: "L",
        productType: "L",
        partIndex: 2,
        parentGroupId: "g1",
        width: 600,
        height: 100,
        depth: 19,
        materialPresetId: "m",
        position: { xMm: 0, yMm: 0, zMm: 0 },
        rotation: { xRad: 0, yRad: 0, zRad: 0 },
        followBox: true,
        name: "int",
        mountSlot: "DIR",
      },
      bounds
    );
    const movedExt = {
      ...base.ext,
      position: { xMm: base.ext.position.xMm + 10, yMm: base.ext.position.yMm, zMm: base.ext.position.zMm },
      placementMode: "FREE" as const,
    };
    const coupled = applyLRemateGroupCoupling([movedExt, base.int], "ext");
    const int = coupled.find((p) => p.id === "int")!;
    expect(int.position.xMm).toBe(movedExt.position.xMm);
    expect(int.position.yMm).toBe(movedExt.position.yMm);
    expect(int.position.zMm).toBe(movedExt.position.zMm - movedExt.depth);
  });

  it("resolveLRemateGroupCouplingLeadId: dim INT usa ext como lead", () => {
    const ext: RematePiece = {
      id: "ext-d",
      tipo: "L",
      productType: "L",
      partIndex: 1,
      parentGroupId: "g-dim",
      width: 600,
      height: 100,
      depth: 19,
      materialPresetId: "m",
      position: { xMm: 0, yMm: 720, zMm: 281 },
      rotation: { xRad: 0, yRad: 0, zRad: 0 },
      followBox: true,
      name: "ext",
      mountSlot: "CIMA",
    };
    const int: RematePiece = { ...ext, id: "int-d", partIndex: 2, mountSlot: "DIR", name: "int" };
    const remates = [ext, int];
    expect(resolveLRemateGroupCouplingLeadId("int-d", remates, { width: 500 })).toBe("ext-d");
    expect(resolveLRemateGroupCouplingLeadId("int-d", remates, { height: 80 })).toBe("ext-d");
    expect(resolveLRemateGroupCouplingLeadId("ext-d", remates, { width: 700 })).toBe("ext-d");
  });

  it("suffix industrial L_ext / L_int", () => {
    expect(remateLIndustrialSuffix(1)).toBe("L_ext");
    expect(remateLIndustrialSuffix(2)).toBe("L_int");
    expect(remateLIndustrialName(1, "MOD1")).toBe("MOD1_REMATE_L_ext");
    expect(remateLIndustrialName(2, "MOD1")).toBe("MOD1_REMATE_L_int");
  });
});
