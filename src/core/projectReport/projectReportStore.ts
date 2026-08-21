/**
 * Persistência do Relatório Final no projeto remoto (servidor).
 * - Load: settings.projectReport do servidor; localStorage só como fallback visual de migração.
 * - Save: GET projeto completo → funde só settings.projectReport → POST (resto intacto).
 * - Nunca escreve em localStorage; nunca faz upload automático no load.
 */

import {
  buildProjectsUrl,
  remoteLoadProjectRecord,
  toJson,
  type ProjectsApiDeps,
} from "../projects/projectsApi";
import {
  asObject,
  buildPimoProjectDataFromRequest,
  nowIso,
  toMetaFromProjectData,
  toRecordFromProjectData,
} from "../projects/projectsMappers";
import { resolveProjectIdentity } from "../projects/projectIdentity";
import type { PimoProjectData } from "../projects/types";
import { withDerivedMetricas } from "./deriveMetricas";
import { migrateProjectReport } from "./migrateReport";
import { recalcFinanceiro } from "./financeReportCalc";
import {
  emptyGerais,
  emptyQualidade,
  PROJECT_REPORT_STORAGE_KEY,
  PROJECT_REPORT_VERSION,
  type ProjectReport,
  type ReportStyle,
} from "./types";

const projectsApiDeps: ProjectsApiDeps = {
  buildPimoProjectDataFromRequest,
  asObject,
  toMetaFromProjectData,
  toRecordFromProjectData,
  nowIso,
};

function normalizeReport(raw: ProjectReport): ProjectReport {
  const migrated = migrateProjectReport(raw);
  const ratingRaw = Number(migrated.qualidade?.rating);
  const rating =
    ratingRaw >= 1 && ratingRaw <= 5 ? (Math.round(ratingRaw) as 1 | 2 | 3 | 4 | 5) : 3;

  const base: ProjectReport = {
    ...migrated,
    version: PROJECT_REPORT_VERSION,
    reportStyle: migrated.reportStyle === "cards" ? "cards" : "classic",
    gerais: { ...emptyGerais(), ...(migrated.gerais ?? {}) },
    manualPaths: Array.isArray(migrated.manualPaths) ? migrated.manualPaths : [],
    history: Array.isArray(migrated.history) ? migrated.history : [],
    notas: Array.isArray(migrated.notas) ? migrated.notas : [],
    qualidade: {
      rating,
      observacoes: Array.isArray(migrated.qualidade?.observacoes)
        ? migrated.qualidade.observacoes.map(String)
        : [],
    },
    financeiro: recalcFinanceiro(
      migrated.financeiro ?? {
        ivaPct: 23,
        linhas: [],
        subtotal: 0,
        ivaValor: 0,
        totalProjeto: 0,
      }
    ),
  };
  return withDerivedMetricas(base);
}

function isProjectReportLike(value: unknown): value is ProjectReport {
  const obj = asObject(value);
  if (!obj) return false;
  return typeof obj.projectId === "string" || typeof obj.version === "number";
}

/** Extrai settings.projectReport de um PimoProjectData. */
export function extractProjectReportFromPimoData(
  project: PimoProjectData | Record<string, unknown> | null | undefined
): ProjectReport | null {
  if (!project) return null;
  const settings = asObject(project.settings);
  const raw = settings?.projectReport;
  if (!isProjectReportLike(raw)) return null;
  return normalizeReport(raw);
}

/**
 * Só leitura de migração (dispositivo pessoal).
 * Nunca escrever; nunca preferir face a dados do servidor.
 */
