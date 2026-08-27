import { useEffect, useState } from "react";

import { buildApiUrl } from "../../config/api";
import type { ViewerRenderOptions, ViewerRenderResult } from "../../context/projectTypes";

import { buildProjectsUrl } from "./projectsApi";
import { authHeaders, canUseRemoteProjectsApi } from "./remoteApiAuth";

const THUMBS_BASE = "/api/projects/thumbs";
/** Mínimo para considerar uma imagem gerada válida (evita POST vazio). */
const MIN_THUMB_BYTES = 64;

export type ProjectThumbnailRenderScene = (
  options: ViewerRenderOptions
) => Promise<ViewerRenderResult | null>;

/** Alinhado a coerce_safe_filename no PHP — nunca envia name vazio/ilegal. */
export function coerceSafeProjectThumbName(projectName: string): string | null {
  let name = String(projectName ?? "").trim();
  if (!name) return null;
  name = name.replace(/\.\./g, "");
  name = name.replace(/[\/\\<>:"|?*\x00]+/g, "_").replace(/^[.\s_]+|[.\s_]+$/g, "");
  if (!name) return null;
  if (name.length > 160) name = name.slice(0, 160).trim();
  return name || null;
}

function safeProjectFileName(projectName: string): string {
  return coerceSafeProjectThumbName(projectName) ?? "";
}

export function buildProjectThumbnailPath(projectName: string, ext: "webp" | "jpg" = "jpg"): string {
  const name = safeProjectFileName(projectName);
  return `${THUMBS_BASE}/${encodeURIComponent(name)}.${ext}`;
}

/**
 * Resolução síncrona: só data URLs / URLs absolutas já utilizáveis em <img>.
 * Paths `/api/projects/thumbs/...` NÃO são devolvidos aqui — exigem Bearer (ver hook B1).
 */
export function resolveProjectThumbnailSrc(
  projectName: string,
  thumbnailDataUrl?: string | null,
  cacheKey?: string
): string | null {
  const trimmed = typeof thumbnailDataUrl === "string" ? thumbnailDataUrl.trim() : "";
  if (trimmed) {
    if (trimmed.startsWith("data:") || /^https?:\/\//i.test(trimmed) || trimmed.startsWith("blob:")) {
      const withCache =
        cacheKey && !trimmed.startsWith("data:") && !trimmed.startsWith("blob:") && !trimmed.includes("?")
          ? `${trimmed}?v=${encodeURIComponent(cacheKey)}`
          : trimmed;
      return withCache;
    }
    if (trimmed.startsWith("/") && !trimmed.includes("/api/projects/thumbs")) {
      const withCache =
        cacheKey && !trimmed.includes("?")
          ? `${trimmed}?v=${encodeURIComponent(cacheKey)}`
          : trimmed;
      return buildApiUrl(withCache);
    }
    // Path de thumbs API — não usar directamente em <img> (sem Authorization).
  }

  void projectName;
  return null;
}

/** Fetch autenticado de `/api/projects/thumbs/...` → blob URL (revogar no cleanup do caller). */
export async function fetchAuthenticatedThumbnailBlobUrl(
  projectName: string,
  cacheKey?: string
): Promise<string | null> {
  if (!canUseRemoteProjectsApi()) return null;
  const name = safeProjectFileName(projectName);
  if (!name) return null;

  const tryExt = async (ext: "jpg" | "webp"): Promise<string | null> => {
    const path = buildProjectThumbnailPath(name, ext);
    const suffix = cacheKey ? `?v=${encodeURIComponent(cacheKey)}` : "";
    const url = `${buildApiUrl(path)}${suffix}`;
    try {
      const response = await fetch(url, { headers: authHeaders(), method: "GET" });
      if (!response.ok) return null;
      const contentType = String(response.headers.get("content-type") || "").toLowerCase();
      if (contentType.includes("application/json")) return null;
      const blob = await response.blob();
      if (!isValidThumbnailBlob(blob)) return null;
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  };

  return (await tryExt("jpg")) ?? (await tryExt("webp"));
}

/**
 * Hook B1: preferir thumbnailDataUrl; senão fetch com Bearer → blob URL.
 * Placeholder (null) em falha pontual — sem erros ruidosos.
 */
export function useAuthenticatedProjectThumbnailSrc(
  projectName: string,
  thumbnailDataUrl?: string | null,
  cacheKey?: string
): string | null {
  const syncSrc = resolveProjectThumbnailSrc(projectName, thumbnailDataUrl, cacheKey);
  const [blobSrc, setBlobSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    if (syncSrc) {
      setBlobSrc(null);
      return;
    }
    if (!canUseRemoteProjectsApi()) {
      setBlobSrc(null);
      return;
    }

    void fetchAuthenticatedThumbnailBlobUrl(projectName, cacheKey).then((url) => {
      if (cancelled) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      createdUrl = url;
      setBlobSrc(url);
    });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [projectName, thumbnailDataUrl, cacheKey, syncSrc]);

  return syncSrc ?? blobSrc;
}

export function isValidThumbnailBlob(blob: Blob | null | undefined): blob is Blob {
  if (!blob || typeof blob.size !== "number") return false;
  if (blob.size < MIN_THUMB_BYTES) return false;
  const type = String(blob.type || "").toLowerCase();
  if (type && !type.startsWith("image/")) return false;
  return true;
}

export function isValidThumbnailDataUrl(dataUrl: string | null | undefined): boolean {
  if (typeof dataUrl !== "string") return false;
  const trimmed = dataUrl.trim();
  if (!trimmed.startsWith("data:image/")) return false;
  const comma = trimmed.indexOf(",");
  if (comma < 0) return false;
  const b64 = trimmed.slice(comma + 1).trim();
  // ~base64 de pelo menos MIN_THUMB_BYTES
  return b64.length >= Math.ceil((MIN_THUMB_BYTES * 4) / 3);
}

export async function projectThumbnailExists(
  projectName: string
): Promise<{ exists: boolean; url: string | null }> {
  const name = coerceSafeProjectThumbName(projectName);
  if (!name) return { exists: false, url: null };
  if (!canUseRemoteProjectsApi()) return { exists: false, url: null };

  const params = new URLSearchParams({ action: "thumb", name });
  try {
    const response = await fetch(buildProjectsUrl(params), {
      method: "HEAD",
      headers: authHeaders(),
    });
    if (response.ok) {
      return {
        exists: true,
        url: buildApiUrl(buildProjectThumbnailPath(name)),
      };
    }
    const getResponse = await fetch(buildProjectsUrl(params), {
      headers: authHeaders(),
    });
    if (!getResponse.ok) return { exists: false, url: null };
    const payload = (await getResponse.json()) as { exists?: boolean; url?: string };
    const url = typeof payload.url === "string" ? payload.url : null;
    return {
      exists: Boolean(payload.exists),
      url: url ? (url.startsWith("/") ? buildApiUrl(url) : url) : null,
    };
  } catch {
    return { exists: false, url: null };
  }
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob | null> {
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return isValidThumbnailBlob(blob) ? blob : null;
  } catch {
    return null;
  }
}

async function blobToDataUrl(blob: Blob): Promise<string | null> {
  try {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function captureWorkspaceProjectThumbnail(
  renderScene: ProjectThumbnailRenderScene
): Promise<Blob | null> {
  const result = await renderScene({
    size: "medium",
    mode: "pbr",
    background: "project-transparent",
    preset: "iso1",
    format: "jpg",
    quality: 0.92,
    advancedRealism: true,
    watermark: false,
  });
  if (!result?.dataUrl || !isValidThumbnailDataUrl(result.dataUrl)) return null;
  return dataUrlToBlob(result.dataUrl);
}

/**
 * Upload de thumbnail só com imagem válida.
 * Preferência: JSON dataUrl (evita multipart vazio em proxies); fallback multipart.
 */
export async function uploadProjectThumbnail(
  projectName: string,
  blob: Blob
): Promise<string | null> {
  const name = coerceSafeProjectThumbName(projectName);
  if (!name || !isValidThumbnailBlob(blob)) return null;
  if (!canUseRemoteProjectsApi()) return null;

  const ext = blob.type.includes("webp") ? "webp" : "jpg";
  const params = new URLSearchParams({ action: "thumb", name });

  const parseUrl = async (response: Response): Promise<string | null> => {
    const payload = (await response.json().catch(() => null)) as
      | { url?: string; status?: string; message?: string }
      | null;
    if (!response.ok) return null;
    const url = typeof payload?.url === "string" ? payload.url : buildProjectThumbnailPath(name, ext);
    return url.startsWith("/") ? buildApiUrl(url) : url;
  };

  try {
    const dataUrl = await blobToDataUrl(blob);
    if (!dataUrl || !isValidThumbnailDataUrl(dataUrl)) return null;

    // Caminho principal: JSON com dataUrl (payload explícito, sem ficheiro vazio)
    const jsonResponse = await fetch(buildProjectsUrl(params), {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json; charset=utf-8" }),
      body: JSON.stringify({ name, dataUrl, mime: blob.type || "image/jpeg" }),
    });
    if (jsonResponse.ok) {
      return parseUrl(jsonResponse);
    }

    // Fallback multipart só se o JSON falhar (ex.: limite de body)
    const form = new FormData();
    form.append("name", name);
    form.append("file", blob, `${name}.${ext}`);
    const multipartResponse = await fetch(buildProjectsUrl(params), {
      method: "POST",
      headers: authHeaders(),
      body: form,
    });
    return parseUrl(multipartResponse);
  } catch {
    return null;
  }
}

export async function ensureProjectThumbnailUploaded(
  projectName: string,
  blob: Blob
): Promise<string | null> {
  if (!isValidThumbnailBlob(blob)) return null;
  if (!canUseRemoteProjectsApi()) return null;
  const existing = await projectThumbnailExists(projectName);
  if (existing.exists) return existing.url;
  return uploadProjectThumbnail(projectName, blob);
}
