/**
 * Purge SSOT industrial para projetos de produção (Antunes e similares).
 * Remove cutlist/furos/nesting persistidos; geometria workspace intacta.
 */

import type { ProjectState } from "../../context/projectTypes";
import type { SaveProjectRequest } from "../projects/types";
import {
  purgeIndustrialDrillingIfStale,
  type IndustrialDrillingPurgeReport,
} from "./industrialProjectDrillingPurge";
import { reviveState, serializeState } from "../../context/projectPersistence";
import {
  readOfflineProjects,
  writeOfflineProjects,
  type OfflineProjectRecord,
} from "../projects/projectsOfflineStore";

/** Clientes/projetos de produção — purge forçado ao abrir (inclui Antunes). */
const PRODUCTION_PROJECT_NAME_SUBSTRINGS = ["antunes"] as const;

export type IndustrialLoadPurgeResult = {
  state: ProjectState;
  purged: boolean;
  report?: IndustrialDrillingPurgeReport;
};

export type BatchProductionPurgeEntry = {
  projectId: string;
  projectName: string;
  purged: boolean;
  report?: IndustrialDrillingPurgeReport;
};

export type BatchProductionPurgeReport = {
  scanned: number;
  purged: number;
  skipped: number;
  entries: BatchProductionPurgeEntry[];
};

export function shouldForceIndustrialProductionPurge(projectName: string | undefined | null): boolean {
  const token = String(projectName ?? "").trim().toLowerCase();
  if (!token) return false;
  return PRODUCTION_PROJECT_NAME_SUBSTRINGS.some((sub) => token.includes(sub));
}

export function shouldForceIndustrialProductionPurgeFromState(state: ProjectState): boolean {
  if (shouldForceIndustrialProductionPurge(state.projectName)) return true;
  if (state.readyForProduction === true) return true;
  return false;
}

/**
 * Purge ao carregar projeto (ficheiro, autosave, merge).
 * Produção/Antunes: force=true (limpa industrialPieceEdits também).
 * Restantes: purge se SSOT desatualizado ou cache persistido.
 */
export function applyIndustrialLoadPurge(
  state: ProjectState,
  options?: { force?: boolean }
): IndustrialLoadPurgeResult {
  const force = options?.force === true || shouldForceIndustrialProductionPurgeFromState(state);
  const { state: nextState, purged, report } = purgeIndustrialDrillingIfStale(state, { force });
  return { state: nextState, purged, report };
}

function purgeSnapshotProjectState(
  snapshot: SaveProjectRequest["snapshot"],
  options?: { force?: boolean }
): { snapshot: SaveProjectRequest["snapshot"]; purged: boolean; report?: IndustrialDrillingPurgeReport } {
  if (!snapshot || typeof snapshot !== "object") {
    return { snapshot, purged: false };
  }
  const snapObj = snapshot as { projectState?: unknown };
  const restored = reviveState(snapObj.projectState);
  if (!restored) return { snapshot, purged: false };

  const { state, purged, report } = applyIndustrialLoadPurge(restored, options);
  if (!purged) return { snapshot, purged: false };

  return {
    snapshot: {
      ...(snapshot as object),
      projectState: serializeState(state),
    } as SaveProjectRequest["snapshot"],
    purged: true,
    report,
  };
}

/**
 * Percorre projetos offline e aplica purge SSOT.
 * Por defeito: purge em todos com SSOT stale; force em Antunes/produção.
 */
export function batchPurgeOfflineProductionProjects(options?: {
  /** Purge completo em todos os projetos (não só stale). */
  forceAll?: boolean;
  /** Só projectos cujo nome corresponde a produção/Antunes. */
  productionOnly?: boolean;
}): BatchProductionPurgeReport {
  const projects = readOfflineProjects();
  const entries: BatchProductionPurgeEntry[] = [];
  let purgedCount = 0;
  let skipped = 0;
  const nextProjects: OfflineProjectRecord[] = [];

  for (const project of projects) {
    if (project.deleted) {
      nextProjects.push(project);
      continue;
    }

    const production = shouldForceIndustrialProductionPurge(project.name);
    if (options?.productionOnly && !production) {
      skipped += 1;
      nextProjects.push(project);
      continue;
    }

    const force = options?.forceAll === true || production;
    const { snapshot, purged, report } = purgeSnapshotProjectState(project.snapshot, { force });

    if (purged) {
      purgedCount += 1;
      nextProjects.push({
        ...project,
        snapshot,
        updatedAt: new Date().toISOString(),
      });
      entries.push({
        projectId: project.id,
        projectName: project.name,
        purged: true,
        report,
      });
    } else {
      skipped += 1;
      nextProjects.push(project);
      entries.push({
        projectId: project.id,
        projectName: project.name,
        purged: false,
      });
    }
  }

  if (purgedCount > 0) {
    writeOfflineProjects(nextProjects);
  }

  return {
    scanned: projects.filter((p) => !p.deleted).length,
    purged: purgedCount,
    skipped,
    entries,
  };
}

/** Nesting V3 é sessão UI — não persistido no ProjectState; noop documentado. */
export function clearNestingV3SessionCache(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (/nesting.?v3/i.test(key)) sessionStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}
