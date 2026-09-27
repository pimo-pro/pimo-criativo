import type { RoomMaterialRef, RoomState, WallId } from "./RoomState";

function cloneState(state: RoomState): RoomState {
  return structuredClone(state);
}

export const MATERIAL_PRESETS: Record<
  string,
  { color: string; roughness: number; metalness: number; label: string }
> = {
  white: { color: "#f5f5f5", roughness: 0.85, metalness: 0.02, label: "Branco" },
  plaster: { color: "#e8e4dc", roughness: 0.9, metalness: 0, label: "Estuque" },
  concrete: { color: "#9a9a9a", roughness: 0.95, metalness: 0, label: "Betão" },
  wood: { color: "#b08968", roughness: 0.7, metalness: 0, label: "Madeira" },
  brick: { color: "#a0522d", roughness: 0.92, metalness: 0, label: "Tijolo" },
  glass: { color: "#a8d4e6", roughness: 0.05, metalness: 0.1, label: "Vidro" },
};

export const MaterialsEngine = {
  assignWallSlot(
    state: RoomState,
    wallId: WallId,
    slot: "interior" | "exterior",
    ref: RoomMaterialRef
  ): RoomState {
    const next = cloneState(state);
    const wall = next.walls.find((w) => w.id === wallId);
    if (!wall) return state;
    wall.materialSlots = { ...wall.materialSlots, [slot]: ref };
    if (ref.kind === "preset") {
      next.materials[ref.presetId] = ref;
    }
    return next;
  },

  resolveForRender(ref: RoomMaterialRef): {
    color: string;
    roughness: number;
    metalness: number;
  } {
    if (ref.kind === "color") {
      return {
        color: ref.hex,
        roughness: ref.roughness ?? 0.8,
        metalness: ref.metalness ?? 0,
      };
    }
    if (ref.kind === "preset") {
      const p = MATERIAL_PRESETS[ref.presetId] ?? MATERIAL_PRESETS.white;
      return { color: p.color, roughness: p.roughness, metalness: p.metalness };
    }
    // pimo materialId — fallback neutro até bridge de materiais industriais
    return { color: "#cccccc", roughness: 0.8, metalness: 0 };
  },
};
