/**
 * Metadados da sala para PDF / cutlist / nesting.
 * Somente leitura — NÃO altera o pipeline industrial.
 */
import type { RoomState } from "./RoomState";
import { computeFootprintFromWalls } from "./RoomGeometry";
import { toCatalogItemState } from "./catalog/CatalogItemManager";
import { ROOM_ENGINE_VERSION } from "./version";

export type RoomLevelMetadata = {
  id: string;
  name: string;
  ordinal: number;
  storeyHeightMm: number;
  wallCount: number;
  slabCount: number;
  itemCount: number;
};

export type RoomSlabMetadata = {
  id: string;
  levelId: string;
  thicknessMm: number;
  elevationMm: number;
};

export type RoomItemMetadata = {
  id: string;
  catalogId: string;
  name: string;
  type: string;
  levelId: string;
  positionMm: { x: number; y: number; z: number };
  rotationDeg: number;
};

export type RoomReportMetadata = {
  roomEngineVersion: typeof ROOM_ENGINE_VERSION;
  roomId: string;
  activeLevelId: string;
  aiPreset?: string;
  footprint: {
    widthMm: number;
    depthMm: number;
    heightMm: number;
    wallThicknessMm: number;
  };
  levels: RoomLevelMetadata[];
  slabs: RoomSlabMetadata[];
  /** Itens arquitectónicos — metadados apenas (não entram na cutlist). */
  items: RoomItemMetadata[];
  openingsCount: number;
  wallsCount: number;
};

/** Extrai metadados seguros para anexar a relatórios PDF / nesting. */
export function buildRoomReportMetadata(state: RoomState): RoomReportMetadata {
  const activeWalls = state.walls.filter((w) => w.levelId === state.activeLevelId);
  const fpWalls = computeFootprintFromWalls(activeWalls);
  const fp = state.footprint ?? {
    widthMm: fpWalls.widthMm || 4000,
    depthMm: fpWalls.depthMm || 4000,
    heightMm: state.levels.find((l) => l.id === state.activeLevelId)?.storeyHeightMm ?? 2600,
    wallThicknessMm: activeWalls[0]?.thicknessMm ?? 200,
  };

  return {
    roomEngineVersion: ROOM_ENGINE_VERSION,
    roomId: state.id,
    activeLevelId: state.activeLevelId,
    aiPreset: state.aiPreset,
    footprint: {
      widthMm: fp.widthMm,
      depthMm: fp.depthMm,
      heightMm: fp.heightMm,
      wallThicknessMm: fp.wallThicknessMm,
    },
    levels: state.levels.map((l) => ({
      id: l.id,
      name: l.name,
      ordinal: l.ordinal,
      storeyHeightMm: l.storeyHeightMm,
      wallCount: state.walls.filter((w) => w.levelId === l.id).length,
      slabCount: state.slabs.filter((s) => s.levelId === l.id).length,
      itemCount: state.items.filter((i) => i.levelId === l.id).length,
    })),
    slabs: state.slabs.map((s) => ({
      id: s.id,
      levelId: s.levelId,
      thicknessMm: s.thicknessMm,
      elevationMm: s.elevationMm,
    })),
    items: state.items.map((raw) => {
      const c = toCatalogItemState(raw);
      return {
        id: c.id,
        catalogId: c.catalogId,
        name: c.name,
        type: c.type,
        levelId: c.levelId,
        positionMm: { ...c.positionMm },
        rotationDeg: c.rotationDeg,
      };
    }),
    openingsCount: state.openings.length,
    wallsCount: state.walls.length,
  };
}

/**
 * Envelope opcional para documentos de projecto / PDF.
 * O consumidor industrial decide se anexa — nunca gera peças CNC.
 */
export function attachRoomMetadataToDocument<T extends Record<string, unknown>>(
  document: T,
  state: RoomState | null | undefined
): T & { pimoRoom?: RoomReportMetadata } {
  if (!state) return document;
  return {
    ...document,
    pimoRoom: buildRoomReportMetadata(state),
  };
}
