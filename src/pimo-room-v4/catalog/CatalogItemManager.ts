/**
 * CRUD de itens no RoomState.
 */
import type { RoomState } from "../RoomState";
import { newId } from "../RoomState";
import type { CatalogItemState } from "./CatalogItemState";
import { DEFAULT_ITEM_SCALE } from "./CatalogItemState";
import { getCatalogPreset } from "./CatalogPresets";

function cloneState(state: RoomState): RoomState {
  return structuredClone(state);
}

/** Converte RoomItem legado → CatalogItemState. */
export function toCatalogItemState(
  item: RoomState["items"][number] & Partial<CatalogItemState>
): CatalogItemState {
  const preset = getCatalogPreset(item.catalogId);
  return {
    id: item.id,
    catalogId: item.catalogId,
    levelId: item.levelId,
    type: (item as CatalogItemState).type ?? preset?.type ?? "custom",
    name: (item as CatalogItemState).name ?? preset?.name ?? item.catalogId,
    positionMm: { ...item.positionMm },
    rotationDeg: item.rotationDeg ?? 0,
    scale: (item as CatalogItemState).scale ?? { ...DEFAULT_ITEM_SCALE },
    wallId: item.wallId,
    src: (item as CatalogItemState).src ?? preset?.src,
  };
}

export const CatalogItemManager = {
  list(state: RoomState, levelId?: string): CatalogItemState[] {
    const items = state.items.map(toCatalogItemState);
    if (!levelId) return items;
    return items.filter((i) => i.levelId === levelId);
  },

  add(
    state: RoomState,
    catalogId: string,
    opts?: { positionMm?: { x: number; y: number; z: number }; levelId?: string }
  ): RoomState {
    const preset = getCatalogPreset(catalogId);
    if (!preset) return state;
    const next = cloneState(state);
    const levelId = opts?.levelId ?? next.activeLevelId;
    const item: CatalogItemState = {
      id: newId("item"),
      catalogId: preset.id,
      levelId,
      type: preset.type,
      name: preset.name,
      positionMm: opts?.positionMm ?? { x: 0, y: 0, z: 0 },
      rotationDeg: 0,
      scale: { ...DEFAULT_ITEM_SCALE },
      src: preset.src,
    };
    next.items.push(item as RoomState["items"][number]);
    return next;
  },

  remove(state: RoomState, itemId: string): RoomState {
    const next = cloneState(state);
    next.items = next.items.filter((i) => i.id !== itemId);
    return next;
  },

  duplicate(state: RoomState, itemId: string): RoomState {
    const found = state.items.find((i) => i.id === itemId);
    if (!found) return state;
    const src = toCatalogItemState(found);
    const next = cloneState(state);
    const copy: CatalogItemState = {
      ...structuredClone(src),
      id: newId("item"),
      positionMm: {
        x: src.positionMm.x + 200,
        y: src.positionMm.y,
        z: src.positionMm.z + 200,
      },
    };
    next.items.push(copy as RoomState["items"][number]);
    return next;
  },

  move(state: RoomState, itemId: string, positionMm: { x: number; y: number; z: number }): RoomState {
    const next = cloneState(state);
    const item = next.items.find((i) => i.id === itemId);
    if (!item) return state;
    item.positionMm = { ...positionMm };
    return next;
  },

  rotate(state: RoomState, itemId: string, rotationDeg: number): RoomState {
    const next = cloneState(state);
    const item = next.items.find((i) => i.id === itemId);
    if (!item) return state;
    item.rotationDeg = ((rotationDeg % 360) + 360) % 360;
    return next;
  },

  setScale(
    state: RoomState,
    itemId: string,
    scale: { x: number; y: number; z: number }
  ): RoomState {
    const next = cloneState(state);
    const item = next.items.find((i) => i.id === itemId) as CatalogItemState | undefined;
    if (!item) return state;
    (item as CatalogItemState).scale = {
      x: Math.max(0.1, scale.x),
      y: Math.max(0.1, scale.y),
      z: Math.max(0.1, scale.z),
    };
    return next;
  },

  reassignLevel(state: RoomState, fromLevelId: string, toLevelId: string): RoomState {
    const next = cloneState(state);
    for (const item of next.items) {
      if (item.levelId === fromLevelId) item.levelId = toLevelId;
    }
    return next;
  },
};

export type { CatalogItemType } from "./CatalogItem";
