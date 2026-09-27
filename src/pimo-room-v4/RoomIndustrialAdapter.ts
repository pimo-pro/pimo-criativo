/**
 * Adapter oficial RoomState ↔ fluxo industrial.
 * Níveis / slabs / itens / AI NÃO alimentam cutlist nem CNC.
 * Apenas ProjectRoomConfig (paredes/aberturas do nível activo) entra no autoRoomFill.
 */
import type { ProjectRoomConfig } from "../3d/viewer-engine/room/roomEngineTypes";
import type { WorkspaceBox } from "../core/types";
import { RoomConverter } from "./RoomConverter";
import type { RoomState } from "./RoomState";
import { computeFootprintFromWalls } from "./RoomGeometry";
import { toCatalogItemState } from "./catalog/CatalogItemManager";
import { buildRoomReportMetadata, type RoomReportMetadata } from "./roomMetadata";
import { ROOM_ENGINE_VERSION } from "./version";

export type RoomIndustrialConstraints = {
  roomEngineVersion: typeof ROOM_ENGINE_VERSION;
  activeLevelId: string;
  footprintMm: {
    widthMm: number;
    depthMm: number;
    heightMm: number;
    wallThicknessMm: number;
  };
  /** Zonas a evitar no auto-fill (aberturas + itens arquitectónicos). */
  clearanceZonesMm: Array<{
    kind: "opening" | "catalog-item";
    id: string;
    x: number;
    z: number;
    radiusMm: number;
  }>;
  lockedWallIds: string[];
  /** true = adapter garante isolamento industrial. */
  cutlistSafe: true;
};

export type RoomFurnitureHint = {
  id: string;
  catalogId: string;
  name: string;
  levelId: string;
  positionMm: { x: number; y: number; z: number };
  rotationDeg: number;
  /** Marca explícita: nunca enviar à cutlist/CNC. */
  industrialSafe: true;
  source: "pimo-room-v4";
};

export type RoomIndustrialSyncResult = {
  projectRoom: ProjectRoomConfig;
  constraints: RoomIndustrialConstraints;
  furnitureHints: RoomFurnitureHint[];
  metadata: RoomReportMetadata;
  /** Sempre vazio — RoomEngine não cria WorkspaceBox de fabrico. */
  workspaceBoxes: WorkspaceBox[];
};

function clearanceZones(state: RoomState): RoomIndustrialConstraints["clearanceZonesMm"] {
  const zones: RoomIndustrialConstraints["clearanceZonesMm"] = [];
  const walls = state.walls.filter((w) => w.levelId === state.activeLevelId);
  const wallById = new Map(walls.map((w) => [w.id, w]));

  for (const o of state.openings) {
    const wall = wallById.get(o.wallId);
    if (!wall) continue;
    const len = Math.hypot(wall.endMm.x - wall.startMm.x, wall.endMm.z - wall.startMm.z) || 1;
    const t = Math.min(1, Math.max(0, (o.offsetAlongWallMm + o.widthMm / 2) / len));
    zones.push({
      kind: "opening",
      id: o.id,
      x: wall.startMm.x + (wall.endMm.x - wall.startMm.x) * t,
      z: wall.startMm.z + (wall.endMm.z - wall.startMm.z) * t,
      radiusMm: Math.max(400, o.widthMm / 2 + 200),
    });
  }

  for (const raw of state.items.filter((i) => i.levelId === state.activeLevelId)) {
    const c = toCatalogItemState(raw);
    zones.push({
      kind: "catalog-item",
      id: c.id,
      x: c.positionMm.x,
      z: c.positionMm.z,
      radiusMm: 500,
    });
  }
  return zones;
}

export const RoomIndustrialAdapter = {
  version: ROOM_ENGINE_VERSION,

  /** Nível activo → ProjectRoomConfig (input de autoRoomFill / viewer room). */
  toProjectRoomConfig(state: RoomState): ProjectRoomConfig {
    return RoomConverter.toProjectRoomConfig(state);
  },

  fromProjectRoomConfig(room: ProjectRoomConfig): RoomState {
    return RoomConverter.fromProjectRoomConfig(room);
  },

  /** Alias explícito para o pipeline Kitchen Layout 3.0. */
  toAutoRoomFillRoom(state: RoomState): ProjectRoomConfig {
    return RoomIndustrialAdapter.toProjectRoomConfig(state);
  },

  buildConstraints(state: RoomState): RoomIndustrialConstraints {
    const walls = state.walls.filter((w) => w.levelId === state.activeLevelId);
    const fp = computeFootprintFromWalls(walls);
    return {
      roomEngineVersion: ROOM_ENGINE_VERSION,
      activeLevelId: state.activeLevelId,
      footprintMm: {
        widthMm: state.footprint?.widthMm ?? fp.widthMm ?? 4000,
        depthMm: state.footprint?.depthMm ?? fp.depthMm ?? 4000,
        heightMm:
          state.footprint?.heightMm ??
          state.levels.find((l) => l.id === state.activeLevelId)?.storeyHeightMm ??
          2600,
        wallThicknessMm: state.footprint?.wallThicknessMm ?? walls[0]?.thicknessMm ?? 200,
      },
      clearanceZonesMm: clearanceZones(state),
      lockedWallIds: state.locked ? walls.map((w) => w.id) : [],
      cutlistSafe: true,
    };
  },

  /** Hints de mobiliário — metadados, nunca WorkspaceBox de fabrico. */
  toFurnitureHints(state: RoomState): RoomFurnitureHint[] {
    return state.items.map((raw) => {
      const c = toCatalogItemState(raw);
      return {
        id: c.id,
        catalogId: c.catalogId,
        name: c.name,
        levelId: c.levelId,
        positionMm: { ...c.positionMm },
        rotationDeg: c.rotationDeg,
        industrialSafe: true as const,
        source: "pimo-room-v4" as const,
      };
    });
  },

  /**
   * Sync completo para o projecto industrial.
   * `workspaceBoxes` fica sempre [] — cutlist/nesting/CNC não são afectados.
   */
  sync(state: RoomState): RoomIndustrialSyncResult {
    return {
      projectRoom: RoomIndustrialAdapter.toProjectRoomConfig(state),
      constraints: RoomIndustrialAdapter.buildConstraints(state),
      furnitureHints: RoomIndustrialAdapter.toFurnitureHints(state),
      metadata: buildRoomReportMetadata(state),
      workspaceBoxes: [],
    };
  },

  /** Garante que um patch de projecto não mistura itens AI na cutlist. */
  assertIndustrialIsolation(result: RoomIndustrialSyncResult): boolean {
    return result.workspaceBoxes.length === 0 && result.constraints.cutlistSafe === true;
  },
};
