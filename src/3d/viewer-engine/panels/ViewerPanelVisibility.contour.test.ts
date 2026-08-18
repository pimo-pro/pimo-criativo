import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createTampoCutout } from "../../../core/remate/tampoCutouts";
import { buildTampoAngleShape } from "../remate/tampoAngleGeometry";
import { buildTampoGeometryWithCutouts } from "../remate/TampoCutoutVisualizer";
import {
  createTampoPostformingGeometry,
  createTampoPostformingGeometryFromShape,
} from "../remate/tampoPostformingGeometry";
import { ViewerPanelVisibility } from "./ViewerPanelVisibility";

function makeVisibility(highlightEnabled = true) {
  const material = new THREE.LineBasicMaterial({ color: 0x1e2535 });
  const vis = new ViewerPanelVisibility({
    getBoxes: () => new Map(),
    getHighlightEnabled: () => highlightEnabled,
    getBoxIdByMesh: () => null,
    getSharedPanelEdgeMaterial: () => material,
  });
  return { vis, material };
}

function makeTampoMesh(geometry: THREE.BufferGeometry): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry);
  mesh.name = "remate-tampo-contour";
  mesh.userData.isRematePiece = true;
  mesh.userData.isTampoPiece = true;
  mesh.userData.panelType = "remate";
  mesh.userData.remateId = "tampo-contour-1";
  mesh.position.set(1.2, 0.9, -0.4);
  mesh.updateMatrixWorld(true);
  return mesh;
}

function findBlackOverlay(mesh: THREE.Mesh): THREE.LineSegments | undefined {
  return mesh.children.find(
    (child) => child.userData?.isPanelEdgeOverlay === true && child instanceof THREE.LineSegments
  ) as THREE.LineSegments | undefined;
}

/** AABB só tem arestas alinhadas aos eixos; o milan do TAMPO tem aresta inclinada no plano XY. */
function hasSlantedPlanEdge(geometry: THREE.BufferGeometry): boolean {
  const arr = geometry.attributes.position.array as ArrayLike<number>;
  for (let i = 0; i + 5 < arr.length; i += 6) {
    const dx = arr[i + 3] - arr[i];
    const dy = arr[i + 4] - arr[i + 1];
    const dz = arr[i + 5] - arr[i + 2];
    if (Math.abs(dx) > 1e-4 && Math.abs(dy) > 1e-4 && Math.abs(dz) < 1e-3) {
      return true;
    }
  }
  return false;
}

describe("ViewerPanelVisibility — contorno preto da malha real", () => {
  it("TAMPO angular: overlay segue o milan, não AABB de 12 arestas", () => {
    const { vis, material } = makeVisibility(true);
    const shape = buildTampoAngleShape(
      { frontLengthMm: 900, backLengthMm: 600, angleDeg: 0 },
      900,
      630
    );
    const geom = createTampoPostformingGeometryFromShape(shape, 0.03);
    const mesh = makeTampoMesh(geom);
    const root = new THREE.Group();
    root.add(mesh);

    vis.applyPanelVisibilityForObject(root);

    const overlay = findBlackOverlay(mesh);
    expect(overlay).toBeTruthy();
    expect(overlay!.visible).toBe(true);
    expect(overlay!.parent).toBe(mesh);
    expect(overlay!.geometry.attributes.position.count).toBeGreaterThan(0);
    expect(hasSlantedPlanEdge(overlay!.geometry)).toBe(true);

    const overlayWorld = new THREE.Vector3();
    overlay!.getWorldPosition(overlayWorld);
    expect(overlayWorld.distanceTo(mesh.position)).toBeLessThan(0.001);

    material.dispose();
    geom.dispose();
    overlay!.geometry.dispose();
  });

  it("recorte fogão: contorno preto sem arestas internas do furo", () => {
    const { vis, material } = makeVisibility(false);
    const base = createTampoPostformingGeometry(1.2, 0.63, 0.03);
    const carved = buildTampoGeometryWithCutouts(base, [
      createTampoCutout("TAMPO_CUTOUT_FOGAO"),
    ]);
    const mesh = makeTampoMesh(carved);
    const root = new THREE.Group();
    root.add(mesh);

    vis.applyPanelVisibilityForObject(root);

    const overlay = findBlackOverlay(mesh);
    expect(overlay).toBeTruthy();
    expect(overlay!.geometry.attributes.position.count).toBeGreaterThan(0);

    const arr = overlay!.geometry.attributes.position.array as ArrayLike<number>;
    let insideHole = false;
    for (let i = 0; i + 5 < arr.length; i += 6) {
      const mx = (arr[i] + arr[i + 3]) / 2;
      const my = (arr[i + 1] + arr[i + 4]) / 2;
      if (Math.abs(mx) < 0.30 && Math.abs(my) < 0.26) insideHole = true;
    }
    expect(insideHole).toBe(false);
    expect(hasSlantedPlanEdge(overlay!.geometry) || overlay!.geometry.attributes.position.count >= 24).toBe(
      true
    );

    material.dispose();
    overlay!.geometry.dispose();
    if (carved !== base) carved.dispose();
    base.dispose();
  });

  it("peça rectangular de remate: 12 arestas externas", () => {
    const { vis, material } = makeVisibility(true);
    const geom = new THREE.BoxGeometry(0.6, 0.1, 0.019);
    const mesh = new THREE.Mesh(geom);
    mesh.userData.isRematePiece = true;
    mesh.userData.panelType = "remate";
    mesh.userData.remateId = "remate-box";
    const root = new THREE.Group();
    root.add(mesh);

    vis.applyPanelVisibilityForObject(root);

    const overlay = findBlackOverlay(mesh);
    expect(overlay).toBeTruthy();
    expect(overlay!.geometry.attributes.position.count).toBe(24);

    material.dispose();
    geom.dispose();
    overlay!.geometry.dispose();
  });
});
