/**
 * Testes de proteção visual — um describe por invariante do contrato industrial.
 */
import { describe, it, expect } from "vitest";
import {
  createHoleCircleGeometry,
  createPanelContourGeometry,
  holeMmToLocalMeters,
  type PanelOutlineDims,
} from "./viewerHighlightGeometry";
import {
  assertKnownPieceMesh,
  assertViewerHighlightInvariants,
  findSpuriousSegmentsInGeometry,
} from "./viewerHighlightInvariant";
import { isKnownPieceMesh } from "./viewerHighlightPolicy";
import type { TechnicalDrillHole } from "../../../core/types";

const SEP_DIMS: PanelOutlineDims = { width: 0.5, height: 0.4, thickness: 0.019 };

describe("Protecção: highlight só em bordas ou furos", () => {
  it("contorno e furo são geometrias independentes", () => {
    const hole: TechnicalDrillHole = {
      x: 10,
      y: 30,
      diametro: 8,
      profundidade: 30,
      tipo: "cavilha",
      face: "esquerda",
    };
    const contour = createPanelContourGeometry("top", SEP_DIMS);
    const circle = createHoleCircleGeometry("top", SEP_DIMS, hole);
    expect(contour).not.toBeNull();
    expect(circle).not.toBeNull();
    expect(contour).not.toBe(circle);
  });
});

describe("Protecção: nunca em faces internas", () => {
  it("cavilha espessura não fica no plano Y central do topo", () => {
    const local = holeMmToLocalMeters("top", SEP_DIMS, {
      x: 10,
      y: 30,
      diametro: 8,
      profundidade: 30,
      tipo: "cavilha",
      face: "esquerda",
    });
    expect(local).not.toBeNull();
    expect(Math.abs(local!.y + SEP_DIMS.thickness / 2)).toBeGreaterThan(0.001);
  });
});

describe("Protecção: nunca no meio do módulo", () => {
  it("proxy de layout não é peça reconhecida", () => {
    const proxy = {
      name: "viewer-layout-bounds",
      userData: { viewerLayoutBounds: true },
    } as unknown as import("three").Mesh;
    expect(isKnownPieceMesh(proxy)).toBe(false);
    expect(assertKnownPieceMesh("layout", false)[0]?.code).toBe("HIGHLIGHT_WITHOUT_PIECE_MESH");
  });
});

describe("Protecção: nunca quando não existe furo", () => {
  it("overlay de furo sem SSOT viola invariante", () => {
    const violations = assertViewerHighlightInvariants(
      "m",
      "u",
      "top",
      SEP_DIMS,
      [],
      [{ isIndustrialDesignHoleOverlay: true }],
      [],
      { holesOnlyMode: true }
    );
    expect(violations[0]?.code).toBe("HIGHLIGHT_WITHOUT_HOLES");
  });
});

describe("Protecção: furos na espessura destacados na espessura", () => {
  it("cavilha esquerda fica em x = -width/2", () => {
    const local = holeMmToLocalMeters("top", SEP_DIMS, {
      x: 10,
      y: 30,
      diametro: 8,
      profundidade: 30,
      tipo: "cavilha",
      face: "esquerda",
    });
    expect(Math.abs(local!.x + SEP_DIMS.width / 2)).toBeLessThan(0.002);
  });
});

describe("Protecção: furos rotacionados respeitam orientação da peça", () => {
  it("painel right coloca furo face direita em x negativo", () => {
    const dims: PanelOutlineDims = { width: 0.4, height: 0.7, thickness: 0.019 };
    const local = holeMmToLocalMeters("right", dims, {
      x: 350,
      y: 100,
      diametro: 5,
      profundidade: 12,
      tipo: "prateleira",
      face: "direita",
    });
    expect(local).not.toBeNull();
    expect(Math.abs(local!.x + dims.thickness / 2)).toBeLessThan(0.002);
  });
});

describe("Protecção: sem segmentos espúrios entre furos", () => {
  it("círculo isolado não contém segmentos longos", () => {
    const geo = createHoleCircleGeometry("top", SEP_DIMS, {
      x: 10,
      y: 30,
      diametro: 8,
      profundidade: 30,
      tipo: "cavilha",
      face: "esquerda",
    })!;
    const positions = geo.getAttribute("position").array as Float32Array;
    expect(findSpuriousSegmentsInGeometry(positions, 0.05)).toEqual([]);
  });
});
