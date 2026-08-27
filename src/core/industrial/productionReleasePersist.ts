/**
 * Persistência de settings.productionRelease no JSON do projeto remoto.
 * GET completo → funde só essa chave → POST. Não apaga settings.projectReport.
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
import { authHeaders, canUseRemoteProjectsApi } from "../projects/remoteApiAuth";
import { resolveProjectIdentity } from "../projects/projectIdentity";
import type { PimoProjectData } from "../projects/types";
import {
  isProductionRelease,
  type ProductionRelease,
} from "./productionRelease";

export const PRODUCTION_RELEASE_OUTBOX_KEY = "pimo.productionRelease.outbox";

const projectsApiDeps: ProjectsApiDeps = {
  buildPimoProjectDataFromRequest,
  asObject,
  toMetaFromProjectData,
  toRecordFromProjectData,
  nowIso,
};

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
      if (record && asObject(record as unknown as Record<string, unknown>)) {
        const row = record as unknown as Record<string, unknown>;
        if ("settings" in row && "ownerId" in row) {
          return row as unknown as PimoProjectData;
        }
      }
    } catch (err) {
      console.warn("[pimo] Falha ao carregar projeto remoto para productionRelease:", key, err);
    }
  }
  return null;
}

export function extractProductionReleaseFromPimoData(
  project: PimoProjectData | Record<string, unknown> | null | undefined
): ProductionRelease | null {
  if (!project) return null;
  const settings = asObject(project.settings);
  const raw = settings?.productionRelease;
  return isProductionRelease(raw) ? raw : null;
}

export async function saveProductionRelease(
  projectId: string,
  release: ProductionRelease
): Promise<void> {
  const id = String(projectId ?? "").trim();
  if (!id) throw new Error("projectId em falta para gravar o snapshot da geração.");
  if (!isProductionRelease(release)) {
    throw new Error("productionRelease inválido.");
  }
  if (!canUseRemoteProjectsApi()) {
    throw new Error(
      "Sessão remota indisponível. Inicie sessão para gravar o snapshot da geração no servidor."
    );
  }

  const existing = await loadRemoteProjectData(id);
  if (!existing) {
    throw new Error(
      "Projeto remoto não encontrado. Não é possível gravar o snapshot da geração sem o projeto no servidor."
    );
  }

  const prevSettings = asObject(existing.settings) ?? {};
  const merged: PimoProjectData = {
    ...existing,
    settings: {
      ...prevSettings,
      productionRelease: release,
    },
    updatedAt: new Date().toISOString(),
  };

  const response = await fetch(buildProjectsUrl(), {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(merged),
  });
  const payload = (await toJson(response)) as {
    status?: string;
    message?: string;
  } | null;
  if (!response.ok) {
    throw new Error(
      payload?.message || `Falha ao gravar o snapshot da geração (HTTP ${response.status}).`
    );
  }
}

export type ProductionReleaseOutboxItem = {
  projectId: string;
  release: ProductionRelease;
};

function readOutbox(): ProductionReleaseOutboxItem | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(PRODUCTION_RELEASE_OUTBOX_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    const obj = asObject(parsed);
    if (!obj) return null;
    const projectId = typeof obj.projectId === "string" ? obj.projectId.trim() : "";
    if (!projectId || !isProductionRelease(obj.release)) return null;
    return { projectId, release: obj.release };
  } catch {
    return null;
  }
}

function writeOutbox(item: ProductionReleaseOutboxItem): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(PRODUCTION_RELEASE_OUTBOX_KEY, JSON.stringify(item));
  } catch {
    /* quota — o POST em background ainda tenta */
  }
}

function clearOutbox(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(PRODUCTION_RELEASE_OUTBOX_KEY);
  } catch {
    /* ignore */
  }
}

export type PersistToast = (_text: string, _type?: "error" | "warning" | "info" | "success") => void;

const PERSIST_FAIL_TOAST =
  "ZIP gerado, mas o snapshot da geração não ficou gravado no servidor.";

/**
 * Grava outbox já; dispara o POST sem await.
 * Usado pela cauda de sucesso e pelo drain após redirect.
 */
export function scheduleProductionReleasePersist(
  projectId: string,
  release: ProductionRelease,
  deps: {
    saveRelease?: typeof saveProductionRelease;
    showToast?: PersistToast;
  } = {}
): void {
  const saveRelease = deps.saveRelease ?? saveProductionRelease;
  writeOutbox({ projectId, release });
  void saveRelease(projectId, release)
    .then(() => {
      clearOutbox();
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      deps.showToast?.(`${PERSIST_FAIL_TOAST} ${msg}`, "warning");
    });
}

/** Retry após reload (ToastProvider). Também fire-and-forget. */
export function drainProductionReleaseOutbox(showToast?: PersistToast): void {
  const item = readOutbox();
  if (!item) return;
  scheduleProductionReleasePersist(item.projectId, item.release, { showToast });
}

export function peekProductionReleaseOutbox(): ProductionReleaseOutboxItem | null {
  return readOutbox();
}

/** Relatório F1: remoto primeiro; outbox se o POST do F0 ainda não chegou. */
export async function loadProductionRelease(
  projectId: string
): Promise<ProductionRelease | null> {
  const id = String(projectId ?? "").trim();
  if (!id) return null;
  try {
    const remote = await loadRemoteProjectData(id);
    const fromRemote = extractProductionReleaseFromPimoData(remote);
    if (fromRemote) return fromRemote;
  } catch {
    /* fallback outbox */
  }
  const outbox = peekProductionReleaseOutbox();
  if (!outbox) return null;
  const keys = resolveLoadKeys(id);
  if (outbox.projectId === id || keys.includes(outbox.projectId)) {
    return outbox.release;
  }
  return null;
}
