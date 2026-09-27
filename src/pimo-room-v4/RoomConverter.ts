/**
 * Conversão RoomState ↔ ProjectRoomConfig (pimo-room v4).
 */
import {
  applyProjectRoomDimensions,
  createDefaultProjectRoom,
  normalizeProjectRoom,
} from "../3d/viewer-engine/room/RoomEngine";
import type {
  ProjectRoomConfig,
  ProjectRoomOpening,
  ProjectRoomWall,
  RoomWallLabel,
} from "../3d/viewer-engine/room/roomEngineTypes";
import { centeredWallPositionForLabel } from "../utils/roomCoordinates";
import { CeilingEngine } from "./CeilingEngine";
import { FloorEngine } from "./FloorEngine";
import { computeFootprintFromWalls } from "./RoomGeometry";
import {
  createEmptyRoomState,
  ROOM_ENGINE_DEFAULTS,
  type RoomOpening,
  type RoomState,
  type RoomWall,
  type Vec2Mm,
  wallLengthMm,
} from "./RoomState";

function endpointsForLabeledWall(
  label: RoomWallLabel,
  widthMm: number,
  depthMm: number,
  heightMm: number,
  thicknessMm: number
): { startMm: Vec2Mm; endMm: Vec2Mm } {
  const pos = centeredWallPositionForLabel(label, widthMm, depthMm, heightMm, thicknessMm);
  const halfW = widthMm / 2;
  const halfD = depthMm / 2;
  switch (label) {
    case "sul":
      return { startMm: { x: -halfW, z: pos.z }, endMm: { x: halfW, z: pos.z } };
    case "norte":
      return { startMm: { x: halfW, z: pos.z }, endMm: { x: -halfW, z: pos.z } };
    case "este":
      return { startMm: { x: pos.x, z: -halfD }, endMm: { x: pos.x, z: halfD } };
    case "oeste":
      return { startMm: { x: pos.x, z: halfD }, endMm: { x: pos.x, z: -halfD } };
    default:
      return { startMm: { x: pos.x, z: pos.z }, endMm: { x: pos.x + 1000, z: pos.z } };
  }
}

function nearestCardinalWall(
  point: Vec2Mm,
  widthMm: number,
  depthMm: number
): RoomWallLabel {
  const halfW = widthMm / 2;
  const halfD = depthMm / 2;
  const dSul = Math.abs(point.z - -halfD);
  const dNorte = Math.abs(point.z - halfD);
  const dOeste = Math.abs(point.x - -halfW);
  const dEste = Math.abs(point.x - halfW);
  const best = Math.min(dSul, dNorte, dOeste, dEste);
  if (best === dSul) return "sul";
  if (best === dNorte) return "norte";
  if (best === dEste) return "este";
  return "oeste";
}

function offsetAlongLabeledWall(
  label: RoomWallLabel,
  point: Vec2Mm,
  widthMm: number,
  depthMm: number
): number {
  const halfW = widthMm / 2;
  const halfD = depthMm / 2;
  switch (label) {
    case "sul":
      return point.x - -halfW;
    case "norte":
      return halfW - point.x;
    case "este":
      return point.z - -halfD;
    case "oeste":
      return halfD - point.z;
    default:
      return 0;
  }
}

