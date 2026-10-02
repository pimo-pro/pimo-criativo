/**
 * Auto-Arrange — reorganiza itens do nível activo com regras espaciais.
 */
import { CatalogItemManager, toCatalogItemState } from "../catalog/CatalogItemManager";
import type { CatalogItemState } from "../catalog/CatalogItemState";
import type { RoomState } from "../RoomState";
import {
  AI_RULES,
  clampToBounds,
  getItemHalfExtents,
  getLevelBounds,
  isValidPlacement,
  longestWall,
  openingBlockedZones,
  toFootprint,
  type AiItemFootprint,
  typePriority,
  wallInwardNormal,
  wallYawDeg,
} from "./AiRules";

export type AiArrangeResult = {
  state: RoomState;
  movedIds: string[];
  warnings: string[];
};

function tryPlaceNear(
  item: CatalogItemState,
  preferred: { x: number; z: number; rotationDeg: number },
  placed: AiItemFootprint[],
  bounds: ReturnType<typeof getLevelBounds>,
  openingZones: ReturnType<typeof openingBlockedZones>
): CatalogItemState {
  const { halfW, halfD } = getItemHalfExtents({ ...item, rotationDeg: preferred.rotationDeg });
  const clamped = clampToBounds(preferred.x, preferred.z, halfW, halfD, bounds);
  const candidate: AiItemFootprint = {
    id: item.id,
    type: item.type,
    cx: clamped.x,
    cz: clamped.z,
    halfW,
    halfD,
    rotationDeg: preferred.rotationDeg,
  };
  if (isValidPlacement(candidate, placed, bounds, openingZones)) {
    return {
      ...item,
      positionMm: { x: clamped.x, y: item.positionMm.y, z: clamped.z },
      rotationDeg: preferred.rotationDeg,
    };
  }

  // Spiral / grelha à volta do ponto preferido
  const step = AI_RULES.gridStepMm;
  for (let ring = 1; ring <= 12; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dz = -ring; dz <= ring; dz++) {
        if (Math.abs(dx) !== ring && Math.abs(dz) !== ring) continue;
        const x = preferred.x + dx * step;
        const z = preferred.z + dz * step;
        const c = clampToBounds(x, z, halfW, halfD, bounds);
        const fp: AiItemFootprint = {
          id: item.id,
          type: item.type,
          cx: c.x,
          cz: c.z,
          halfW,
          halfD,
          rotationDeg: preferred.rotationDeg,
        };
        if (isValidPlacement(fp, placed, bounds, openingZones)) {
          return {
            ...item,
            positionMm: { x: c.x, y: item.positionMm.y, z: c.z },
            rotationDeg: preferred.rotationDeg,
          };
        }
      }
    }
  }

  // Fallback: centro
  const mid = {
    x: (bounds.minX + bounds.maxX) / 2,
    z: (bounds.minZ + bounds.maxZ) / 2,
  };
  const c = clampToBounds(mid.x, mid.z, halfW, halfD, bounds);
  return {
    ...item,
    positionMm: { x: c.x, y: item.positionMm.y, z: c.z },
    rotationDeg: preferred.rotationDeg,
  };
}

function preferredPose(
  item: CatalogItemState,
  ctx: {
    bounds: ReturnType<typeof getLevelBounds>;
    wall: ReturnType<typeof longestWall>;
    sofa?: CatalogItemState;
    table?: CatalogItemState;
    seatIndex: number;
    lampIndex: number;
  }
): { x: number; z: number; rotationDeg: number } {
  const midX = (ctx.bounds.minX + ctx.bounds.maxX) / 2;
  const midZ = (ctx.bounds.minZ + ctx.bounds.maxZ) / 2;

  if (item.type === "sofa" && ctx.wall) {
    const n = wallInwardNormal(ctx.wall, ctx.bounds);
    const mid = {
      x: (ctx.wall.startMm.x + ctx.wall.endMm.x) / 2,
      z: (ctx.wall.startMm.z + ctx.wall.endMm.z) / 2,
    };
    const depth = getItemHalfExtents(item).halfD + AI_RULES.wallClearanceMm + 100;
    return {
      x: mid.x + n.x * depth,
      z: mid.z + n.z * depth,
      rotationDeg: (wallYawDeg(ctx.wall) + 180) % 360,
    };
  }

  if (item.type === "table") {
    if (ctx.sofa) {
      const yaw = (ctx.sofa.rotationDeg * Math.PI) / 180;
      // à frente do sofá
      const dist = 900;
      return {
        x: ctx.sofa.positionMm.x + Math.sin(yaw) * dist,
        z: ctx.sofa.positionMm.z + Math.cos(yaw) * dist,
        rotationDeg: ctx.sofa.rotationDeg,
      };
    }
    return { x: midX, z: midZ, rotationDeg: 0 };
  }

  if (item.type === "chair") {
    const anchor = ctx.table ?? ctx.sofa;
    if (anchor) {
      const angles = [0, 90, 180, 270];
      const a = (angles[ctx.seatIndex % angles.length]! * Math.PI) / 180;
      const dist = 700;
      return {
        x: anchor.positionMm.x + Math.sin(a) * dist,
        z: anchor.positionMm.z + Math.cos(a) * dist,
        rotationDeg: (angles[ctx.seatIndex % angles.length]! + 180) % 360,
      };
    }
    return { x: midX + 400, z: midZ, rotationDeg: 0 };
  }

  if (item.type === "lamp") {
    const corners = [
      { x: ctx.bounds.minX + 300, z: ctx.bounds.minZ + 300 },
      { x: ctx.bounds.maxX - 300, z: ctx.bounds.minZ + 300 },
      { x: ctx.bounds.minX + 300, z: ctx.bounds.maxZ - 300 },
      { x: ctx.bounds.maxX - 300, z: ctx.bounds.maxZ - 300 },
    ];
    const c = corners[ctx.lampIndex % corners.length]!;
    return { x: c.x, z: c.z, rotationDeg: 0 };
  }

  // custom / fill — grelha
  const col = ctx.seatIndex % 3;
  const row = Math.floor(ctx.seatIndex / 3);
  return {
    x: midX + (col - 1) * 800,
    z: midZ + row * 800,
    rotationDeg: 0,
  };
}

