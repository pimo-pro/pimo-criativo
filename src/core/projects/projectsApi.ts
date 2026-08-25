import type {
  PimoProjectData,
  RenameProjectRequest,
  SaveProjectRequest,
  SavedProjectMeta,
  SavedProjectRecord,
} from "./types";
import { buildApiUrl } from "../../config/api";
import { authHeaders, canUseRemoteProjectsApi } from "./remoteApiAuth";

/** Caminho da API no mesmo host da app (evita mistura de subdomínios e facilita staging). */
const PROJECTS_API_PATH = "/api/projects/index.php";

/**
 * Base da API de projetos: sempre o origin atual em browser (produção em pimo.pro, preview, etc.).
 * Não usar `process.env.NODE_ENV` aqui — polyfills no cliente podem marcar "development" por engano e
 * desativar POST/PUT/DELETE enquanto GET (outros módulos) continua a aparecer no Network.
 */
export function resolveProjectsApiBase(): string {
  return buildApiUrl(PROJECTS_API_PATH);
}

export function toJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

export function buildProjectsUrl(query?: URLSearchParams): string {
  const queryString = query && query.toString() ? `?${query.toString()}` : "";
  return `${resolveProjectsApiBase()}${queryString}`;
}

export type ProjectsApiDeps = {
  buildPimoProjectDataFromRequest: (_request: SaveProjectRequest) => PimoProjectData;
  asObject: (_value: unknown) => Record<string, unknown> | null;
  toMetaFromProjectData: (_project: PimoProjectData, _index: number) => SavedProjectMeta;
  toRecordFromProjectData: (_project: PimoProjectData) => SavedProjectRecord;
  nowIso: () => string;
};

function metaFromSaveResponse(
  row: Record<string, unknown>,
  deps: ProjectsApiDeps
): SavedProjectMeta | null {
  if ("sequence" in row || "ownerName" in row || "thumbnailDataUrl" in row) {
    return row as unknown as SavedProjectMeta;
  }
  if ("ownerId" in row && "viewerSnapshot" in row && "settings" in row) {
    return deps.toMetaFromProjectData(row as unknown as PimoProjectData, 0);
  }
  // Resposta mínima válida após POST (id + name).
  if (typeof row.id === "string" && row.id && typeof row.name === "string") {
    return {
      id: row.id,
      name: row.name,
      sequence: Number.isFinite(Number(row.sequence)) ? Number(row.sequence) : 1,
      createdAt: typeof row.createdAt === "string" ? row.createdAt : deps.nowIso(),
      updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : deps.nowIso(),
      ownerId: typeof row.ownerId === "string" ? row.ownerId : "usuario-local",
      ownerName:
        typeof row.ownerName === "string"
          ? row.ownerName
          : typeof row.ownerId === "string"
            ? row.ownerId
            : "Utilizador",
      thumbnailDataUrl:
        typeof row.thumbnailDataUrl === "string" || row.thumbnailDataUrl === null
          ? (row.thumbnailDataUrl as string | null)
          : null,
    };
  }
  return null;
}

export async function remoteSaveProject(
  request: SaveProjectRequest,
  deps: ProjectsApiDeps
): Promise<SavedProjectMeta | null> {
  if (!canUseRemoteProjectsApi()) {
    return null;
  }
  const projectData = deps.buildPimoProjectDataFromRequest(request);
  const response = await fetch(buildProjectsUrl(), {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(projectData),
  });
  const payload = (await toJson(response)) as {
    project?: unknown;
    status?: string;
    message?: string;
  } | null;
  if (!response.ok) {
    console.warn("[SYNC] remoteSaveProject HTTP", response.status, payload?.message ?? payload);
    return null;
  }
  const row = deps.asObject(payload?.project);
  if (!row) {
    console.warn("[SYNC] remoteSaveProject resposta sem project", payload);
    return null;
  }
  const meta = metaFromSaveResponse(row, deps);
  if (!meta) {
    console.warn("[SYNC] remoteSaveProject project sem campos reconhecidos", Object.keys(row));
  }
  return meta;
}

