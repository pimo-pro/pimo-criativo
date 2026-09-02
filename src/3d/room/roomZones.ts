/**
 * pimo-room v4 — zonas polígono (opt-in) + área / perímetro.
 *
 * Atribuição (MIT): ideia de nós zone com polígono adaptada de
 * Pascal Group Inc. / Aedifex Inc. — apenas lógica de dados/área.
 */

import type {
  ProjectRoomConfig,
  ProjectRoomZone,
  ProjectRoomZonePoint,
} from "../viewer-engine/room/roomEngineTypes";

const MM2_TO_M2 = 1e-6;
const MM_TO_M = 1e-3;

/** Área do polígono (mm²) via fórmula do laço (shoelace). */
export function polygonAreaMm2(polygon: ProjectRoomZonePoint[]): number {
  if (!polygon || polygon.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    sum += a.x * b.z - b.x * a.z;
  }
  return Math.abs(sum) / 2;
}

export function polygonAreaM2(polygon: ProjectRoomZonePoint[]): number {
  return polygonAreaMm2(polygon) * MM2_TO_M2;
}

/** Perímetro do polígono em mm. */
export function polygonPerimeterMm(polygon: ProjectRoomZonePoint[]): number {
  if (!polygon || polygon.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    sum += Math.hypot(b.x - a.x, b.z - a.z);
  }
  return sum;
}

export function polygonPerimeterM(polygon: ProjectRoomZonePoint[]): number {
  return polygonPerimeterMm(polygon) * MM_TO_M;
}

/** Centroide simples (média dos vértices) — suficiente para rótulos. */
export function polygonCentroidMm(polygon: ProjectRoomZonePoint[]): ProjectRoomZonePoint {
  if (!polygon.length) return { x: 0, z: 0 };
  let x = 0;
  let z = 0;
  for (const p of polygon) {
    x += p.x;
    z += p.z;
  }
  return { x: x / polygon.length, z: z / polygon.length };
}

/** Rectângulo centrado a partir do footprint da sala. */
export function rectangularZonePolygonMm(widthMm: number, depthMm: number): ProjectRoomZonePoint[] {
  const hw = widthMm / 2;
  const hd = depthMm / 2;
  return [
    { x: -hw, z: -hd },
    { x: hw, z: -hd },
    { x: hw, z: hd },
    { x: -hw, z: hd },
  ];
}

export function createMainZoneFromRoom(room: Pick<ProjectRoomConfig, "widthMm" | "depthMm" | "heightMm">): ProjectRoomZone {
  return {
    id: "zone-room-main",
    name: "Sala",
    polygonMm: rectangularZonePolygonMm(room.widthMm, room.depthMm),
    ceilingHeightMm: room.heightMm,
    spaceRole: "room",
  };
}

/** Garante pelo menos a zona principal alinhada ao footprint (opt-in). */
export function ensureRoomZones(room: ProjectRoomConfig): ProjectRoomConfig {
  if (room.zones && room.zones.length > 0) {
    return {
      ...room,
      zones: room.zones.map((z) => normalizeZone(z, room)),
    };
  }
  return {
    ...room,
    zones: [createMainZoneFromRoom(room)],
  };
}

export function normalizeZone(
  raw: Partial<ProjectRoomZone> | null | undefined,
  room?: Pick<ProjectRoomConfig, "widthMm" | "depthMm" | "heightMm">
): ProjectRoomZone {
  const fallback = room
    ? createMainZoneFromRoom(room)
    : {
        id: "zone-room-main",
        name: "Sala",
        polygonMm: rectangularZonePolygonMm(4000, 4000),
        ceilingHeightMm: 2600,
        spaceRole: "room" as const,
      };
  const polygon =
    Array.isArray(raw?.polygonMm) && raw!.polygonMm!.length >= 3
      ? raw!.polygonMm!.map((p) => ({
          x: Number.isFinite(p.x) ? p.x : 0,
          z: Number.isFinite(p.z) ? p.z : 0,
        }))
      : fallback.polygonMm;
  return {
    id: typeof raw?.id === "string" && raw.id ? raw.id : fallback.id,
    name: typeof raw?.name === "string" && raw.name.trim() ? raw.name.trim() : fallback.name,
    polygonMm: polygon,
    ceilingHeightMm:
      raw?.ceilingHeightMm != null && Number.isFinite(raw.ceilingHeightMm)
        ? Math.max(500, raw.ceilingHeightMm)
        : fallback.ceilingHeightMm,
    spaceRole: raw?.spaceRole === "generic" ? "generic" : "room",
  };
}

/** Actualiza a zona principal rectangular quando o footprint muda (preserva zonas extra). */
export function syncMainZoneToFootprint(room: ProjectRoomConfig): ProjectRoomConfig {
  if (!room.zones?.length) return room;
  const mainPoly = rectangularZonePolygonMm(room.widthMm, room.depthMm);
  const zones = room.zones.map((z) => {
    if (z.id === "zone-room-main" || z.spaceRole === "room") {
      return {
        ...z,
        polygonMm: mainPoly,
        ceilingHeightMm: room.heightMm,
      };
    }
    return z;
  });
  return { ...room, zones };
}

export type ZoneMetrics = {
  id: string;
  name: string;
  areaM2: number;
  perimeterM: number;
  centroidMm: ProjectRoomZonePoint;
};

export function computeZoneMetrics(zone: ProjectRoomZone): ZoneMetrics {
  return {
    id: zone.id,
    name: zone.name,
    areaM2: polygonAreaM2(zone.polygonMm),
    perimeterM: polygonPerimeterM(zone.polygonMm),
    centroidMm: polygonCentroidMm(zone.polygonMm),
  };
}
