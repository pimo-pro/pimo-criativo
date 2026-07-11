import type { CutListItemComPreco } from "../types";
import type { ProjectState } from "../../context/projectTypes";
import { DRILLING_SSOT_VERSION } from "../../modules/drilling/drillingAdapter";
import { clearAllCutlistCache } from "./cutlistFromBoxes";

/** Versão SSOT gravada no snapshot do projeto (invalida drilling/cutlist herdados). */
export const PROJECT_INDUSTRIAL_DRILLING_SSOT_KEY = "industrialDrillingSsotVersion" as const;

export type IndustrialDrillingPurgeReport = {
  projectName: string;
  previousSsot: string | null;
  targetSsot: string;
  strippedDrillHolesFromExtracted: number;
  clearedIndustrialPieceEdits: number;
  clearedBoxCutlists: number;
  clearedProjectCutlist: boolean;
  clearedIndustrialOperacoes: boolean;
};

function stripDrillHolesFromItems(
  items: CutListItemComPreco[] | null | undefined
): { items: CutListItemComPreco[]; stripped: number } {
  if (!items?.length) return { items: [], stripped: 0 };
  let stripped = 0;
  const out = items.map((item) => {
    if (!item.drillHoles?.length) return item;
    stripped += item.drillHoles.length;
    const { drillHoles: _d, ...rest } = item;
    return rest as CutListItemComPreco;
  });
  return { items: out, stripped };
}

function purgeExtractedParts(
  extracted: ProjectState["extractedPartsByBoxId"]
): { next: ProjectState["extractedPartsByBoxId"]; stripped: number } {
  const next: ProjectState["extractedPartsByBoxId"] = {};
  let stripped = 0;
  for (const [boxId, byModel] of Object.entries(extracted ?? {})) {
    if (!byModel || typeof byModel !== "object") continue;
    const modelMap: Record<string, CutListItemComPreco[]> = {};
    for (const [modelId, list] of Object.entries(byModel)) {
      const { items, stripped: n } = stripDrillHolesFromItems(list);
      stripped += n;
      if (items.length > 0) modelMap[modelId] = items;
    }
    if (Object.keys(modelMap).length > 0) next[boxId] = modelMap;
  }
  return { next, stripped };
}

