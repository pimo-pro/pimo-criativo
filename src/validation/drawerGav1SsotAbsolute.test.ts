/**
 * SSOT absoluto GAV_1: bodyBottom=18,5 · Y_guia=41 · distância frente↔corpo derivada=16,5.
 * Viewer e layers devem coincidir. FAIL se bodyBottom≈0 ou ≠18,5.
 */
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  assertGav1IndustrialSsotOrThrow,
  DRAWER_GAV1_MODULE_GUIDE_AXIS_MM,
  DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM,
  DRAWER_LOWEST_BODY_ELEVATION_FROM_FRONT_MM,
  DRAWER_LOWEST_FRONT_BOTTOM_FROM_MODULE_BASE_MM,
  DRAWER_SLIDE_AXIS_FROM_DRAWER_SIDE_BOTTOM_MM,
  generateDrawerGroup,
  drawerGroupToLayerItems,
  resolveGav1BodyBottomFromModuleBaseMm,
  resolveDrawerBodyBottomFromModuleBaseMm,
} from "../core/drawers";
import {
  buildDrawerSpecs,
  createDrawerObject,
  getDrawerViewerLayoutRev,
} from "../3d/objects/DrawerFactory";
import {
  DEFAULT_CORREDICA_EIXO_GAVETA1_MM,
  resolveEuropeanModuleRunnerLinesYMm,
} from "../core/drawers/drilling/DrawerDrillingRules";
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

describe("SSOT absoluto GAV_1 — 18,5 / 22,5 / 41", () => {
  it("protecção: constantes sagradas", () => {
    expect(() => assertGav1IndustrialSsotOrThrow()).not.toThrow();
    expect(DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM).toBe(18.5);
    expect(DRAWER_SLIDE_AXIS_FROM_DRAWER_SIDE_BOTTOM_MM).toBe(22.5);
    expect(DRAWER_GAV1_MODULE_GUIDE_AXIS_MM).toBe(41);
    expect(DEFAULT_CORREDICA_EIXO_GAVETA1_MM).toBe(41);
    expect(DRAWER_LOWEST_BODY_ELEVATION_FROM_FRONT_MM).toBe(16.5);
    expect(resolveGav1BodyBottomFromModuleBaseMm()).toBe(18.5);
  });

  it("bodyBottom GAV_1 ignora frontBottom+elev errados — sempre 18,5", () => {
    expect(
      resolveDrawerBodyBottomFromModuleBaseMm({
        frontBottomFromModuleBaseMm: 0,
        sideBaseElevationMm: 0,
        stackRole: "lowest",
      })
    ).toBe(18.5);
    expect(
      resolveDrawerBodyBottomFromModuleBaseMm({
        frontBottomFromModuleBaseMm: 2,
        sideBaseElevationMm: 16.5,
        stackRole: "lowest",
      })
    ).toBe(18.5);
  });

  it("layers + Viewer + guia — Progressivas H=800 GAV_1", () => {
    expect(getDrawerViewerLayoutRev()).toBe("drawer-body-ssot-floor-top-v5");
    const H = 800;
    const T = 19;
    const panelH = H - 2 * T;
    const group = generateDrawerGroup({
      boxWidth: 600,
      boxHeight: H,
      boxDepth: 560,
      boxThickness: T,
      boxId: "ssot-abs",
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
    const floorTop = -H / 2 + T; // face superior do fundo
    const frontH = L0.height!;
    const bodyH = L0.bodyHeight!;
    const frontBottom = L0.posY! - frontH / 2 - floorTop;
    const bodyBottomLayer =
      L0.posY! + (L0.bodyCenterOffsetY ?? 0) - bodyH / 2 - floorTop;
    const elevDerived = bodyBottomLayer - frontBottom;

    expect(frontBottom).toBeCloseTo(DRAWER_LOWEST_FRONT_BOTTOM_FROM_MODULE_BASE_MM, 5);
    expect(bodyBottomLayer).toBeCloseTo(18.5, 5);
    expect(elevDerived).toBeCloseTo(16.5, 5);
    expect(L0.metadata?.sideBaseElevationMm).toBe(16.5);

    const fromTop = resolveEuropeanModuleRunnerLinesYMm({
      panelHeightMm: panelH,
      boxInternalHeightMm: H,
      boxExternalHeightMm: H,
      floorThicknessMm: T,
      heightMode: "top_small_mid_medium_bottom_large",
      drawers: layers.map((d) => ({
        posYMm: d.posY!,
        frontHeightMm: d.height!,
        sideBaseElevationMm: d.metadata?.sideBaseElevationMm as number,
      })),
    });
    const yGuia0 = panelH - fromTop[0]!;
    expect(yGuia0).toBeCloseTo(41, 5);
    expect(yGuia0).toBeCloseTo(bodyBottomLayer + 22.5, 5);

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
    const fw = new THREE.Vector3();
    const lw = new THREE.Vector3();
    front.getWorldPosition(fw);
    left.getWorldPosition(lw);
    const fl = drawerBody.worldToLocal(fw.clone());
    const ll = drawerBody.worldToLocal(lw.clone());
    const fH = (front.geometry as THREE.BoxGeometry).parameters.height * 1000;
    const lH = (left.geometry as THREE.BoxGeometry).parameters.height * 1000;
    const frontMin = fl.y * 1000 - fH / 2;
    const leftMin = ll.y * 1000 - lH / 2;
    const elevViewer = leftMin - frontMin;
    const bodyBottomViewer =
      drawerLayer.position.y * 1000 + leftMin - floorTop;

    expect(elevViewer).toBeCloseTo(16.5, 1);
    expect(bodyBottomViewer).toBeCloseTo(18.5, 1);
    expect(bodyBottomViewer).toBeGreaterThan(10);
    expect(Math.abs(bodyBottomViewer)).not.toBeLessThan(1);
  });
});
