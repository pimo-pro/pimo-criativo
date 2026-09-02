/**
 * pimo-room v4 — schema de dados da sala (nós parede/porta/janela/zona).
 *
 * SSOT do produto permanece `ProjectRoomConfig` (mm) em
 * `src/3d/viewer-engine/room/roomEngineTypes.ts`. Este módulo define tipos
 * auxiliares (metros, start/end) para construção/edição e converte de/para
 * o contrato existente — sem alterar o schema persistido.
 *
 * Atribuição (MIT): ideias de nós wall/door/window/zone adaptadas de
 * Pascal Group Inc. / Aedifex Inc. — apenas lógica de dados, sem renderer.
 * Sem Zod: o pimo-criativo não depende de Zod; tipagem TypeScript nativa.
 */

import {
  ROOM_20_DEFAULTS,
  WALL_INDEX_TO_LABEL,
  WALL_LABELS,
  type ProjectRoomConfig,
  type ProjectRoomOpening,
  type ProjectRoomWall,
  type RoomOpeningKind,
  type RoomWallLabel,
} from "../viewer-engine/room/roomEngineTypes";
import { centeredWallPositionForLabel } from "../../utils/roomCoordinates";

/** Ponto 2D no plano do nível (metros): [x, z]. */
export type PimoRoomPoint2 = readonly [number, number];

/** Posição 3D local à parede (metros): [u, v, n]. */
export type PimoRoomPoint3 = readonly [number, number, number];

export type PimoRoomWallNode = {
  id: string;
  type: "wall";
  /** Início do eixo da parede no plano do nível (m). */
  start: PimoRoomPoint2;
  /** Fim do eixo da parede no plano do nível (m). */
  end: PimoRoomPoint2;
  /** Espessura em metros. */
  thickness: number;
  /** Altura em metros. */
  height: number;
  /** Rótulo canónico pimo (sul/este/norte/oeste/extra). */
  label: RoomWallLabel;
  /** IDs de portas/janelas hospedadas. */
  children: string[];
};

export type PimoRoomDoorNode = {
  id: string;
  type: "door";
  wallId: string;
  /** Centro da abertura em coordenadas locais da parede (m). */
  position: PimoRoomPoint3;
  width: number;
  height: number;
  kind: RoomOpeningKind;
};

export type PimoRoomWindowNode = {
  id: string;
  type: "window";
  wallId: string;
  position: PimoRoomPoint3;
  width: number;
  height: number;
  kind: RoomOpeningKind;
};

export type PimoRoomZoneNode = {
  id: string;
  type: "zone";
  name: string;
  /** Polígono [x, z] em metros (sistema centrado). */
  polygon: PimoRoomPoint2[];
  ceilingHeight: number;
  spaceRole: "generic" | "room";
};

export type PimoRoomGraph = {
  walls: PimoRoomWallNode[];
  doors: PimoRoomDoorNode[];
  windows: PimoRoomWindowNode[];
  zones: PimoRoomZoneNode[];
};

const MM_PER_M = 1000;

function mmToM(mm: number): number {
  return mm / MM_PER_M;
}

function mToMm(m: number): number {
  return m * MM_PER_M;
}

function wallAxisFromProjectWall(wall: ProjectRoomWall): { start: PimoRoomPoint2; end: PimoRoomPoint2 } {
  const cx = mmToM(wall.position.x);
  const cz = mmToM(wall.position.z);
  const halfLen = mmToM(wall.widthMm || wall.lengthMm) / 2;
  const rotRad = ((wall.rotationDeg ?? 0) * Math.PI) / 180;
  const dx = Math.cos(rotRad) * halfLen;
  const dz = Math.sin(rotRad) * halfLen;
  return {
    start: [cx - dx, cz - dz],
    end: [cx + dx, cz + dz],
  };
}

function openingLocalPositionM(opening: ProjectRoomOpening, wall: ProjectRoomWall): PimoRoomPoint3 {
  const wallLenM = mmToM(wall.widthMm || wall.lengthMm);
  const widthM = mmToM(opening.widthMm);
  const heightM = mmToM(opening.heightMm);
  const u = mmToM(opening.xPosMm ?? opening.horizontalOffsetMm) + widthM / 2 - wallLenM / 2;
  const v = mmToM(opening.floorOffsetMm ?? opening.verticalOffsetMm) + heightM / 2;
  return [u, v, 0];
}

