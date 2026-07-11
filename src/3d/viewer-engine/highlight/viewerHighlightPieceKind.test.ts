import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { resolveViewerHighlightPieceContext } from "./viewerHighlightPieceKind";

describe("viewerHighlightPieceKind — extensibilidade por tipo de peça", () => {
  const entry = {
    width: 0.6,
    height: 0.8,
    depth: 0.5,
    drillMarkersByPanel: {
      cima: [{ x: 10, y: 20, diametro: 8, profundidade: 12, tipo: "cavilha", face: "fundo" }],
      separadoresById: {
        "sep-1": [{ x: 10, y: 30, diametro: 8, profundidade: 30, tipo: "cavilha", face: "esquerda" }],
      },
    },
  };

  const getSize = () => new THREE.Vector3(0.5, 0.019, 0.4);

  it("classifica painel estrutural top", () => {
    const mesh = new THREE.Mesh();
    mesh.name = "top";
    mesh.userData = { panelType: "top", isPanelMesh: true, boxId: "box-1" };
    const ctx = resolveViewerHighlightPieceContext(mesh, entry, getSize);
    expect(ctx?.kind).toBe("structural");
    expect(ctx?.holes).toHaveLength(1);
  });

  it("classifica SEP com furos do separador", () => {
    const mesh = new THREE.Mesh();
    mesh.name = "divsep-sep-1";
    mesh.userData = { divSepKind: "sep", divSepItemId: "sep-1", isPanelMesh: true, boxId: "box-1" };
    const ctx = resolveViewerHighlightPieceContext(mesh, entry, getSize);
    expect(ctx?.kind).toBe("sep");
    expect(ctx?.holes).toHaveLength(1);
  });

  it("classifica DIV sem furos", () => {
    const mesh = new THREE.Mesh();
    mesh.name = "divsep-div-1";
    mesh.userData = { divSepKind: "div", isPanelMesh: true, boxId: "box-1" };
    const ctx = resolveViewerHighlightPieceContext(mesh, entry, getSize);
    expect(ctx?.kind).toBe("div");
    expect(ctx?.holes).toEqual([]);
  });

  it("ignora proxy de layout", () => {
    const mesh = new THREE.Mesh();
    mesh.name = "viewer-layout-bounds";
    mesh.userData = { viewerLayoutBounds: true };
    expect(resolveViewerHighlightPieceContext(mesh, entry, getSize)).toBeNull();
  });
});
