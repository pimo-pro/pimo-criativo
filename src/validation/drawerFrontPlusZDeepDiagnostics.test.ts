/**
 * Diagnóstico profundo: faces, normals, groups, raycast +Z/?Z da gav_frente.
 * Paridade portas: singleMaterial, sem cap.
 */
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { generateDrawerGroup, drawerGroupToLayerItems } from "../core/drawers";
import { PanelFactory } from "../3d/objects/PanelFactory";
import { settingsDefaults } from "../core/settings/settingsSchema";

vi.mock("../3d/objects/BoxMaterialApplier", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../3d/objects/BoxMaterialApplier")>();
  return {
    ...actual,
    getMaterialForOfficialId: () =>
      new THREE.MeshStandardMaterial({ name: "MOCK_FRONT", color: 0x8b5a2b }),
  };
});

import {
  applyDrawerFrontMaterialToMesh,
  buildDrawerSpecs,
  createDrawerObject,
  DRAWER_FRONT_EXTERIOR_FACE_INDEX,
  DRAWER_FRONT_INTERIOR_FACE_INDEX,
  resolveDrawerFrontFaceMaterialIndex,
} from "../3d/objects/DrawerFactory";

const FACE_LABELS = ["+X", "-X", "+Y", "-Y", "+Z", "-Z"] as const;

function reportFaces(mesh: THREE.Mesh, label: string) {
  const geo = mesh.geometry as THREE.BufferGeometry;
  const normals = geo.getAttribute("normal");
  const faces = [];
  for (let fi = 0; fi < 6; fi++) {
    const v0 = fi * 4;
    const g = geo.groups[fi];
    faces.push({
      faceIndex: fi,
      label: FACE_LABELS[fi],
      normal: {
        x: +normals.getX(v0).toFixed(3),
        y: +normals.getY(v0).toFixed(3),
        z: +normals.getZ(v0).toFixed(3),
      },
      materialIndex: g?.materialIndex ?? null,
      inGroups: g != null,
    });
  }
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const plusZ = faces.find((f) => f.label === "+Z")!;
  const minusZ = faces.find((f) => f.label === "-Z")!;
  const out = {
    label,
    isArrayMat: Array.isArray(mesh.material),
    matNames: mats.map((m) => (m as THREE.Material)?.name),
    resolveDrawerFrontFaceMaterialIndex: resolveDrawerFrontFaceMaterialIndex(mesh),
    plusZ_isExteriorConst: plusZ.faceIndex === DRAWER_FRONT_EXTERIOR_FACE_INDEX,
    minusZ_isInteriorConst: minusZ.faceIndex === DRAWER_FRONT_INTERIOR_FACE_INDEX,
    faceWithNormalPlusZ: faces.find((f) => f.normal.z > 0.5)?.faceIndex ?? null,
    faceWithNormalMinusZ: faces.find((f) => f.normal.z < -0.5)?.faceIndex ?? null,
    faces,
  };
   
  console.log(JSON.stringify(out, null, 2));
  return out;
}

function raycastFaceMaterial(mesh: THREE.Mesh, fromZ: number) {
  const raycaster = new THREE.Raycaster();
  const origin = new THREE.Vector3(0, 0, fromZ);
  const dir = new THREE.Vector3(0, 0, fromZ > 0 ? -1 : 1).normalize();
  raycaster.set(origin, dir);
  const hits = raycaster.intersectObject(mesh, false);
  if (!hits.length) return { hit: false as const };
  const hit = hits[0];
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const mat = mats[0];
  return {
    hit: true as const,
    distance: hit.distance,
    pointZ: +hit.point.z.toFixed(4),
    matName: (mat as THREE.Material)?.name,
    matColor:
      mat && "color" in mat ? (mat as THREE.MeshStandardMaterial).color.getHexString() : null,
  };
}