/** Converte o SSOT mm (`ProjectRoomConfig`) para o grafo pimo-room (metros). */
export function projectRoomToPimoRoomGraph(room: ProjectRoomConfig): PimoRoomGraph {
  const walls: PimoRoomWallNode[] = room.walls.map((wall) => {
    const axis = wallAxisFromProjectWall(wall);
    const children = room.openings.filter((o) => o.wallId === wall.id).map((o) => o.id);
    return {
      id: wall.id,
      type: "wall",
      start: axis.start,
      end: axis.end,
      thickness: mmToM(wall.thicknessMm),
      height: mmToM(wall.heightMm),
      label: wall.label,
      children,
    };
  });

  const doors: PimoRoomDoorNode[] = [];
  const windows: PimoRoomWindowNode[] = [];
  for (const opening of room.openings) {
    const wall = room.walls.find((w) => w.id === opening.wallId);
    if (!wall) continue;
    const position = openingLocalPositionM(opening, wall);
    if (opening.type === "door") {
      doors.push({
        id: opening.id,
        type: "door",
        wallId: opening.wallId,
        position,
        width: mmToM(opening.widthMm),
        height: mmToM(opening.heightMm),
        kind: opening.kind ?? "normal",
      });
    } else {
      windows.push({
        id: opening.id,
        type: "window",
        wallId: opening.wallId,
        position,
        width: mmToM(opening.widthMm),
        height: mmToM(opening.heightMm),
        kind: opening.kind ?? "normal",
      });
    }
  }

  const halfW = mmToM(room.widthMm) / 2;
  const halfD = mmToM(room.depthMm) / 2;
  const zones: PimoRoomZoneNode[] =
    room.zones && room.zones.length > 0
      ? room.zones.map((z) => ({
          id: z.id,
          type: "zone" as const,
          name: z.name,
          polygon: z.polygonMm.map((p) => [mmToM(p.x), mmToM(p.z)] as const),
          ceilingHeight: mmToM(z.ceilingHeightMm ?? room.heightMm),
          spaceRole: z.spaceRole === "generic" ? ("generic" as const) : ("room" as const),
        }))
      : [
          {
            id: "zone-room-main",
            type: "zone",
            name: "Sala",
            polygon: [
              [-halfW, -halfD],
              [halfW, -halfD],
              [halfW, halfD],
              [-halfW, halfD],
            ],
            ceilingHeight: mmToM(room.heightMm),
            spaceRole: "room",
          },
        ];

  return { walls, doors, windows, zones };
}

/**
 * Reconstrói um `ProjectRoomConfig` a partir do grafo pimo-room.
 * Mantém footprint/altura a partir das paredes canónicas quando possível.
 */
