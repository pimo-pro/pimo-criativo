/**
 * Diagnóstico Z da frente da gaveta no Viewer — valores reais do mesh.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildDrawerSpecs, createDrawerObject } from "../3d/objects/DrawerFactory";
import { getProfundidadeInternaUtilMm } from "../core/box/boxDepthHelpers";
import { resolveDrawerFrontFlushLayoutMm } from "../core/drawers/drawerViewerLayout";
import { generateDrawerGroup, drawerGroupToLayerItems } from "../core/drawers";
import { settingsDefaults } from "../core/settings/settingsSchema";
import { DRAWER_FRONT_FACE_OVERHANG_MM } from "../core/drawers/drawerSlideDepth";

describe("diagnóstico Z frente gaveta (Viewer)", () => {
  it("imprime e valida Z reais: flush + mesh vs carcaça", () => {
    const P_ext = 560;
    const frontT = 19;
    const folga = settingsDefaults.gavetas.gavetaRecuoProfundidadeCorredicaMm;
    const P_util = getProfundidadeInternaUtilMm(
      {
        dimensoes: { profundidade: P_ext },
        espessura: frontT,
        portaTipo: "sem_porta",
        drawersLayer: [{ frontThickness: frontT }],
        gavetas: 1,
        costaAtiva: true,
      },
      10
    );

    const flush = resolveDrawerFrontFlushLayoutMm(P_ext, P_util, frontT, folga);
    const carcassFrontZ = P_util / 2;

    const group = generateDrawerGroup({
      boxWidth: 600,
      boxHeight: 720,
      boxDepth: P_ext,
      boxThickness: frontT,
      boxId: "diag-z",
      drawerCount: 1,
      drawerType: "normal",
      heightMode: "equal",
      availableDepths: settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm,
      drawerSettings: settingsDefaults.gavetas,
    });
    const layers = drawerGroupToLayerItems(group);
    const layer = layers[0]!;
    const [spec] = buildDrawerSpecs(layers, {
      profundidadeUtilM: P_util / 1000,
      profundidadeExternaM: P_ext / 1000,
    });

    const mat = new THREE.MeshBasicMaterial();
    const drawerRoot = createDrawerObject(spec, { front: mat, body: mat });
    const drawerBody = drawerRoot.children.find((c) => c.name.startsWith("drawer-body-"))!;
    let frontMesh: THREE.Mesh | null = null;
    let bodyMesh: THREE.Mesh | null = null;
    drawerRoot.traverse((n) => {
      if (!(n instanceof THREE.Mesh)) return;
      const part = (n.userData as { drawerPart?: string }).drawerPart;
      if (part === "front" && !frontMesh) frontMesh = n;
      if ((part === "bottom" || part === "left" || part === "right") && !bodyMesh) {
        bodyMesh = n;
      }
    });

    const groupPosZ = drawerRoot.position.z;
    const frontLocalZ = frontMesh?.position.z ?? NaN;
    const bodyLocalZ = bodyMesh?.position.z ?? NaN;
    const frontWorldZ = groupPosZ + drawerBody.position.z + frontLocalZ;
    const frontOuterWorldMm = (frontWorldZ + frontT / 2000) * 1000;
    const frontInnerWorldMm = (frontWorldZ - frontT / 2000) * 1000;

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          P_ext,
          P_util,
          carcassFrontZ,
          flush: {
            frontOuterZ: flush.frontOuterZ,
            frontPosZ: flush.frontPosZ,
            bodyCenterLocalZ: flush.bodyCenterLocalZ,
          },
          layer: { posZ: layer.posZ, frontPosZ: layer.frontPosZ },
          mesh: {
            groupPosZ_mm: groupPosZ * 1000,
            drawerBodyZ_m: drawerBody.position.z,
            frontLocalZ_m: frontLocalZ,
            bodyLocalZ_m: bodyLocalZ,
            frontOuterWorldMm,
            frontInnerWorldMm,
            outerMinusCarcass: frontOuterWorldMm - carcassFrontZ,
            innerMinusCarcass: frontInnerWorldMm - carcassFrontZ,
          },
          expected: {
            overhang: DRAWER_FRONT_FACE_OVERHANG_MM,
            outerShouldBe: carcassFrontZ + frontT + DRAWER_FRONT_FACE_OVERHANG_MM,
            innerShouldBe: carcassFrontZ + DRAWER_FRONT_FACE_OVERHANG_MM,
          },
        },
        null,
        2
      )
    );

    expect(flush.frontOuterZ).toBeCloseTo(carcassFrontZ + frontT + 1, 3);
    expect(groupPosZ * 1000).toBeCloseTo(flush.frontPosZ, 3);
    expect(frontLocalZ).toBe(0);
    expect(frontOuterWorldMm).toBeCloseTo(flush.frontOuterZ, 2);
    expect(frontInnerWorldMm - carcassFrontZ).toBeCloseTo(1, 1);
    expect(frontOuterWorldMm - carcassFrontZ).toBeCloseTo(frontT + 1, 1);
  });
});
