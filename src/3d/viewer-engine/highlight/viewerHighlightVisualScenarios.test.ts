import { describe, it, expect, beforeEach } from "vitest";
import * as THREE from "three";
import { ViewerHighlightController } from "./ViewerHighlightController";
import { auditBoxHighlightVisuals } from "./viewerHighlightVisualAudit";
import {
  HOLE_HIGHLIGHT_OVERLAY_FLAG,
  PANEL_EDGE_OVERLAY_FLAG,
} from "./viewerHighlightConstants";
import type { TechnicalDrillHole, ViewerDrillMarkersByPanel } from "../../../core/types";

const sharedMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });

function makeController(
  boxes: Map<
    string,
    {
      mesh: THREE.Object3D;
      width: number;
      height: number;
      depth: number;
      drillMarkersByPanel?: ViewerDrillMarkersByPanel;
    }
  >,
  flags: {
    panelEdgesVisible?: boolean;
    panelRenderingEnabled?: boolean;
    industrialDesignActive?: boolean;
  } = {}
) {
  return new ViewerHighlightController({
    getBoxes: () => boxes,
    getSharedPanelEdgeMaterial: () => sharedMaterial,
    getIndustrialDesignWorkspaceEnabled: () => flags.industrialDesignActive ?? false,
    getHighlightFlags: () => ({
      panelEdgesVisible: flags.panelEdgesVisible ?? true,
      panelRenderingEnabled: flags.panelRenderingEnabled ?? false,
      industrialDesignActive: flags.industrialDesignActive ?? false,
    }),
  });
}

function cavilha(x: number, y: number, face: "esquerda" | "direita"): TechnicalDrillHole {
  return { x, y, diametro: 8, profundidade: 30, tipo: "cavilha", face };
}

describe("Cenários visuais — Caixa Forno SEP", () => {
  it("dois furos na espessura sem segmentos espúrios entre eles", () => {
    const boxRoot = new THREE.Group();
    const sep = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.019, 0.4));
    sep.name = "divsep-sep-1";
    sep.userData = {
      divSepKind: "sep",
      divSepItemId: "sep-1",
      isPanelMesh: true,
      boxId: "forno-1",
    };
    boxRoot.add(sep);

    const drillMarkers: ViewerDrillMarkersByPanel = {
      separadoresById: {
        "sep-1": [cavilha(10, 30, "esquerda"), cavilha(490, 30, "direita")],
      },
    };

    const boxes = new Map([
      ["forno-1", { mesh: boxRoot, width: 0.6, height: 0.8, depth: 0.5, drillMarkersByPanel: drillMarkers }],
    ]);

    const controller = makeController(boxes);
    controller.syncPieceHighlights(sep, true);

    const report = auditBoxHighlightVisuals("forno-1", boxRoot);
    const sepEntry = report.find((e) => e.pieceKind === "sep");
    expect(sepEntry).toBeDefined();
    expect(sepEntry!.holeOverlays).toBe(2);
    expect(sepEntry!.violations).toEqual([]);
  });
});

describe("Cenários visuais — DIV", () => {
  it("só contorno, zero overlays de furo", () => {
    const boxRoot = new THREE.Group();
    const div = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.019, 0.4));
    div.name = "divsep-div-1";
    div.userData = { divSepKind: "div", isPanelMesh: true, boxId: "box-1" };
    boxRoot.add(div);

    const boxes = new Map([["box-1", { mesh: boxRoot, width: 0.6, height: 0.8, depth: 0.5 }]]);
    makeController(boxes).syncPieceHighlights(div, true);

    const entry = auditBoxHighlightVisuals("box-1", boxRoot)[0];
    expect(entry.contourOverlays).toBeGreaterThan(0);
    expect(entry.holeOverlays).toBe(0);
    expect(entry.violations).toEqual([]);
  });
});

