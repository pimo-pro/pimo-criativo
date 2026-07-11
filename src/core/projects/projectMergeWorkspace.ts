/**
 * Merge opcional de vários snapshots num único ProjectState (workspace).
 * Não altera ficheiros guardados nem o fluxo de loadProjectSnapshot.
 */

import { ensureBoxPanelIds } from "../box/panelIds";
import type { WorkspaceBox } from "../types";
import { applyResultados } from "../../context/projectState";
import { reviveState } from "../../context/projectPersistence";
import type { ProjectState } from "../../context/projectTypes";
import { loadProjectRecord } from "./projectsClient";
import { purgeIndustrialDrillingIfStale } from "../manufacturing/industrialProjectDrillingPurge";

export const PIMO_PENDING_WORKSPACE_MERGE_IDS = "pimo_pending_workspace_merge_ids";

export type MergeWorkspaceOptions = {
  gapMm?: number;
  strategy?: "append";
};

export type ProjectBoundingBoxMm = {
  widthMm: number;
  depthMm: number;
  heightMm: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY: number;
  maxY: number;
};

function sanitizeIdPrefix(raw: string): string {
  const s = raw.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_");
  return (s.length > 0 ? s : "proj").slice(0, 48);
}

function boxFootprintAndHeight(b: WorkspaceBox): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY: number;
  maxY: number;
} {
  const cx = b.posicaoX_mm ?? 0;
  const cz = b.posicaoZ_mm ?? 0;
  const alt = b.dimensoes?.altura ?? 0;
  const cy = b.posicaoY_mm != null && b.posicaoY_mm > 0 ? b.posicaoY_mm : alt / 2;
  const hw = (b.dimensoes?.largura ?? 0) / 2;
  const hd = (b.dimensoes?.profundidade ?? 0) / 2;
  const hh = alt / 2;
  return {
    minX: cx - hw,
    maxX: cx + hw,
    minZ: cz - hd,
    maxZ: cz + hd,
    minY: cy - hh,
    maxY: cy + hh,
  };
}

/** Dimensões globais AABB (eixos alinhados, ignora rotação fina). */
export function computeProjectBoundingBox(state: ProjectState): ProjectBoundingBoxMm {
  const boxes = state.workspaceBoxes ?? [];
  if (boxes.length === 0) {
    return {
      widthMm: 0,
      depthMm: 0,
      heightMm: 0,
      minX: 0,
      maxX: 0,
      minZ: 0,
      maxZ: 0,
      minY: 0,
      maxY: 0,
    };
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const b of boxes) {
    const f = boxFootprintAndHeight(b);
    minX = Math.min(minX, f.minX);
    maxX = Math.max(maxX, f.maxX);
    minZ = Math.min(minZ, f.minZ);
    maxZ = Math.max(maxZ, f.maxZ);
    minY = Math.min(minY, f.minY);
    maxY = Math.max(maxY, f.maxY);
  }
  return {
    widthMm: maxX - minX,
    depthMm: maxZ - minZ,
    heightMm: maxY - minY,
    minX,
    maxX,
    minZ,
    maxZ,
    minY,
    maxY,
  };
}

/** Desloca todas as caixas em X/Z (mm). */
export function offsetProjectState(state: ProjectState, offsetXMm: number, offsetZMm: number): ProjectState {
  return {
    ...state,
    workspaceBoxes: (state.workspaceBoxes ?? []).map((b) => ({
      ...b,
      posicaoX_mm: (b.posicaoX_mm ?? 0) + offsetXMm,
      posicaoZ_mm: (b.posicaoZ_mm ?? 0) + offsetZMm,
    })),
  };
}

function deepCloneState(state: ProjectState): ProjectState {
  return JSON.parse(JSON.stringify(state)) as ProjectState;
}

/** Prefixa ids de caixas, modelos e chaves de extractedPartsByBoxId. */
export function prefixMergedProjectState(state: ProjectState, snapshotId: string): ProjectState {
  const prefix = `m-${sanitizeIdPrefix(snapshotId)}-`;
  const next = deepCloneState(state);
  next.workspaceBoxes = (state.workspaceBoxes ?? []).map((b) => ({
    ...b,
    id: `${prefix}${b.id}`,
    models: (b.models ?? []).map((m) => ({
      ...m,
      id: `${prefix}${m.id}`,
    })),
    panelIds: ensureBoxPanelIds(b.panelIds, {
      prateleiras: b.prateleiras,
      portaTipo: b.portaTipo,
      gavetas: b.gavetas,
    }),
  }));
  const ext: ProjectState["extractedPartsByBoxId"] = {};
  for (const [k, v] of Object.entries(state.extractedPartsByBoxId ?? {})) {
    ext[`${prefix}${k}`] = v;
  }
  next.extractedPartsByBoxId = ext;

  const mp: ProjectState["modelPositionsByBoxId"] = {};
  for (const [boxId, inner] of Object.entries(state.modelPositionsByBoxId ?? {})) {
    const innerNext: Record<string, { x: number; y: number; z: number }> = {};
    for (const [modelId, pos] of Object.entries(inner ?? {})) {
      innerNext[`${prefix}${modelId}`] = pos;
    }
    mp[`${prefix}${boxId}`] = innerNext;
  }
  next.modelPositionsByBoxId = mp;

  next.ruleViolations = (state.ruleViolations ?? []).map((v) => ({
    ...v,
    boxId: `${prefix}${v.boxId}`,
    modelInstanceId: v.modelInstanceId ? `${prefix}${v.modelInstanceId}` : v.modelInstanceId,
  }));

  const lw = state.layoutWarnings ?? { collisions: [], outOfBounds: [] };
  next.layoutWarnings = {
    collisions: (lw.collisions ?? []).map((c) => ({
      ...c,
      boxId: `${prefix}${c.boxId}`,
      modelIdA: `${prefix}${c.modelIdA}`,
      modelIdB: `${prefix}${c.modelIdB}`,
    })),
    outOfBounds: (lw.outOfBounds ?? []).map((o) => ({
      ...o,
      boxId: `${prefix}${o.boxId}`,
      modelInstanceId: `${prefix}${o.modelInstanceId}`,
    })),
  };

  if (state.estrutura3D?.pecas?.length) {
    const pecas = state.estrutura3D.pecas.map((p) => ({
      ...p,
      id: `${prefix}${p.id}`,
    }));
    next.estrutura3D = {
      ...state.estrutura3D,
      pecas,
    };
  }

  return next;
}

