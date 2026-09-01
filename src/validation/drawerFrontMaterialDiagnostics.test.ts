/**
 * Diagnóstico matéria da frente da gaveta — singleMaterial (paridade portas).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import * as THREE from "three";
import { resolveDrawerFrontMaterialId } from "../core/drawers/drawerFrontMaterial";

const edgeMat = new THREE.MeshStandardMaterial({ name: "EDGE_ORLA", color: 0xb8a898 });
const bodyShared = new THREE.MeshStandardMaterial({ name: "BODY_SHARED", color: 0xcccccc });
const sharedFace = new THREE.MeshStandardMaterial({ name: "FRONT_SHARED", color: 0x8b5a2b });

vi.mock("../3d/objects/BoxMaterialApplier", () => ({
  resolvePanelMaterialOptions: () => ({}),
  getEdgeMaterial: () => edgeMat,
  getMaterialForOfficialId: () => sharedFace,
}));

describe("diagnóstico matéria frente gaveta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("imprime valores e confirma matéria úúnica em toda a peça (sem cap)", async () => {
    const { applyDrawerFrontMaterialToMesh } = await import("../3d/objects/DrawerFactory");

    const drawerItem = {
      id: "drawer-1",
      material: "carvalho",
      materialId: "carvalho",
      metadata: { frontMaterial: "carvalho" },
    };

    const geometry = new THREE.BoxGeometry(0.4, 0.2, 0.019);
    geometry.clearGroups();
    for (let i = 0; i < 6; i++) {
      geometry.addGroup(i * 6, 6, i === 4 || i === 5 ? 1 : 0);
    }
    const oldFace = bodyShared.clone();
    oldFace.name = "OLD_BODY_FACE";
    const mesh = new THREE.Mesh(geometry, [edgeMat, oldFace]);
    mesh.userData.drawerLayerId = drawerItem.id;
    mesh.userData.drawerPart = "front";

    applyDrawerFrontMaterialToMesh(mesh, "carvalho");
    mesh.userData.drawerFrontMaterialId = "carvalho";

    const geo = mesh.geometry as THREE.BufferGeometry;
    const report = {
      drawerItem: {
        materialId: drawerItem.materialId,
        frontMaterial: drawerItem.metadata.frontMaterial,
        resolvedExplicit: resolveDrawerFrontMaterialId(drawerItem, ""),
      },
      userData: {
        drawerFrontMaterialId: mesh.userData.drawerFrontMaterialId as string,
      },
      mesh: {
        isSingleMaterial: !Array.isArray(mesh.material),
        materialName: (mesh.material as THREE.Material).name,
        groupCount: geo.groups.length,
        hasExteriorCap: mesh.children.some((c) => c.userData?.isDrawerFrontExteriorCap === true),
      },
    };

     
    console.log(JSON.stringify(report, null, 2));

    expect(report.drawerItem.resolvedExplicit).toBe("carvalho");
    expect(Array.isArray(mesh.material)).toBe(false);
    expect((mesh.material as THREE.Material).name).toBe("FRONT_SHARED");
    expect(geo.groups.length).toBe(0);
    expect(report.mesh.hasExteriorCap).toBe(false);
  });
});