function mapRemoteProjectRows(rows: unknown[], deps: ProjectsApiDeps): SavedProjectMeta[] {
  return rows
    .map((item, index) => {
      const row = deps.asObject(item);
      if (!row) return null;
      if ("snapshot" in row || "ownerName" in row || "sequence" in row) {
        const id = typeof row.id === "string" ? row.id : "";
        const name = typeof row.name === "string" ? row.name : "Projeto";
        if (!id) return null;
        return {
          id,
          name,
          sequence: Number.isFinite(Number(row.sequence)) ? Number(row.sequence) : index + 1,
          createdAt: typeof row.createdAt === "string" ? row.createdAt : deps.nowIso(),
          updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : deps.nowIso(),
          ownerId: typeof row.ownerId === "string" ? row.ownerId : "usuario-local",
          ownerName:
            typeof row.ownerName === "string"
              ? row.ownerName
              : (typeof row.ownerId === "string" ? row.ownerId : "Utilizador"),
          thumbnailDataUrl:
            typeof row.thumbnailDataUrl === "string" || row.thumbnailDataUrl === null
              ? (row.thumbnailDataUrl as string | null)
              : null,
        } satisfies SavedProjectMeta;
      }
      if ("ownerId" in row && "viewerSnapshot" in row && "settings" in row) {
        return deps.toMetaFromProjectData(row as unknown as PimoProjectData, index);
      }
      return null;
    })
    .filter((v): v is SavedProjectMeta => Boolean(v));
}

async function fetchProjectListRows(
  url: string
): Promise<{ ok: boolean; rows: unknown[]; status: number }> {
  if (!canUseRemoteProjectsApi()) {
    return { ok: false, rows: [], status: 401 };
  }
  const response = await fetch(url, { headers: authHeaders() });
  const payload = (await toJson(response)) as { projects?: unknown[] } | null;
  const rows = Array.isArray(payload?.projects) ? payload.projects : [];
  return { ok: response.ok, rows, status: response.status };
}

export async function remoteListProjects(
  scope: "mine" | "all",
  ownerId: string | undefined,
  deps: ProjectsApiDeps
): Promise<SavedProjectMeta[]> {
  const params = new URLSearchParams({ scope });
  if (ownerId) params.set("ownerId", ownerId);
  const primary = await fetchProjectListRows(buildProjectsUrl(params));
  if (primary.ok) {
    return mapRemoteProjectRows(primary.rows, deps);
  }
  // Fallback: list.php (não depende de githubSync.php)
  const fallbackParams = new URLSearchParams({ scope });
  if (ownerId) fallbackParams.set("ownerId", ownerId);
  const fallbackUrl = `${buildApiUrl("/api/projects/list.php")}?${fallbackParams.toString()}`;
  const fallback = await fetchProjectListRows(fallbackUrl);
  if (!fallback.ok) {
    console.warn("[SYNC] listSavedProjects falhou", {
      indexStatus: primary.status,
      listStatus: fallback.status,
    });
    return [];
  }
  console.warn("[SYNC] listSavedProjects via list.php (index.php indisponível)", {
    indexStatus: primary.status,
  });
  return mapRemoteProjectRows(fallback.rows, deps);
}

/** Lista apenas projectos com ficheiro {nome}.json (páginas PROJETOS). */
export async function remoteListProjetosPageProjects(
  scope: "mine" | "all",
  ownerId: string | undefined,
  deps: ProjectsApiDeps
): Promise<SavedProjectMeta[]> {
  if (!canUseRemoteProjectsApi()) return [];
  const params = new URLSearchParams({ action: "projetos", scope });
  if (ownerId) params.set("ownerId", ownerId);
  const response = await fetch(buildProjectsUrl(params), { headers: authHeaders() });
  if (!response.ok) return [];
  const payload = (await toJson(response)) as { projects?: unknown[] } | null;
  const rows = Array.isArray(payload?.projects) ? payload.projects : [];
  return mapRemoteProjectRows(rows, deps);
}

export async function remoteLoadProjectRecord(
  id: string,
  deps: ProjectsApiDeps
): Promise<SavedProjectRecord | null> {
  if (!canUseRemoteProjectsApi()) return null;
  const params = new URLSearchParams({ action: "load", id });
  const response = await fetch(buildProjectsUrl(params), { headers: authHeaders() });
  if (!response.ok) return null;
  const payload = (await toJson(response)) as { project?: unknown } | null;
  const row = deps.asObject(payload?.project);
  if (!row) return null;
  if ("snapshot" in row) {
    return row as unknown as SavedProjectRecord;
  }
  if ("ownerId" in row && "viewerSnapshot" in row && "settings" in row) {
    return deps.toRecordFromProjectData(row as unknown as PimoProjectData);
  }
  return null;
}

export async function remoteRenameProject(
  id: string,
  body: RenameProjectRequest
): Promise<boolean> {
  if (!canUseRemoteProjectsApi()) return false;
  const params = new URLSearchParams({ action: "update", id });
  const response = await fetch(buildProjectsUrl(params), {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  return response.ok;
}

export async function remoteDeleteProject(id: string): Promise<boolean> {
  if (!canUseRemoteProjectsApi()) return false;
  const params = new URLSearchParams({ action: "delete", id });
  const response = await fetch(buildProjectsUrl(params), {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (response.status === 404) {
    console.log("[SYNC] Ignorando 404 ao deletar projeto inexistente");
    return true;
  }
  return response.ok;
}
