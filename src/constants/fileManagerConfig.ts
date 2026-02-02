/**
 * Configuração do Gestor de Ficheiros.
 * Pastas e ficheiros exibidos ao abrir; regras de visibilidade e bloqueio.
 */

export const FILE_MANAGER_VISIBLE_ITEMS = [
  { path: "textures/", type: "folder" },
  { path: "public_html/", type: "folder" },
  { path: "home/", type: "folder" },
  { path: "hdr/", type: "folder" },
  { path: "assets/", type: "folder" },
  { path: ".trash", type: "folder", hidden: true },
  { path: "index.html", type: "file" },
  { path: "DO_NOT_UPLOAD_HERE", type: "file" },
  { path: ".htaccess", type: "file", hidden: true },
  { path: ".ftp-deploy-sync-state.json", type: "file", hidden: true },
] as const;

export const FILE_MANAGER_HIDDEN_BY_DEFAULT = true;

/** Extensões bloqueadas para upload (ex: .php) */
export const FILE_MANAGER_BLOCKED_EXTENSIONS = [".php", ".phtml", ".php3", ".php4", ".php5"];

export function isUploadBlocked(filename: string): boolean {
  const lower = filename.toLowerCase();
  return FILE_MANAGER_BLOCKED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
