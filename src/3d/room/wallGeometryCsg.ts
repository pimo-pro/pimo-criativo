/**
 * pimo-room v4 — geometria de paredes com cutouts CSG (WebGL / MeshStandardMaterial).
 *
 * Atribuição (MIT): ideia de cutouts de porta/janela em paredes adaptada de
 * Pascal Group Inc. / Aedifex Inc. (`generateExtrudedWall` / `collectCutoutBrushes`).
 * Implementação com `three-csg-ts` já presente no pimo (não three-bvh-csg / WebGPU).
 */

import * as THREE from "three";
import { CSG } from "three-csg-ts";
import type { DoorWindowConfig } from "./types";

const CSG_EPSILON_M = 0.002;

export type WallMiterOptions = {
  /** Ângulo de bisel no início da parede (radianos no plano XZ). 0 = topo a 90°. */
  startMiterRad?: number;
  /** Ângulo de bisel no fim da parede. */
  endMiterRad?: number;
};

export type WallOpeningCutout = Pick<
  DoorWindowConfig,
  "widthMm" | "heightMm" | "horizontalOffsetMm" | "floorOffsetMm"
>;

/** Caixa sólida da parede em espaço local (X = comprimento, Y = altura, Z = espessura). */
export function buildWallBoxGeometry(
  lengthM: number,
  heightM: number,
  thicknessM: number,
  miters?: WallMiterOptions
): THREE.BufferGeometry {
  const L = Math.max(0.05, lengthM);
  const H = Math.max(0.05, heightM);
  const T = Math.max(0.02, thicknessM);
  const startMiter = miters?.startMiterRad ?? 0;
  const endMiter = miters?.endMiterRad ?? 0;

  if (Math.abs(startMiter) < 1e-6 && Math.abs(endMiter) < 1e-6) {
    return new THREE.BoxGeometry(L, H, T);
  }

  // Trapézio em planta (miters nas extremidades) → ExtrudeGeometry → rodado para Y=altura.
  const halfT = T / 2;
  const startInset = Math.tan(startMiter) * halfT;
  const endInset = Math.tan(endMiter) * halfT;
  const x0 = -L / 2;
  const x1 = L / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x0 + startInset, -halfT);
  shape.lineTo(x1 - endInset, -halfT);
  shape.lineTo(x1 + endInset, halfT);
  shape.lineTo(x0 - startInset, halfT);
  shape.closePath();

  const geom = new THREE.ExtrudeGeometry(shape, { depth: H, bevelEnabled: false });
  geom.rotateX(-Math.PI / 2);
  geom.translate(0, -H / 2, 0);
  geom.computeVertexNormals();
  return geom;
}

function openingCenterLocal(
  opening: WallOpeningCutout,
  wallLengthM: number,
  wallHeightM: number
): { x: number; y: number } {
  const widthM = Math.max(0.01, opening.widthMm / 1000);
  const heightM = Math.max(0.01, opening.heightMm / 1000);
  const x = -wallLengthM / 2 + opening.horizontalOffsetMm / 1000 + widthM / 2;
  const y = -wallHeightM / 2 + opening.floorOffsetMm / 1000 + heightM / 2;
  return { x, y };
}

/** Cutter local que atravessa a espessura da parede (garante corte limpo). */
export function createOpeningCutterMesh(
  opening: WallOpeningCutout,
  wallLengthM: number,
  wallHeightM: number,
  wallThicknessM: number
): THREE.Mesh {
  const widthM = Math.max(0.01, opening.widthMm / 1000);
  const heightM = Math.max(0.01, opening.heightMm / 1000);
  const depthM = wallThicknessM + CSG_EPSILON_M * 2;
  const { x, y } = openingCenterLocal(opening, wallLengthM, wallHeightM);
  const geom = new THREE.BoxGeometry(widthM, heightM, depthM);
  const mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial());
  mesh.position.set(x, y, 0);
  mesh.updateMatrix();
  return mesh;
}

/**
 * Substitui `wall.geometry` por uma caixa sólida (sem cutouts), preservando material.
 * Guarda dimensões em userData para reaplicação de aberturas.
 */
export function resetWallSolidGeometry(
  wall: THREE.Mesh,
  lengthM: number,
  heightM: number,
  thicknessM: number,
  miters?: WallMiterOptions
): void {
  const next = buildWallBoxGeometry(lengthM, heightM, thicknessM, miters);
  wall.geometry.dispose();
  wall.geometry = next;
  wall.userData.wallLengthMm = lengthM * 1000;
  wall.userData.wallHeightMm = heightM * 1000;
  wall.userData.wallThicknessM = thicknessM;
  wall.userData.wallMiters = miters ?? null;
  wall.userData.wallSolidSignature = `${lengthM}|${heightM}|${thicknessM}|${miters?.startMiterRad ?? 0}|${miters?.endMiterRad ?? 0}`;
}

/**
 * Aplica cutouts CSG (porta/janela) à geometria local da parede.
 * Resultado: BufferGeometry normal, compatível com MeshStandardMaterial.
 */
export function applyOpeningCutoutsToWallMesh(
  wall: THREE.Mesh,
  openings: WallOpeningCutout[]
): boolean {
  const lengthMm = Number(wall.userData.wallLengthMm) || 3000;
  const heightMm = Number(wall.userData.wallHeightMm) || 2800;
  const thicknessM = Number(wall.userData.wallThicknessM) || 0.2;
  const lengthM = lengthMm / 1000;
  const heightM = heightMm / 1000;
  const miters = (wall.userData.wallMiters as WallMiterOptions | null | undefined) ?? undefined;

  resetWallSolidGeometry(wall, lengthM, heightM, thicknessM, miters ?? undefined);
  if (!openings.length) return true;

  let working: THREE.Mesh = new THREE.Mesh(
    wall.geometry.clone(),
    new THREE.MeshStandardMaterial()
  );
  working.position.set(0, 0, 0);
  working.rotation.set(0, 0, 0);
  working.scale.set(1, 1, 1);
  working.updateMatrix();

  for (const opening of openings) {
    const cutter = createOpeningCutterMesh(opening, lengthM, heightM, thicknessM);
    const carved = CSG.subtract(working, cutter);
    cutter.geometry.dispose();
    (cutter.material as THREE.Material).dispose();
    if (!carved?.geometry) {
      working.geometry.dispose();
      return false;
    }
    if (working.geometry !== wall.geometry) working.geometry.dispose();
    working = carved as THREE.Mesh;
    working.updateMatrix();
  }

  wall.geometry.dispose();
  wall.geometry = working.geometry;
  wall.geometry.computeVertexNormals();
  return true;
}

/** Recolhe configs de aberturas filhas da mesh de parede (grupos com elementId). */
export function collectWallOpeningConfigs(wall: THREE.Mesh): WallOpeningCutout[] {
  const out: WallOpeningCutout[] = [];
  for (const child of wall.children) {
    if (!(child instanceof THREE.Group)) continue;
    if (typeof child.userData?.elementId !== "string") continue;
    const cfg = child.userData.config as DoorWindowConfig | undefined;
    if (!cfg) continue;
    out.push({
      widthMm: cfg.widthMm,
      heightMm: cfg.heightMm,
      horizontalOffsetMm: cfg.horizontalOffsetMm,
      floorOffsetMm: cfg.floorOffsetMm,
    });
  }
  return out;
}

/** Reaplica CSG com base nas aberturas actualmente filhas da parede. */
export function refreshWallOpeningCutouts(wall: THREE.Mesh): boolean {
  return applyOpeningCutoutsToWallMesh(wall, collectWallOpeningConfigs(wall));
}