export function autoArrangeLevel(state: RoomState, levelId?: string): AiArrangeResult {
  const lid = levelId ?? state.activeLevelId;
  const warnings: string[] = [];
  const items = CatalogItemManager.list(state, lid);
  if (items.length === 0) {
    return { state, movedIds: [], warnings: ["Nenhum item no nível activo"] };
  }

  const bounds = getLevelBounds(state, lid);
  if (bounds.maxX - bounds.minX < 1000 || bounds.maxZ - bounds.minZ < 1000) {
    warnings.push("Footprint muito pequeno para arrange ideal");
  }

  const openingZones = openingBlockedZones(state, lid);
  const wall = longestWall(state, lid);
  const sorted = [...items].sort((a, b) => typePriority(a.type) - typePriority(b.type));

  const placed: AiItemFootprint[] = [];
  const updated: CatalogItemState[] = [];
  const movedIds: string[] = [];
  let sofa: CatalogItemState | undefined;
  let table: CatalogItemState | undefined;
  let seatIndex = 0;
  let lampIndex = 0;

  for (const item of sorted) {
    const preferred = preferredPose(item, {
      bounds,
      wall,
      sofa,
      table,
      seatIndex,
      lampIndex,
    });
    const next = tryPlaceNear(item, preferred, placed, bounds, openingZones);
    if (
      next.positionMm.x !== item.positionMm.x ||
      next.positionMm.z !== item.positionMm.z ||
      next.rotationDeg !== item.rotationDeg
    ) {
      movedIds.push(item.id);
    }
    updated.push(next);
    placed.push(toFootprint(next));
    if (next.type === "sofa" && !sofa) sofa = next;
    if (next.type === "table" && !table) table = next;
    if (next.type === "chair") seatIndex++;
    if (next.type === "lamp") lampIndex++;
    if (next.type === "custom") seatIndex++;
  }

  const nextState = structuredClone(state);
  nextState.version = 5;
  const byId = new Map(updated.map((i) => [i.id, i]));
  nextState.items = nextState.items.map((raw) => {
    const u = byId.get(raw.id);
    if (!u) return raw;
    return {
      ...raw,
      positionMm: { ...u.positionMm },
      rotationDeg: u.rotationDeg,
      type: u.type,
      name: u.name,
      scale: u.scale,
    };
  });

  return { state: nextState, movedIds, warnings };
}

export const AiAutoArrange = {
  arrange: autoArrangeLevel,
  /** Assist: move/roda um item com regras (snap válido). */
  assistMove(
    state: RoomState,
    itemId: string,
    positionMm: { x: number; y: number; z: number },
    rotationDeg?: number
  ): RoomState {
    const item = state.items.find((i) => i.id === itemId);
    if (!item) return state;
    const c = toCatalogItemState(item);
    const bounds = getLevelBounds(state, c.levelId);
    const zones = openingBlockedZones(state, c.levelId);
    const others = CatalogItemManager.list(state, c.levelId)
      .filter((i) => i.id !== itemId)
      .map(toFootprint);
    const rot = rotationDeg ?? c.rotationDeg;
    const { halfW, halfD } = getItemHalfExtents({ ...c, rotationDeg: rot });
    const clamped = clampToBounds(positionMm.x, positionMm.z, halfW, halfD, bounds);
    const fp: AiItemFootprint = {
      id: c.id,
      type: c.type,
      cx: clamped.x,
      cz: clamped.z,
      halfW,
      halfD,
      rotationDeg: rot,
    };
    if (!isValidPlacement(fp, others, bounds, zones)) {
      // empurra para posição válida próxima
      const fixed = tryPlaceNear(
        { ...c, rotationDeg: rot },
        { x: clamped.x, z: clamped.z, rotationDeg: rot },
        others,
        bounds,
        zones
      );
      return CatalogItemManager.move(
        CatalogItemManager.rotate(state, itemId, fixed.rotationDeg),
        itemId,
        fixed.positionMm
      );
    }
    let next = CatalogItemManager.move(state, itemId, {
      x: clamped.x,
      y: positionMm.y,
      z: clamped.z,
    });
    next = CatalogItemManager.rotate(next, itemId, rot);
    return next;
  },
};