export function pimoRoomGraphToProjectRoom(
  graph: PimoRoomGraph,
  base?: Partial<ProjectRoomConfig>
): ProjectRoomConfig {
  const wallById = new Map(graph.walls.map((w) => [w.id, w]));
  const orderedWalls =
    graph.walls.length >= 4
      ? WALL_LABELS.map(
          (label) => graph.walls.find((w) => w.label === label) ?? graph.walls[WALL_LABELS.indexOf(label)]
        ).filter(Boolean) as PimoRoomWallNode[]
      : graph.walls;

  const sul = orderedWalls.find((w) => w.label === "sul") ?? orderedWalls[0];
  const este = orderedWalls.find((w) => w.label === "este") ?? orderedWalls[1];
  const widthMm = Math.max(500, mToMm(Math.hypot(sul.end[0] - sul.start[0], sul.end[1] - sul.start[1])));
  const depthMm = Math.max(
    500,
    este
      ? mToMm(Math.hypot(este.end[0] - este.start[0], este.end[1] - este.start[1]))
      : widthMm
  );
  const heightMm = Math.max(500, mToMm(sul?.height ?? mmToM(ROOM_20_DEFAULTS.heightMm)));
  const wallThicknessMm = Math.max(
    50,
    mToMm(sul?.thickness ?? mmToM(ROOM_20_DEFAULTS.wallThicknessMm))
  );

  const walls: ProjectRoomWall[] = orderedWalls.map((wall, index) => {
    const label = wall.label || WALL_INDEX_TO_LABEL[index] || "extra";
    const lenMm = mToMm(Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]));
    const midX = ((wall.start[0] + wall.end[0]) / 2) * MM_PER_M;
    const midZ = ((wall.start[1] + wall.end[1]) / 2) * MM_PER_M;
    const rotationDeg =
      (Math.atan2(wall.end[1] - wall.start[1], wall.end[0] - wall.start[0]) * 180) / Math.PI;
    return {
      id: wall.id,
      label,
      widthMm: lenMm,
      lengthMm: lenMm,
      heightMm: mToMm(wall.height),
      thicknessMm: mToMm(wall.thickness),
      position: {
        x: midX,
        y: heightMm / 2,
        z: midZ,
      },
      rotationDeg,
    };
  });

  // Se faltarem posições coerentes, reajusta as canónicas ao footprint.
  const canonical = walls.filter((w) => w.label !== "extra");
  if (canonical.length >= 4) {
    for (const wall of walls) {
      if (wall.label === "extra") continue;
      wall.position = centeredWallPositionForLabel(
        wall.label,
        widthMm,
        depthMm,
        heightMm,
        wallThicknessMm
      );
      wall.widthMm = wall.label === "sul" || wall.label === "norte" ? widthMm : depthMm;
      wall.lengthMm = wall.widthMm;
      wall.heightMm = heightMm;
      wall.thicknessMm = wallThicknessMm;
    }
  }

  const openings: ProjectRoomOpening[] = [];
  const pushOpening = (
    node: PimoRoomDoorNode | PimoRoomWindowNode,
    type: "door" | "window"
  ) => {
    const host = wallById.get(node.wallId);
    const wallLenM = host
      ? Math.hypot(host.end[0] - host.start[0], host.end[1] - host.start[1])
      : mmToM(widthMm);
    const xPosMm = Math.max(0, mToMm(node.position[0] + wallLenM / 2 - node.width / 2));
    const floorOffsetMm = Math.max(0, mToMm(node.position[1] - node.height / 2));
    openings.push({
      id: node.id,
      type,
      kind: node.kind,
      wallId: node.wallId,
      xPosMm,
      horizontalOffsetMm: xPosMm,
      widthMm: mToMm(node.width),
      heightMm: mToMm(node.height),
      thicknessMm: 40,
      floorOffsetMm,
      verticalOffsetMm: floorOffsetMm,
    });
  };

  for (const door of graph.doors) pushOpening(door, "door");
  for (const win of graph.windows) pushOpening(win, "window");

  const zones =
    graph.zones.length > 0
      ? graph.zones.map((z) => ({
          id: z.id,
          name: z.name,
          polygonMm: z.polygon.map((p) => ({ x: mToMm(p[0]), z: mToMm(p[1]) })),
          ceilingHeightMm: mToMm(z.ceilingHeight),
          spaceRole: z.spaceRole,
        }))
      : undefined;

  return {
    widthMm: base?.widthMm ?? widthMm,
    depthMm: base?.depthMm ?? depthMm,
    heightMm: base?.heightMm ?? heightMm,
    wallThicknessMm: base?.wallThicknessMm ?? wallThicknessMm,
    locked: base?.locked === true,
    visible: base?.visible !== false,
    floorMode: base?.floorMode ?? "room",
    ceilingVisible: base?.ceilingVisible !== false,
    hiddenWalls: base?.hiddenWalls ?? [],
    walls,
    openings,
    utilities: base?.utilities ?? [],
    ...(zones ? { zones } : {}),
  };
}

import { PIMO_ROOM_CHANGELOG } from "./pimoRoomVersion";

export const PIMO_ROOM_MODULE = {
  name: "pimo-room",
  version: "4.0.0",
  changelog: PIMO_ROOM_CHANGELOG,
} as const;
