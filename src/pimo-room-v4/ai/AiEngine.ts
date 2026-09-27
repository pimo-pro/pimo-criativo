/**
 * Fachada AI do RoomEngine — arrange, design, preview, apply.
 */
import type { RoomState } from "../RoomState";
import { AiAutoArrange, type AiArrangeResult } from "./AiAutoArrange";
import { AiAutoDesign, type AiDesignOptions, type AiDesignResult } from "./AiAutoDesign";
import { AI_PRESETS, getAiPreset, isAiPresetId, type AiPresetId } from "./AiPresets";

export type AiPreviewKind = "arrange" | "design" | null;

export type AiEngineResult = {
  ok: boolean;
  state: RoomState;
  previewState: RoomState | null;
  kind: AiPreviewKind;
  affectedIds: string[];
  warnings: string[];
  errors: string[];
};

function okResult(
  state: RoomState,
  preview: RoomState,
  kind: AiPreviewKind,
  affectedIds: string[],
  warnings: string[]
): AiEngineResult {
  return {
    ok: true,
    state,
    previewState: preview,
    kind,
    affectedIds,
    warnings,
    errors: [],
  };
}

export const AiEngine = {
  presets: AI_PRESETS,
  getPreset: getAiPreset,
  isPresetId: isAiPresetId,

  /** Gera preview de Auto-Arrange (não muta o estado aplicado). */
  previewArrange(state: RoomState, levelId?: string): AiEngineResult {
    const result: AiArrangeResult = AiAutoArrange.arrange(state, levelId);
    return okResult(state, result.state, "arrange", result.movedIds, result.warnings);
  },

  /** Gera preview de Auto-Design. */
  previewDesign(state: RoomState, opts: AiDesignOptions): AiEngineResult {
    const result: AiDesignResult = AiAutoDesign.design(state, opts);
    if (result.warnings.some((w) => w.startsWith("Preset AI desconhecido"))) {
      return {
        ok: false,
        state,
        previewState: null,
        kind: null,
        affectedIds: [],
        warnings: result.warnings,
        errors: result.warnings,
      };
    }
    return okResult(
      state,
      result.state,
      "design",
      [...result.addedIds, ...result.movedIds],
      result.warnings
    );
  },

  /** Aplica estado de preview (commit). */
  applyPreview(current: RoomState, preview: RoomState): RoomState {
    return {
      ...preview,
      id: current.id,
      version: 5,
    };
  },

  /** Arrange imediato (sem preview). */
  arrangeNow(state: RoomState, levelId?: string): AiArrangeResult {
    return AiAutoArrange.arrange(state, levelId);
  },

  /** Design imediato (sem preview). */
  designNow(state: RoomState, opts: AiDesignOptions): AiDesignResult {
    return AiAutoDesign.design(state, opts);
  },

  assistMove: AiAutoArrange.assistMove,

  defaultPresetId(): AiPresetId {
    return "moderno";
  },
};