describe("diagnóstico profundo gav_frente +Z/?Z", () => {
  it("createDrawerObject singleMaterial + apply — sem cap; +Z/?Z mesma matéria", () => {
    const factory = new PanelFactory({
      resolvePanelMaterialOptions: (options) => {
        if (options && typeof options === "object" && "edgeMaterial" in options) return options;
        if (options && typeof options === "object" && "singleMaterial" in options) return options;
        return {
          edgeMaterial: new THREE.MeshStandardMaterial({ color: 0xb8a898 }),
          faceMaterial: new THREE.MeshStandardMaterial({ color: 0xffffff }),
        };
      },
    });

    const edgeMat = new THREE.MeshStandardMaterial({ name: "EDGE", color: 0xb8a898 });
    const faceMat = new THREE.MeshStandardMaterial({ name: "FACE_WHITE", color: 0xffffff });
    const edgeFaceMesh = factory.createPanel(0.4, 0.2, 0.019, "edge-face", "front", {
      edgeMaterial: edgeMat,
      faceMaterial: faceMat,
    });
    const before = reportFaces(edgeFaceMesh, "1_PanelFactory_edge_face");

    const group = generateDrawerGroup({
      boxWidth: 600,
      boxHeight: 280,
      boxDepth: 560,
      boxThickness: 19,
      boxId: "diag-z",
      drawerCount: 1,
      drawerType: "normal",
      heightMode: "equal",
      availableDepths: settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm,
      drawerSettings: settingsDefaults.gavetas,
      espessuraCostaMm: 10,
      costaAtiva: true,
    });
    const [layer] = drawerGroupToLayerItems(group);
    layer.material = "carvalho";
    layer.materialId = "carvalho";
    layer.metadata = { ...(layer.metadata ?? {}), frontMaterial: "carvalho" };
    const [spec] = buildDrawerSpecs([layer]);
    const body = new THREE.MeshStandardMaterial({ name: "BODY_MODULE", color: 0xf2f0eb });
    const front = new THREE.MeshStandardMaterial({ name: "FRONT_SHARED", color: 0x8b5a2b });
    const drawer = createDrawerObject(spec, {
      front,
      body,
      frontMaterialId: "carvalho",
    });

    let frontMesh: THREE.Mesh | undefined;
    drawer.traverse((c) => {
      if (!(c instanceof THREE.Mesh)) return;
      const ud = c.userData as { drawerPart?: string };
      if (ud.drawerPart === "front" && c.name.includes("drawer-front-ext")) frontMesh = c;
    });
    if (!frontMesh) throw new Error("front mesh missing");

    const afterCreate = reportFaces(frontMesh, "2_createDrawerObject");
    expect(drawer.userData.drawerSpec).toBeTruthy();

    applyDrawerFrontMaterialToMesh(frontMesh, "nogueira");
    const afterApply = reportFaces(frontMesh, "3_after_apply");
    const rayAfter = {
      fromPlusZ: raycastFaceMaterial(frontMesh, 1),
      fromMinusZ: raycastFaceMaterial(frontMesh, -1),
    };
     
    console.log(JSON.stringify({ rayAfter }, null, 2));

    expect(before.faceWithNormalPlusZ).toBe(4);
    expect(before.faceWithNormalMinusZ).toBe(5);
    expect(afterCreate.faceWithNormalPlusZ).toBe(4);
    expect(afterApply.faceWithNormalPlusZ).toBe(4);
    expect(afterCreate.isArrayMat).toBe(false);
    expect((frontMesh.geometry as THREE.BufferGeometry).groups.length).toBe(0);
    expect(
      frontMesh.children.some((c) => c.userData?.isDrawerFrontExteriorCap === true)
    ).toBe(false);
    expect(rayAfter.fromPlusZ.hit).toBe(true);
    expect(rayAfter.fromMinusZ.hit).toBe(true);
    expect(rayAfter.fromPlusZ.matColor).toBe(rayAfter.fromMinusZ.matColor);
  });
});
