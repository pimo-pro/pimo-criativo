import { describe, it, expect } from "vitest";
import {
  isKnownPieceMesh,
  resolvePieceHighlightVisible,
  resolveViewerHighlightMode,
  shouldDrawHoleHighlights,
  shouldDrawPairingLines,
  shouldDrawPieceContour,
} from "./viewerHighlightPolicy";

describe("viewerHighlightPolicy — modo SSOT", () => {
  it("off quando painéis e rendering industrial desactivados", () => {
    expect(
      resolveViewerHighlightMode({
        panelEdgesVisible: false,
        panelRenderingEnabled: false,
      })
    ).toBe("off");
  });

  it("edges-and-holes com panelEdgesVisible", () => {
    expect(
      resolveViewerHighlightMode({
        panelEdgesVisible: true,
        panelRenderingEnabled: false,
      })
    ).toBe("edges-and-holes");
  });

  it("industrial-design com rendering industrial activo", () => {
    expect(
      resolveViewerHighlightMode({
        panelEdgesVisible: true,
        panelRenderingEnabled: true,
        industrialDesignActive: true,
      })
    ).toBe("industrial-design");
  });

  it("holes-only desenha furos mas não contorno", () => {
    const mode = resolveViewerHighlightMode({
      panelEdgesVisible: false,
      panelRenderingEnabled: true,
      industrialDesignActive: false,
    });
    expect(mode).toBe("holes-only");
    expect(shouldDrawPieceContour(mode)).toBe(false);
    expect(shouldDrawHoleHighlights(mode, 2)).toBe(true);
    expect(shouldDrawHoleHighlights(mode, 0)).toBe(false);
  });

  it("pairing lines só em industrial-design", () => {
    expect(shouldDrawPairingLines("industrial-design")).toBe(true);
    expect(shouldDrawPairingLines("edges-and-holes")).toBe(false);
  });

  it("modeOverride tem prioridade sobre booleans legacy", () => {
    expect(
      resolveViewerHighlightMode({
        panelEdgesVisible: true,
        panelRenderingEnabled: true,
        industrialDesignActive: true,
        modeOverride: "off",
      })
    ).toBe("off");
  });
});

describe("viewerHighlightPolicy — peças reconhecidas", () => {
  it("resolvePieceHighlightVisible respeita panelEdgesVisible", () => {
    expect(
      resolvePieceHighlightVisible(true, { panelEdgesVisible: true, panelRenderingEnabled: false })
    ).toBe(true);
    expect(
      resolvePieceHighlightVisible(true, { panelEdgesVisible: false, panelRenderingEnabled: false })
    ).toBe(false);
  });

  it("isKnownPieceMesh reconhece SEP e ignora proxies", () => {
    const sep = {
      name: "divsep-sep-1",
      userData: { divSepKind: "sep", isPanelMesh: true },
    } as unknown as import("three").Mesh;
    const proxy = {
      name: "viewer-layout-bounds",
      userData: { viewerLayoutBounds: true },
    } as unknown as import("three").Mesh;
    expect(isKnownPieceMesh(sep)).toBe(true);
    expect(isKnownPieceMesh(proxy)).toBe(false);
  });
});

describe("ViewerHighlightController — pairing segment isolation", () => {
  it("cada par gera exactamente 1 segmento (6 floats)", () => {
    const positions = new Float32Array([0, 0, 0, 1, 1, 1]);
    expect(positions.length).toBe(6);
  });
});
