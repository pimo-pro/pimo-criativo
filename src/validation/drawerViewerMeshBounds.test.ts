import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { generateDrawerGroup, drawerGroupToLayerItems } from "../core/drawers";
import { buildDrawerSpecs, createDrawerObject } from "../3d/objects/DrawerFactory";
import {
  DRAWER_BODY_DELTA_LOWEST_MM,
  DRAWER_COSTA_HEIGHT_BELOW_LATERAL_MM,
  DRAWER_SIDE_BASE_ELEVATION_MAX_MM,
  DRAWER_SIDE_BASE_ELEVATION_MIN_MM,
  DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM,
} from "../core/drawers/drawerGeometryConstants";
import { settingsDefaults } from "../core/settings/settingsSchema";

vi.mock("../3d/objects/BoxMaterialApplier", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../3d/objects/BoxMaterialApplier")>();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  return {
    ...actual,
    getEdgeMaterial: () => mat,
  };
});

function findMesh(parent: THREE.Object3D, namePart: string): THREE.Mesh | undefined {
  let found: THREE.Mesh | undefined;
  parent.traverse((child) => {
    if (found) return;
    if (child instanceof THREE.Mesh && child.name.includes(namePart)) {
      found = child;
    }
  });
  return found;
}

/** Bounding box Y (mm) de uma mesh centrada, no espaço local do drawer-body. */
function meshLocalBoundsYMm(mesh: THREE.Mesh, drawerBody: THREE.Object3D): {
  minY: number;
  maxY: number;
  centerY: number;
  heightMm: number;
} {
  const geom = mesh.geometry as THREE.BoxGeometry;
  const heightM = geom.parameters.height;

  const worldPos = new THREE.Vector3();
  mesh.getWorldPosition(worldPos);
  const localPos = drawerBody.worldToLocal(worldPos.clone());

  const centerY = localPos.y * 1000;
  const heightMm = heightM * 1000;
  return {
    centerY,
    heightMm,
    minY: centerY - heightMm / 2,
    maxY: centerY + heightMm / 2,
  };
}

function buildDrawerMeshForHeight(frontHeightMm: number) {
  const group = generateDrawerGroup({
    boxWidth: 600,
    boxHeight: frontHeightMm + 40,
    boxDepth: 560,
    boxThickness: 19,
    boxId: "mesh-bounds",
    drawerCount: 1,
    drawerType: "normal",
    heightMode: "custom",
    customHeights: [frontHeightMm],
    availableDepths: settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm,
    drawerSettings: settingsDefaults.gavetas,
    espessuraCostaMm: 10,
    costaAtiva: true,
  });
  const [layer] = drawerGroupToLayerItems(group);
  const actualFrontHeightMm = layer.height!;
  const [spec] = buildDrawerSpecs([layer]);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const drawerLayer = createDrawerObject(spec, { front: material, body: material });
  const drawerBody = drawerLayer.children.find((c) => c.name.startsWith("drawer-body-"))!;
  drawerLayer.updateMatrixWorld(true);
  drawerBody.updateMatrixWorld(true);
  return { drawerBody, actualFrontHeightMm };
}

describe("viewer 3D — bounding boxes reais das meshes", () => {
  // Single/GAV_1 clássico exterior (T=19): elev 35,5 na base da frente (bodyBottom módulo = 18,5).
  const industrialElev = 35.5;

  it("constante bodyBottom GAV_1 = 18,5 mm (intervalo 12,5…60)", () => {
    expect(DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM).toBeGreaterThanOrEqual(
      DRAWER_SIDE_BASE_ELEVATION_MIN_MM
    );
    expect(DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM).toBeLessThanOrEqual(
      DRAWER_SIDE_BASE_ELEVATION_MAX_MM
    );
    expect(DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM).toBe(18.5);
  });

  it.each([234, 390])(
    "frente %i mm — single: sem flip — base laterais a 35,5 mm da frente (clássico T=19)",
    (requestedHeightMm) => {
      const { drawerBody, actualFrontHeightMm: h } = buildDrawerMeshForHeight(requestedHeightMm);
      const front = findMesh(drawerBody, "drawer-front-ext")!;
      const left = findMesh(drawerBody, "drawer-left")!;
      const back = findMesh(drawerBody, "drawer-back")!;

      const frontB = meshLocalBoundsYMm(front, drawerBody);
      const sideB = meshLocalBoundsYMm(left, drawerBody);
      const backB = meshLocalBoundsYMm(back, drawerBody);

      const expectedSideH = h - DRAWER_BODY_DELTA_LOWEST_MM;

      expect(frontB.heightMm).toBeCloseTo(h, 0);
      expect(sideB.heightMm).toBeCloseTo(expectedSideH, 0);
      expect(backB.heightMm).toBeCloseTo(
        sideB.heightMm - DRAWER_COSTA_HEIGHT_BELOW_LATERAL_MM,
        0
      );

      expect(frontB.centerY).toBeCloseTo(0, 1);
      expect(sideB.minY).toBeCloseTo(frontB.minY + industrialElev, 1);
      expect(sideB.maxY).toBeCloseTo(sideB.minY + expectedSideH, 1);
      expect(backB.minY).toBeGreaterThanOrEqual(sideB.minY - 1);
    }
  );

  it("frente 234 mm pedida — single: base corpo = 35,5 mm vs frente (clássico T=19)", () => {
    const { drawerBody, actualFrontHeightMm: h } = buildDrawerMeshForHeight(234);
    const front = findMesh(drawerBody, "drawer-front-ext")!;
    const left = findMesh(drawerBody, "drawer-left")!;

    const frontB = meshLocalBoundsYMm(front, drawerBody);
    const sideB = meshLocalBoundsYMm(left, drawerBody);

    const half = h / 2;
    const sideH = h - DRAWER_BODY_DELTA_LOWEST_MM;

    expect(frontB.centerY).toBeCloseTo(0, 1);
    expect(frontB.minY).toBeCloseTo(-half, 1);
    expect(frontB.maxY).toBeCloseTo(half, 1);
    expect(sideB.minY).toBeCloseTo(-half + industrialElev, 1);
    expect(sideB.maxY).toBeCloseTo(sideB.minY + sideH, 1);
    expect(sideB.heightMm).toBeCloseTo(sideH, 1);
  });
});
