/**
 * Paths públicos/admin pipro — só constantes (sem import de páginas).
 * Evita ciclos TDZ no bundle (Cannot access before initialization).
 */

export const PIPRO_MODELS_PUBLIC_PATH = "/moveis";
export const PIPRO_WORKSPACE_PATH = "/admin/pipro/workspace";
/** Shell LegacyApp adaptado a modelos pipro (v2) — cutover futuro para PIPRO_WORKSPACE_PATH. */
export const PIPRO_WORKSPACE_V2_PATH = "/admin/pipro/workspace2";
export const PIPRO_WORKSPACE_NEW_PATH = PIPRO_WORKSPACE_PATH;

export function piproWorkspaceEditPath(modelId: string): string {
  return `${PIPRO_WORKSPACE_PATH}?id=${encodeURIComponent(modelId)}`;
}

export function piproWorkspaceV2EditPath(modelId: string): string {
  return `${PIPRO_WORKSPACE_V2_PATH}?id=${encodeURIComponent(modelId)}`;
}
