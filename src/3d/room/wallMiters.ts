/**
 * pimo-room v4 — miters dinâmicos por junção real de paredes.
 *
 * Atribuição (MIT): ideia de junções/miters por endpoints adaptada de
 * Pascal Group Inc. / Aedifex Inc. (`calculateLevelMiters`). Implementação
 * simplificada para ângulos de bisel (`startMiterRad`/`endMiterRad`) usados
 * por `buildWallBoxGeometry` (WebGL / ExtrudeGeometry).
 */

import * as THREE from "three";
import { buildWallBoxGeometry, type WallMiterOptions } from "./wallGeometryCsg";

export type WallAxis2D = {
  id: string;
  start: { x: number; z: number };
  end: { x: number; z: number };
  thickness?: number;
};

type EndKind = "start" | "end";

const MITER_LIMIT_TAN = 10; // ≈ Aedifex MITER_LIMIT — evita picos em ângulos rasos
const DEFAULT_TOLERANCE_M = 0.08;

function hypot2(dx: number, dz: number): number {
  return Math.hypot(dx, dz);
}

function normalize(dx: number, dz: number): { x: number; z: number } {
  const L = hypot2(dx, dz);
  if (L < 1e-9) return { x: 1, z: 0 };
  return { x: dx / L, z: dz / L };
}

function pointKey(p: { x: number; z: number }, snap: number): string {
  return `${Math.round(p.x * snap)},${Math.round(p.z * snap)}`;
}

function dirAwayFromEnd(wall: WallAxis2D, end: EndKind): { x: number; z: number } {
  return end === "start"
    ? normalize(wall.end.x - wall.start.x, wall.end.z - wall.start.z)
    : normalize(wall.start.x - wall.end.x, wall.start.z - wall.end.z);
}

function endPoint(wall: WallAxis2D, end: EndKind): { x: number; z: number } {
  return end === "start" ? wall.start : wall.end;
}

/**
 * Ângulo de bisel (0 = topo a 90°, π/4 = canto rectangular) a partir de duas
 * direcções a afastar-se do mesmo canto.
 */
export function miterRadFromDirections(
  dirA: { x: number; z: number },
  dirB: { x: number; z: number }
): number {
  const a = normalize(dirA.x, dirA.z);
  const b = normalize(dirB.x, dirB.z);
  const dot = Math.max(-1, Math.min(1, a.x * b.x + a.z * b.z));
  const angle = Math.acos(dot); // 0..π entre direcções
  // Colineares / opostas → junta quadrada
  if (angle < 1e-3 || Math.PI - angle < 1e-3) return 0;
  const half = angle / 2;
  const maxRad = Math.atan(MITER_LIMIT_TAN);
  return Math.min(half, maxRad);
}

/**
 * Calcula miters por parede a partir dos eixos 2D (metros, plano XZ).
 * Extremidades sem vizinho ficam a 0 (junta quadrada).
 */
export function computeWallMiters(
  walls: WallAxis2D[],
  options?: { toleranceM?: number }
): Map<string, WallMiterOptions> {
  const result = new Map<string, WallMiterOptions>();
  for (const w of walls) {
    result.set(w.id, { startMiterRad: 0, endMiterRad: 0 });
  }
  if (walls.length < 2) return result;

  const maxT = Math.max(...walls.map((w) => w.thickness ?? 0.2), 0.2);
  const tolerance = Math.max(options?.toleranceM ?? DEFAULT_TOLERANCE_M, maxT * 1.25);
  const snap = 1 / Math.max(0.01, tolerance);

  type JunctionMember = { wall: WallAxis2D; end: EndKind };
  const junctions = new Map<string, { point: { x: number; z: number }; members: JunctionMember[] }>();

  for (const wall of walls) {
    for (const end of ["start", "end"] as EndKind[]) {
      const p = endPoint(wall, end);
      // Agrupa por proximidade: procura chave existente dentro de tolerance
      let key = pointKey(p, snap);
      let found: string | null = null;
      for (const [k, j] of junctions) {
        if (hypot2(j.point.x - p.x, j.point.z - p.z) <= tolerance) {
          found = k;
          break;
        }
      }
      if (found) {
        junctions.get(found)!.members.push({ wall, end });
      } else {
        junctions.set(key, { point: p, members: [{ wall, end }] });
      }
    }
  }

  for (const junction of junctions.values()) {
    if (junction.members.length < 2) continue;
    // Para cada par de paredes no canto, aplica o mesmo half-angle a ambas as extremidades.
    // Com 2 paredes: um único ângulo. Com 3+: usa o vizinho angular mais próximo.
    for (let i = 0; i < junction.members.length; i++) {
      const self = junction.members[i];
      const selfDir = dirAwayFromEnd(self.wall, self.end);
      let best = 0;
      for (let j = 0; j < junction.members.length; j++) {
        if (i === j) continue;
        if (junction.members[j].wall.id === self.wall.id) continue;
        const otherDir = dirAwayFromEnd(junction.members[j].wall, junction.members[j].end);
        const m = miterRadFromDirections(selfDir, otherDir);
        if (m > best) best = m;
      }
      const cur = result.get(self.wall.id) ?? { startMiterRad: 0, endMiterRad: 0 };
      if (self.end === "start") cur.startMiterRad = best;
      else cur.endMiterRad = best;
      result.set(self.wall.id, cur);
    }
  }

  return result;
}

/** Extrai eixo 2D a partir de um mesh de parede do RoomManager. */
export function wallMeshToAxis(mesh: THREE.Mesh): WallAxis2D {
  const lenM = Math.max(0.05, (Number(mesh.userData.wallLengthMm) || 3000) / 1000);
  const half = lenM / 2;
  const rot = mesh.rotation.y;
  const cx = mesh.position.x;
  const cz = mesh.position.z;
  const dx = Math.cos(rot) * half;
  const dz = Math.sin(rot) * half;
  const id =
    mesh.userData.wallId != null ? String(mesh.userData.wallId) : mesh.uuid;
  return {
    id,
    start: { x: cx - dx, z: cz - dz },
    end: { x: cx + dx, z: cz + dz },
    thickness: Number(mesh.userData.wallThicknessM) || 0.2,
  };
}

/**
 * Reconstrói geometria sólida de cada parede com miters calculados nas junções.
 * Não reaplica cutouts CSG — o caller (RoomBuilder / sync) deve reaplicar aberturas.
 */
export function applyDynamicMitersToWallMeshes(meshes: THREE.Mesh[]): Map<string, WallMiterOptions> {
  const axes = meshes.map(wallMeshToAxis);
  const mitersById = computeWallMiters(axes);
  for (const mesh of meshes) {
    const axis = wallMeshToAxis(mesh);
    const miters = mitersById.get(axis.id) ?? { startMiterRad: 0, endMiterRad: 0 };
    const lengthM = Math.max(0.05, (Number(mesh.userData.wallLengthMm) || 3000) / 1000);
    const heightM = Math.max(0.05, (Number(mesh.userData.wallHeightMm) || 2600) / 1000);
    const thicknessM = Number(mesh.userData.wallThicknessM) || 0.2;
    const old = mesh.geometry;
    mesh.geometry = buildWallBoxGeometry(lengthM, heightM, thicknessM, miters);
    old.dispose();
    mesh.userData.wallMiters = miters;
  }
  return mitersById;
}
