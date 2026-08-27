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
/** Espera máxima antes do redirect após «Gerar arquivo completo». */
export const PRODUCTION_RELEASE_REDIRECT_BUDGET_MS = 3000;
/** Limite prático do fetch keepalive (Chrome ~64KB); acima disso não usamos keepalive. */
export const PRODUCTION_RELEASE_KEEPALIVE_MAX_BYTES = 60_000;

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

function uniqueKeys(keys: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of keys) {
    const key = String(raw ?? "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/** Chaves com que o outbox pode ser encontrado na leitura (Relatório / drain). */
export function buildProductionReleaseMatchKeys(
  projectId: string,
  release: ProductionRelease,
  aliasKeys: readonly string[] = []
): string[] {
  return uniqueKeys([
    projectId,
    release.projectId,
    ...aliasKeys,
    ...resolveLoadKeys(projectId),
    ...aliasKeys.flatMap((k) => resolveLoadKeys(k)),
  ]);
}

export function outboxMatchesProjectKey(
  outbox: ProductionReleaseOutboxItem,
  readKey: string
): boolean {
  const id = String(readKey ?? "").trim();
  if (!id) return false;
  const readKeys = new Set(uniqueKeys([id, ...resolveLoadKeys(id)]));
  const candidates = uniqueKeys([
    outbox.projectId,
    outbox.release?.projectId,
    ...(outbox.matchKeys ?? []),
    ...resolveLoadKeys(outbox.projectId),
  ]);
  for (const c of candidates) {
    if (readKeys.has(c)) return true;
  }
  return false;
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

  const body = JSON.stringify(merged);
  const useKeepalive =
    typeof body === "string" &&
    body.length > 0 &&
    body.length <= PRODUCTION_RELEASE_KEEPALIVE_MAX_BYTES;

  const response = await fetch(buildProjectsUrl(), {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body,
    ...(useKeepalive ? { keepalive: true } : {}),
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
  /** Slug / nome / ids — para match na leitura sem depender só do pimo-id. */
  matchKeys?: string[];
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
    const matchKeysRaw = Array.isArray(obj.matchKeys) ? obj.matchKeys : [];
    const matchKeys = uniqueKeys(
      matchKeysRaw.map((k) => (typeof k === "string" ? k : ""))
    );
    const release = obj.release as ProductionRelease;
    return {
      projectId,
      release,
      matchKeys:
        matchKeys.length > 0
          ? matchKeys
          : buildProductionReleaseMatchKeys(projectId, release),
    };
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
 * Usado pelo drain após redirect (e retries em background).
 */
export function scheduleProductionReleasePersist(
  projectId: string,
  release: ProductionRelease,
  deps: {
    saveRelease?: typeof saveProductionRelease;
    showToast?: PersistToast;
    aliasKeys?: readonly string[];
  } = {}
): void {
  const saveRelease = deps.saveRelease ?? saveProductionRelease;
  writeOutbox({
    projectId,
    release,
    matchKeys: buildProductionReleaseMatchKeys(projectId, release, deps.aliasKeys ?? []),
  });
  void saveRelease(projectId, release)
    .then(() => {
      clearOutbox();
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      deps.showToast?.(`${PERSIST_FAIL_TOAST} ${msg}`, "warning");
    });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Grava outbox, tenta o POST até `budgetMs`, depois devolve (redirect seguro).
 * Se ainda estiver a correr, o outbox + drain / keepalive cobrem o resto.
 * Em timeout NÃO mostra toast bloqueante — só avisa se a gravação falhar depois.
 */
export async function persistProductionReleaseBeforeRedirect(
  projectId: string,
  release: ProductionRelease,
  deps: {
    saveRelease?: typeof saveProductionRelease;
    showToast?: PersistToast;
    aliasKeys?: readonly string[];
    budgetMs?: number;
  } = {}
): Promise<void> {
  const saveRelease = deps.saveRelease ?? saveProductionRelease;
  const budgetMs = deps.budgetMs ?? PRODUCTION_RELEASE_REDIRECT_BUDGET_MS;
  writeOutbox({
    projectId,
    release,
    matchKeys: buildProductionReleaseMatchKeys(projectId, release, deps.aliasKeys ?? []),
  });

  const savePromise = saveRelease(projectId, release).then(() => {
    clearOutbox();
  });

  const outcome = await Promise.race([
    savePromise.then(
      () => ({ kind: "ok" as const }),
      (err: unknown) => ({ kind: "error" as const, err })
    ),
    delay(budgetMs).then(() => ({ kind: "timeout" as const })),
  ]);

  if (outcome.kind === "ok") return;

  if (outcome.kind === "error") {
    const msg = outcome.err instanceof Error ? outcome.err.message : String(outcome.err);
    deps.showToast?.(`${PERSIST_FAIL_TOAST} ${msg}`, "warning");
    return;
  }

  // Timeout: não falha o fluxo; deixa outbox e avisa só se a gravação falhar depois.
  void savePromise.catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    deps.showToast?.(`${PERSIST_FAIL_TOAST} ${msg}`, "warning");
  });
}

/** Retry após reload (ToastProvider). Também fire-and-forget. */
export function drainProductionReleaseOutbox(showToast?: PersistToast): void {
  const item = readOutbox();
  if (!item) return;
  scheduleProductionReleasePersist(item.projectId, item.release, {
    showToast,
    aliasKeys: item.matchKeys,
  });
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
  if (outboxMatchesProjectKey(outbox, id)) {
    return outbox.release;
  }
  return null;
}