function readMigrationReportFromLocalStorage(projectId: string): ProjectReport | null {
  if (typeof localStorage === "undefined") return null;
  const id = projectId.trim();
  if (!id) return null;
  try {
    const raw = localStorage.getItem(PROJECT_REPORT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const map = parsed as Record<string, ProjectReport>;
    const found = map[id];
    return found ? normalizeReport(found) : null;
  } catch {
    return null;
  }
}

function resolveLoadKeys(urlKey: string): string[] {
  const identity = resolveProjectIdentity(urlKey);
  const keys = [
    urlKey,
    identity?.remoteId,
    identity?.persistenceId,
    identity?.slug,
    identity?.localId,
  ].filter((k): k is string => Boolean(k && String(k).trim()));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const key of keys) {
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

async function loadRemoteProjectData(projectKey: string): Promise<PimoProjectData | null> {
  for (const key of resolveLoadKeys(projectKey)) {
    try {
      const record = await remoteLoadProjectRecord(key, projectsApiDeps);
      if (record?.projectData) return record.projectData;
      // load pode devolver só snapshot — tentar settings no projectData ausente
      if (record && asObject(record as unknown as Record<string, unknown>)) {
        const row = record as unknown as Record<string, unknown>;
        if ("settings" in row && "ownerId" in row) {
          return row as unknown as PimoProjectData;
        }
      }
    } catch (err) {
      console.warn("[pimo] Falha ao carregar projeto remoto para relatório:", key, err);
    }
  }
  return null;
}

/**
 * Carrega o relatório: servidor primeiro; localStorage só se o servidor não tiver report.
 */
export async function loadProjectReport(projectId: string): Promise<ProjectReport | null> {
  const id = projectId.trim();
  if (!id) return null;

  const remote = await loadRemoteProjectData(id);
  if (remote) {
    const fromServer = extractProjectReportFromPimoData(remote);
    if (fromServer) return fromServer;
  }

  // Fallback visual de migração — não sobe para o servidor automaticamente.
  for (const key of resolveLoadKeys(id)) {
    const migrated = readMigrationReportFromLocalStorage(key);
    if (migrated) return migrated;
  }
  return null;
}

/**
 * Guarda o relatório no servidor: GET completo → funde settings.projectReport → POST.
 * Não escreve localStorage. Não cria projeto vazio.
 */
export async function saveProjectReport(report: ProjectReport): Promise<ProjectReport> {
  const id = report.projectId.trim();
  if (!id) throw new Error("projectId em falta no relatório.");

  const next: ProjectReport = normalizeReport({
    ...report,
    projectId: id,
    updatedAt: new Date().toISOString(),
  });

  const existing = await loadRemoteProjectData(id);
  if (!existing) {
    throw new Error(
      "Projeto remoto não encontrado. Não é possível guardar o relatório sem o projeto no servidor."
    );
  }

  const prevSettings = asObject(existing.settings) ?? {};
  const merged: PimoProjectData = {
    ...existing,
    settings: {
      ...prevSettings,
      projectReport: next,
    },
    updatedAt: new Date().toISOString(),
  };

  const response = await fetch(buildProjectsUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(merged),
  });
  const payload = (await toJson(response)) as {
    status?: string;
    message?: string;
    project?: unknown;
  } | null;

  if (!response.ok) {
    throw new Error(
      payload?.message || `Falha ao guardar relatório no servidor (HTTP ${response.status}).`
    );
  }

  const savedRow = asObject(payload?.project);
  const savedReport = savedRow
    ? extractProjectReportFromPimoData(savedRow as unknown as PimoProjectData)
    : null;
  return savedReport ?? next;
}

export function markManualPath(report: ProjectReport, path: string): ProjectReport {
  if (report.manualPaths.includes(path)) return report;
  return { ...report, manualPaths: [...report.manualPaths, path] };
}

export function isManualPath(report: ProjectReport, path: string): boolean {
  return (
    report.manualPaths.includes(path) ||
    report.manualPaths.some((p) => path.startsWith(`${p}.`))
  );
}

export function setReportStyle(report: ProjectReport, style: ReportStyle): ProjectReport {
  return markManualPath({ ...report, reportStyle: style }, "reportStyle");
}

export function ensureReportExtras(report: ProjectReport): ProjectReport {
  return {
    ...report,
    history: report.history ?? [],
    notas: report.notas ?? [],
    qualidade: report.qualidade ?? emptyQualidade(),
  };
}