export const RoomConverter = {
  fromProjectRoomConfig(room: ProjectRoomConfig): RoomState {
    const levelId = ROOM_ENGINE_DEFAULTS.levelId;
    const heightMm = room.heightMm;
    const thicknessMm = room.wallThicknessMm;
    const walls: RoomWall[] = room.walls.map((w) => {
      const label = w.label;
      const ends =
        label === "extra" || label === ("custom" as RoomWallLabel)
          ? wallEndpointsFromProjectWall(w)
          : endpointsForLabeledWall(label, room.widthMm, room.depthMm, heightMm, thicknessMm);
      return {
        id: w.id,
        levelId,
        startMm: ends.startMm,
        endMm: ends.endMm,
        heightMm: w.heightMm,
        thicknessMm: w.thicknessMm,
        label: w.label,
        materialSlots: {
          interior: { kind: "preset", presetId: "white" },
          exterior: { kind: "preset", presetId: "plaster" },
        },
      };
    });

    const openings: RoomOpening[] = room.openings.map((o) => ({
      id: o.id,
      type: o.type,
      wallId: o.wallId,
      kind: o.kind,
      offsetAlongWallMm: o.xPosMm ?? o.horizontalOffsetMm ?? 0,
      widthMm: o.widthMm,
      heightMm: o.heightMm,
      sillMm: o.floorOffsetMm ?? o.verticalOffsetMm ?? 0,
      thicknessMm: o.thicknessMm,
    }));

    let state = createEmptyRoomState({
      walls,
      openings,
      locked: room.locked === true,
      footprint: {
        widthMm: room.widthMm,
        depthMm: room.depthMm,
        heightMm: room.heightMm,
        wallThicknessMm: room.wallThicknessMm,
      },
      levels: [
        {
          id: levelId,
          ordinal: 0,
          name: "Piso 0",
          storeyHeightMm: heightMm,
        },
      ],
      activeLevelId: levelId,
    });

    if (room.zones?.length) {
      state.zones = room.zones.map((z) => ({
        id: z.id,
        levelId,
        name: z.name,
        polygonMm: z.polygonMm.map((p) => ({ x: p.x, z: p.z })),
        spaceRole: z.spaceRole === "room" ? "room" : "generic",
      }));
    }

    if (room.catalogItems?.length) {
      state.version = 3;
      state.items = room.catalogItems.map((i) => ({
        id: i.id,
        catalogId: i.catalogId,
        levelId: i.levelId || levelId,
        positionMm: { ...i.positionMm },
        rotationDeg: i.rotationDeg ?? 0,
        type: (i.type as import("./catalog/CatalogItem").CatalogItemType | undefined) ?? "custom",
        name: i.name,
        scale: i.scale ? { ...i.scale } : { x: 1, y: 1, z: 1 },
        src: i.src,
      }));
    }

    state = FloorEngine.ensureSlabFromWalls(state, levelId);
    state = CeilingEngine.ensureCeilingFromWalls(state, levelId);
    return state;
  },

  toProjectRoomConfig(state: RoomState): ProjectRoomConfig {
    const levelId = state.activeLevelId;
    const walls = state.walls.filter((w) => w.levelId === levelId);
    const fp = state.footprint ?? {
      ...computeFootprintFromWalls(walls),
      heightMm:
        state.levels.find((l) => l.id === levelId)?.storeyHeightMm ??
        walls[0]?.heightMm ??
        ROOM_ENGINE_DEFAULTS.heightMm,
      wallThicknessMm: walls[0]?.thicknessMm ?? ROOM_ENGINE_DEFAULTS.wallThicknessMm,
    };

    const widthMm = Math.max(500, fp.widthMm || ROOM_ENGINE_DEFAULTS.widthMm);
    const depthMm = Math.max(500, fp.depthMm || ROOM_ENGINE_DEFAULTS.depthMm);
    const heightMm = Math.max(500, fp.heightMm || ROOM_ENGINE_DEFAULTS.heightMm);
    const wallThicknessMm = Math.max(50, fp.wallThicknessMm || ROOM_ENGINE_DEFAULTS.wallThicknessMm);

    const base = createDefaultProjectRoom();
    let project =
      normalizeProjectRoom({
        ...base,
        widthMm,
        depthMm,
        heightMm,
        wallThicknessMm,
        locked: state.locked,
      }) ?? base;
    project = applyProjectRoomDimensions(project);

    // Reatribuir ids estáveis quando as paredes de origem têm labels cardinais
    const labeled = walls.filter((w) => w.label && w.label !== "extra" && w.label !== "custom");
    if (labeled.length >= 4) {
      const byLabel = new Map(labeled.map((w) => [w.label!, w]));
      project = {
        ...project,
        walls: project.walls.map((pw) => {
          const src = byLabel.get(pw.label);
          if (!src) return pw;
          return {
            ...pw,
            id: src.id,
            heightMm: src.heightMm,
            thicknessMm: src.thicknessMm,
            widthMm: Math.round(wallLengthMm(src)),
            lengthMm: Math.round(wallLengthMm(src)),
          };
        }),
      };
    }

    const wallIdByLabel = new Map(project.walls.map((w) => [w.label, w.id]));
    const openings: ProjectRoomOpening[] = state.openings
      .filter((o) => walls.some((w) => w.id === o.wallId))
      .map((o) => {
        const srcWall = walls.find((w) => w.id === o.wallId);
        let wallId = o.wallId;
        let xPosMm = o.offsetAlongWallMm;
        if (srcWall?.label && wallIdByLabel.has(srcWall.label as RoomWallLabel)) {
          wallId = wallIdByLabel.get(srcWall.label as RoomWallLabel)!;
        } else if (srcWall) {
          const mid: Vec2Mm = {
            x: (srcWall.startMm.x + srcWall.endMm.x) / 2,
            z: (srcWall.startMm.z + srcWall.endMm.z) / 2,
          };
          const label = nearestCardinalWall(mid, widthMm, depthMm);
          wallId = wallIdByLabel.get(label) ?? project.walls[0]!.id;
          xPosMm = offsetAlongLabeledWall(label, mid, widthMm, depthMm) - o.widthMm / 2;
        }
        const host = project.walls.find((w) => w.id === wallId);
        const maxX = Math.max(0, (host?.widthMm ?? widthMm) - o.widthMm);
        xPosMm = Math.min(Math.max(0, xPosMm), maxX);
        return {
          id: o.id,
          type: o.type,
          kind: o.kind,
          wallId,
          xPosMm,
          horizontalOffsetMm: xPosMm,
          widthMm: o.widthMm,
          heightMm: o.heightMm,
          thicknessMm: o.thicknessMm,
          floorOffsetMm: o.sillMm,
          verticalOffsetMm: o.sillMm,
        };
      });

    project = {
      ...project,
      openings,
      utilities: [],
      zones: state.zones
        .filter((z) => z.levelId === levelId)
        .map((z) => ({
          id: z.id,
          name: z.name,
          polygonMm: z.polygonMm.map((p) => ({ x: p.x, z: p.z })),
          ceilingHeightMm: heightMm,
          spaceRole: z.spaceRole === "room" ? "room" : "generic",
        })),
      ...(state.items.length > 0
        ? {
            catalogItems: state.items.map((item) => {
              const scale = item.scale ?? { x: 1, y: 1, z: 1 };
              return {
                id: item.id,
                catalogId: item.catalogId,
                levelId: item.levelId,
                type: item.type,
                name: item.name,
                positionMm: { ...item.positionMm },
                rotationDeg: item.rotationDeg,
                scale: { ...scale },
                src: item.src,
              };
            }),
          }
        : {}),
    };

    return normalizeProjectRoom(project) ?? project;
  },
};

function wallEndpointsFromProjectWall(w: ProjectRoomWall): { startMm: Vec2Mm; endMm: Vec2Mm } {
  const half = (w.widthMm ?? w.lengthMm) / 2;
  const rad = ((w.rotationDeg ?? 0) * Math.PI) / 180;
  const dx = Math.cos(rad) * half;
  const dz = Math.sin(rad) * half;
  const cx = w.position?.x ?? 0;
  const cz = w.position?.z ?? 0;
  return {
    startMm: { x: cx - dx, z: cz - dz },
    endMm: { x: cx + dx, z: cz + dz },
  };
}

export function buildRectangularRoomState(opts: {
  widthMm: number;
  depthMm: number;
  heightMm: number;
  wallThicknessMm: number;
}): RoomState {
  const base = createDefaultProjectRoom();
  const project =
    normalizeProjectRoom({
      ...base,
      widthMm: opts.widthMm,
      depthMm: opts.depthMm,
      heightMm: opts.heightMm,
      wallThicknessMm: opts.wallThicknessMm,
    }) ?? base;
  return RoomConverter.fromProjectRoomConfig(applyProjectRoomDimensions(project));
}