describe("Cenários visuais — peça oculta", () => {
  it("zero overlays visíveis quando mesh não está visível", () => {
    const boxRoot = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.019, 0.5));
    top.name = "top";
    top.userData = { panelType: "top", isPanelMesh: true, boxId: "box-1", pieceId: "box-1:top" };
    top.visible = false;
    boxRoot.add(top);

    const boxes = new Map([
      [
        "box-1",
        {
          mesh: boxRoot,
          width: 0.6,
          height: 0.8,
          depth: 0.5,
          drillMarkersByPanel: { cima: [cavilha(10, 30, "esquerda")] },
        },
      ],
    ]);

    makeController(boxes).syncPieceHighlights(top, false);

    expect(top.children.filter((c) => c.visible)).toHaveLength(0);
    const entry = auditBoxHighlightVisuals("box-1", boxRoot)[0];
    expect(entry.violations).toEqual([]);
  });
});

describe("Cenários visuais — prateleira e porta", () => {
  it("prateleira: contorno sem furos", () => {
    const boxRoot = new THREE.Group();
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.018, 0.45));
    shelf.name = "shelf-0";
    shelf.userData = { shelfIndex: 0, isPanelMesh: true, boxId: "box-1" };
    boxRoot.add(shelf);

    const boxes = new Map([["box-1", { mesh: boxRoot, width: 0.6, height: 0.8, depth: 0.5 }]]);
    makeController(boxes).syncPieceHighlights(shelf, true);

    const entry = auditBoxHighlightVisuals("box-1", boxRoot)[0];
    expect(entry.pieceKind).toBe("shelf");
    expect(entry.holeOverlays).toBe(0);
    expect(entry.contourOverlays).toBeGreaterThan(0);
  });

  it("porta com dobradiça: overlay de furo na frente", () => {
    const boxRoot = new THREE.Group();
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.019));
    door.name = "door-leaf-0";
    door.userData = {
      doorLayerId: "door-0",
      isPanelMesh: true,
      boxId: "box-1",
      doorHolesEffective: [{ x: 50, y: 100, diametro: 35, profundidade: 12, tipo: "dobradiça", face: "frente" }],
    };
    boxRoot.add(door);

    const boxes = new Map([["box-1", { mesh: boxRoot, width: 0.6, height: 0.8, depth: 0.5 }]]);
    makeController(boxes).syncPieceHighlights(door, true);

    const entry = auditBoxHighlightVisuals("box-1", boxRoot)[0];
    expect(entry.pieceKind).toBe("door");
    expect(entry.holeOverlays).toBe(1);
    expect(entry.violations).toEqual([]);
  });
});

describe("Cenários visuais — frente fixa", () => {
  it("contorno + furos SSOT sem violações", () => {
    const boxRoot = new THREE.Group();
    const frente = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.75, 0.019));
    frente.name = "frente-fixa";
    frente.userData = { isPanelMesh: true, boxId: "box-1" };
    boxRoot.add(frente);

    const boxes = new Map([
      [
        "box-1",
        {
          mesh: boxRoot,
          width: 0.6,
          height: 0.8,
          depth: 0.5,
          drillMarkersByPanel: {
            frente_fixa: [{ x: 80, y: 120, diametro: 5, profundidade: 10, tipo: "cavilha", face: "frente" }],
          },
        },
      ],
    ]);

    makeController(boxes).syncPieceHighlights(frente, true);

    const entry = auditBoxHighlightVisuals("box-1", boxRoot)[0];
    expect(entry.pieceKind).toBe("frente-fixa");
    expect(entry.holeOverlays).toBe(1);
    expect(entry.violations).toEqual([]);
  });
});

describe("Cenários visuais — bloqueio de overlay não autorizado", () => {
  it("detecta LineSegments sem flag SSOT", () => {
    const mesh = new THREE.Mesh();
    mesh.userData.pieceId = "bad-mesh";
    mesh.userData.isPanelMesh = true;
    mesh.name = "top";
    mesh.userData.panelType = "top";
    mesh.userData.boxId = "box-1";

    const rogue = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0]), 3)
      ),
      sharedMaterial
    );
    mesh.add(rogue);

    const violations = auditBoxHighlightVisuals("box-1", mesh);
    expect(violations[0]?.violations.some((v) => v.code === "HIGHLIGHT_ORPHAN_OVERLAY")).toBe(true);
  });
});
