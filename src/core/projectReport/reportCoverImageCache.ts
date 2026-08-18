/**
 * Última captura HQ do Viewer para o PDF do Relatório Final.
 * Em memória da sessão — não altera o documento do relatório nem pipelines industriais.
 */

const coversByProject = new Map<string, string>();

function normalizeKey(projectKey: string): string {
  return String(projectKey ?? "").trim();
}

export function setReportCoverImage(projectKey: string, dataUrl: string): void {
  const key = normalizeKey(projectKey);
  const url = String(dataUrl ?? "").trim();
  if (!key || !url.startsWith("data:image/")) return;
  coversByProject.set(key, url);
}

export function getReportCoverImage(projectKey: string): string | null {
  const key = normalizeKey(projectKey);
  if (!key) return null;
  return coversByProject.get(key) ?? null;
}

export function resolveReportCoverImage(projectKeys: Array<string | null | undefined>): string | null {
  for (const raw of projectKeys) {
    const key = normalizeKey(String(raw ?? ""));
    if (!key) continue;
    const hit = coversByProject.get(key);
    if (hit) return hit;
  }
  return null;
}
