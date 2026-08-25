/**
 * GAV_1 Viewer — bodyBottom módulo == 18,5 mm (FAIL se 0 ou outro valor).
 * Rev v3-force-ssot: rebuild obrigatório; sem flip; sem elevação 0.
 */
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  generateDrawerGroup,
  drawerGroupToLayerItems,
  DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM,
  DRAWER_LOWEST_BODY_ELEVATION_FROM_FRONT_MM,
} from "../core/drawers";
import {
  buildDrawerSpecs,
  createDrawerObject,
  getDrawerViewerLayoutRev,
} from "../3d/objects/DrawerFactory";
import {
  isDrawerViewerBodyVerticalFlipActiveForElevationMm,
  resolveDrawerVisualBaseElevationMm,
} from "../3d/objects/drawerVisualBodyFlip";
import { settingsDefaults } from "../core/settings/settingsSchema";

vi.mock("../3d/objects/BoxMaterialApplier", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../3d/objects/BoxMaterialApplier")>();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  return { ...actual, getEdgeMaterial: () => mat };
});

function findMesh(parent: THREE.Object3D, namePart: string): THREE.Mesh | undefined {
  let found: THREE.Mesh | undefined;
  parent.traverse((c) => {
    if (!found && c instanceof THREE.Mesh && c.name.includes(namePart)) found = c;
  });
  return found;
}

describe("GAV_1 Viewer — force SSOT bodyBottom 18,5 (v3)", () => {
  it("layout rev força rebuild completo", () => {
    expect(getDrawerViewerLayoutRev()).toBe("drawer-body-ssot-floor-top-v5");
  });

  it("elevação inválida nunca devolve 0 — fallback 16,5", () => {
    expect(resolveDrawerVisualBaseElevationMm(300, 200, Number.NaN)).toBe(
      DRAWER_LOWEST_BODY_ELEVATION_FROM_FRONT_MM
    );
    expect(resolveDrawerVisualBaseElevationMm(300, 200, Number.NaN)).not.toBe(0);
  });

  it("Progressivas H=800 — mesh GAV_1 bodyBottom == 18,5 (FAIL se 0)", () => {
    const H = 800;
    const T = 19;
    const group = generateDrawerGroup({
      boxWidth: 600,
      boxHeight: H,
      boxDepth: 560,
      boxThickness: T,
      boxId: "gav1-v3-ssot",
      drawerCount: 3,
      drawerType: "normal",
      heightMode: "top_small_mid_medium_bottom_large",
      availableDepths: settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm,
      drawerSettings: settingsDefaults.gavetas,
      espessuraCostaMm: 10,
      costaAtiva: true,
    });
    const layers = drawerGroupToLayerItems(group);
    const L0 = layers[0]!;
    const elev = L0.metadata?.sideBaseElevationMm as number;
    // Clássico exterior (T=19): 16,5 + 19 = 35,5; bodyBottom módulo continua 18,5.
    expect(elev).toBe(35.5);
    expect(isDrawerViewerBodyVerticalFlipActiveForElevationMm(elev)).toBe(false);

    const [spec] = buildDrawerSpecs([L0]);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const drawerLayer = createDrawerObject(spec, { front: mat, body: mat });
    drawerLayer.updateMatrixWorld(true);
    const drawerBody = drawerLayer.children.find((c) =>
      c.name.startsWith("drawer-body-")
    )!;
    drawerBody.updateMatrixWorld(true);

    const front = findMesh(drawerBody, "drawer-front-ext")!;
    const left = findMesh(drawerBody, "drawer-left")!;
    const frontWorld = new THREE.Vector3();
    const leftWorld = new THREE.Vector3();
    front.getWorldPosition(frontWorld);
    left.getWorldPosition(leftWorld);
    const frontLocal = drawerBody.worldToLocal(frontWorld.clone());
    const leftLocal = drawerBody.worldToLocal(leftWorld.clone());
    const frontH = (front.geometry as THREE.BoxGeometry).parameters.height * 1000;
    const leftH = (left.geometry as THREE.BoxGeometry).parameters.height * 1000;
    const frontMin = frontLocal.y * 1000 - frontH / 2;
    const leftMin = leftLocal.y * 1000 - leftH / 2;
    const elevVsFront = leftMin - frontMin;

    const floorTop = -H / 2 + T; // face superior do fundo
    const layerYmm = drawerLayer.position.y * 1000;
    const bodyBottomViewer = layerYmm + leftMin - floorTop;

    expect(elevVsFront).toBeCloseTo(35.5, 1);
    expect(bodyBottomViewer).toBeCloseTo(DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM, 1);
    expect(bodyBottomViewer).toBeCloseTo(18.5, 1);
    // FAIL explícito se Viewer mostrar ~0
    expect(bodyBottomViewer).toBeGreaterThan(10);
    expect(Math.abs(bodyBottomViewer)).not.toBeLessThan(1);
  });
});
