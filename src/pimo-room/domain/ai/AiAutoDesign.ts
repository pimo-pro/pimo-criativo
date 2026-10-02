/**
 * Auto-Design — aplica preset completo (itens + arrange).
 */
import { CatalogItemManager } from "../catalog/CatalogItemManager";
import { newId, type RoomState } from "../RoomState";
import { autoArrangeLevel } from "./AiAutoArrange";
import { getAiPreset, type AiPresetId } from "./AiPresets";

export type AiDesignOptions = {
  presetId: AiPresetId;
  levelId?: string;
  /** Se true, remove itens do nível antes de gerar. Default true. */
  replaceItems?: boolean;
};

export type AiDesignResult = {
  state: RoomState;
  addedIds: string[];
  movedIds: string[];
  warnings: string[];
};

export function autoDesign(state: RoomState, opts: AiDesignOptions): AiDesignResult {
  const preset = getAiPreset(opts.presetId);
  if (!preset) {
    return {
      state,
      addedIds: [],
      movedIds: [],
      warnings: [`Preset AI desconhecido: ${opts.presetId}`],
    };
  }

  const levelId = opts.levelId ?? state.activeLevelId;
  const replace = opts.replaceItems !== false;
  let next = structuredClone(state);
  next.version = 5;
  next.aiPreset = opts.presetId;

  if (replace) {
    next.items = next.items.filter((i) => i.levelId !== levelId);
  }

  const addedIds: string[] = [];
  for (const spec of preset.items) {
    const before = next.items.length;
    next = CatalogItemManager.add(next, spec.catalogId, {
      levelId,
      positionMm: { x: 0, y: 0, z: 0 },
    });
    if (next.items.length > before) {
      const last = next.items[next.items.length - 1]!;
      // garantir id estável único
      if (!last.id) last.id = newId("item");
      last.type = spec.type;
      addedIds.push(last.id);
    }
  }

  const arranged = autoArrangeLevel(next, levelId);
  return {
    state: {
      ...arranged.state,
      aiPreset: opts.presetId,
      version: 5,
    },
    addedIds,
    movedIds: arranged.movedIds,
    warnings: arranged.warnings,
  };
}

export const AiAutoDesign = {
  design: autoDesign,
};