/** Centra a pegada no XZ em (0,0) mantendo espaçamento relativo. */
function normalizeFootprintToOriginXZ(state: ProjectState): ProjectState {
  const bb = computeProjectBoundingBox(state);
  if (state.workspaceBoxes?.length === 0) return state;
  return offsetProjectState(state, -bb.minX, -bb.minZ);
}

/**
 * Carrega snapshots, combina caixas com offsets em fila no eixo X, ids únicos por prefixo.
 * @throws Error se algum id falhar ou lista vazia
 */
export async function mergeProjectSnapshotsIntoWorkspace(
  ids: string[],
  options?: MergeWorkspaceOptions
): Promise<ProjectState> {
  if (!ids.length) {
    throw new Error("Merge: nenhum id de projeto foi indicado.");
  }

  const gapMm = options?.gapMm ?? 400;
  if (options?.strategy != null && options.strategy !== "append") {
    throw new Error(`Merge: estratégia não suportada: ${options.strategy}`);
  }

  const prepared: ProjectState[] = [];

  for (const id of ids) {
    const record = await loadProjectRecord(id);
    if (!record) {
      throw new Error(`Merge: não foi possível carregar o projeto "${id}".`);
    }
    const revived = reviveState(record.snapshot?.projectState);
    if (!revived) {
      throw new Error(`Merge: snapshot inválido para o projeto "${id}".`);
    }
    const { state: purgedState } = purgeIndustrialDrillingIfStale(revived);
    const withResults = applyResultados(purgedState);
    const prefixed = prefixMergedProjectState(withResults, id);
    const normalized = normalizeFootprintToOriginXZ(prefixed);
    prepared.push(normalized);
  }

  const base = deepCloneState(prepared[0]);
  base.workspaceBoxes = [];
  base.boxes = [];
  base.extractedPartsByBoxId = {};
  base.modelPositionsByBoxId = {};
  base.cutList = [];
  base.design = null;
  base.estrutura3D = null;
  base.resultados = null;

  const idListShort = ids.map((x) => x.slice(0, 12)).join(", ");
  base.projectName = `Merge (${ids.length}) ${idListShort.length > 80 ? `${idListShort.slice(0, 77)}…` : idListShort}`;

  let cursorXmm = 0;

  for (let i = 0; i < prepared.length; i++) {
    const st = prepared[i];
    const bb = computeProjectBoundingBox(st);
    const width = bb.maxX - bb.minX;
    const placed = offsetProjectState(st, cursorXmm, 0);
    base.workspaceBoxes.push(...(placed.workspaceBoxes ?? []));
    base.extractedPartsByBoxId = {
      ...base.extractedPartsByBoxId,
      ...(placed.extractedPartsByBoxId ?? {}),
    };
    base.modelPositionsByBoxId = {
      ...base.modelPositionsByBoxId,
      ...(placed.modelPositionsByBoxId ?? {}),
    };
    cursorXmm += width + gapMm;
  }

  base.changelog = [
    {
      id: `merge-${Date.now()}`,
      type: "doc" as const,
      message: `Merge de ${ids.length} projeto(s) no workspace`,
      timestamp: new Date(),
    },
  ];

  return base;
}

/** Lê e remove a chave de merge pendente (sessionStorage). */
export function tryConsumePendingWorkspaceMergeIds(): string[] | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PIMO_PENDING_WORKSPACE_MERGE_IDS);
    if (!raw?.trim()) return null;
    sessionStorage.removeItem(PIMO_PENDING_WORKSPACE_MERGE_IDS);
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || !("ids" in parsed)) return null;
    const arr = (parsed as { ids: unknown }).ids;
    if (!Array.isArray(arr)) return null;
    const ids = arr
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean);
    return ids.length ? ids : null;
  } catch {
    return null;
  }
}