export function readProjectIndustrialDrillingSsot(state: ProjectState): string | null {
  const v = (state as unknown as Record<string, unknown>)[PROJECT_INDUSTRIAL_DRILLING_SSOT_KEY];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Cutlist/furos persistidos no snapshot (não confundir com cache em memória). */
export function detectPersistedIndustrialCache(state: ProjectState): boolean {
  if ((state.cutListComPreco?.length ?? 0) > 0 || (state.cutList?.length ?? 0) > 0) return true;
  if (Object.keys(state.industrialOperacoes ?? {}).length > 0) return true;
  for (const box of state.boxes ?? []) {
    if ((box.cutListComPreco?.length ?? 0) > 0 || (box.cutList?.length ?? 0) > 0) return true;
  }
  for (const byModel of Object.values(state.extractedPartsByBoxId ?? {})) {
    for (const list of Object.values(byModel ?? {})) {
      if ((list as CutListItemComPreco[]).some((item) => (item.drillHoles?.length ?? 0) > 0)) {
        return true;
      }
    }
  }
  return false;
}

export function projectNeedsIndustrialDrillingPurge(
  state: ProjectState,
  options?: { force?: boolean }
): boolean {
  if (options?.force) return true;
  if (readProjectIndustrialDrillingSsot(state) !== DRILLING_SSOT_VERSION) return true;
  return detectPersistedIndustrialCache(state);
}

/**
 * Remove drilling/cutlist/nesting herdados do snapshot — geometria das caixas (workspace) intacta.
 * Após purge, chamar applyResultados + clearAllCutlistCache e guardar o projeto.
 */
export function purgeStaleIndustrialProjectData(state: ProjectState): {
  state: ProjectState;
  report: IndustrialDrillingPurgeReport;
} {
  const previousSsot = readProjectIndustrialDrillingSsot(state);
  const { next: extractedPartsByBoxId, stripped: strippedDrillHolesFromExtracted } =
    purgeExtractedParts(state.extractedPartsByBoxId);

  const editKeys = Object.keys(state.industrialPieceEdits ?? {});
  const clearedIndustrialPieceEdits = editKeys.length;

  let clearedBoxCutlists = 0;
  const boxes = (state.boxes ?? []).map((box) => {
    if ((box.cutListComPreco?.length ?? 0) > 0 || (box.cutList?.length ?? 0) > 0) {
      clearedBoxCutlists += 1;
    }
    return {
      ...box,
      cutList: [],
      cutListComPreco: [],
      estrutura3D: null,
      precoTotalPecas: 0,
    };
  });

  const hadProjectCutlist = Boolean(state.cutListComPreco?.length || state.cutList?.length);
  const hadOperacoes = Object.keys(state.industrialOperacoes ?? {}).length > 0;

  const nextState: ProjectState = {
    ...state,
    boxes,
    extractedPartsByBoxId,
    cutList: null,
    cutListComPreco: null,
    design: state.design
      ? {
          ...state.design,
          cutList: [],
        }
      : null,
    industrialPieceEdits: {},
    industrialOperacoes: {},
    [PROJECT_INDUSTRIAL_DRILLING_SSOT_KEY]: DRILLING_SSOT_VERSION,
  } as ProjectState;

  clearAllCutlistCache();

  return {
    state: nextState,
    report: {
      projectName: state.projectName?.trim() || "Projeto",
      previousSsot,
      targetSsot: DRILLING_SSOT_VERSION,
      strippedDrillHolesFromExtracted,
      clearedIndustrialPieceEdits,
      clearedBoxCutlists,
      clearedProjectCutlist: hadProjectCutlist,
      clearedIndustrialOperacoes: hadOperacoes,
    },
  };
}

export function purgeIndustrialDrillingIfStale(
  state: ProjectState,
  options?: { force?: boolean }
): {
  state: ProjectState;
  purged: boolean;
  report?: IndustrialDrillingPurgeReport;
} {
  if (!projectNeedsIndustrialDrillingPurge(state, options)) {
    return { state, purged: false };
  }
  const ssotMismatch = readProjectIndustrialDrillingSsot(state) !== DRILLING_SSOT_VERSION;
  const { state: purgedState, report } = ssotMismatch || options?.force
    ? purgeStaleIndustrialProjectData(state)
    : purgeIndustrialDrillingCache(state);
  console.info("[PIMO industrial] purgeIndustrialDrillingIfStale", JSON.stringify(report));
  return { state: purgedState, purged: true, report };
}

/** Limpa cutlist/furos persistidos; mantém industrialPieceEdits (overrides de dimensão). */
export function purgeIndustrialDrillingCache(state: ProjectState): {
  state: ProjectState;
  report: IndustrialDrillingPurgeReport;
} {
  const previousSsot = readProjectIndustrialDrillingSsot(state);
  const { next: extractedPartsByBoxId, stripped: strippedDrillHolesFromExtracted } =
    purgeExtractedParts(state.extractedPartsByBoxId);

  let clearedBoxCutlists = 0;
  const boxes = (state.boxes ?? []).map((box) => {
    if ((box.cutListComPreco?.length ?? 0) > 0 || (box.cutList?.length ?? 0) > 0) {
      clearedBoxCutlists += 1;
    }
    return {
      ...box,
      cutList: [],
      cutListComPreco: [],
      estrutura3D: null,
      precoTotalPecas: 0,
    };
  });

  const hadProjectCutlist = Boolean(state.cutListComPreco?.length || state.cutList?.length);
  const hadOperacoes = Object.keys(state.industrialOperacoes ?? {}).length > 0;

  const nextState: ProjectState = {
    ...state,
    boxes,
    extractedPartsByBoxId,
    cutList: null,
    cutListComPreco: null,
    design: state.design
      ? {
          ...state.design,
          cutList: [],
        }
      : null,
    industrialOperacoes: {},
    [PROJECT_INDUSTRIAL_DRILLING_SSOT_KEY]:
      previousSsot ?? DRILLING_SSOT_VERSION,
  } as ProjectState;

  clearAllCutlistCache();

  return {
    state: nextState,
    report: {
      projectName: state.projectName?.trim() || "Projeto",
      previousSsot,
      targetSsot: DRILLING_SSOT_VERSION,
      strippedDrillHolesFromExtracted,
      clearedIndustrialPieceEdits: 0,
      clearedBoxCutlists,
      clearedProjectCutlist: hadProjectCutlist,
      clearedIndustrialOperacoes: hadOperacoes,
    },
  };
}
