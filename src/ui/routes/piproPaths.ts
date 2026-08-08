/**
 * Paths públicos/admin pipro — só constantes (sem import de páginas).
 * Evita ciclos TDZ no bundle (Cannot access before initialization).
 */

export const PIPRO_MODELS_PUBLIC_PATH = "/moveis";
export const PIPRO_WORKSPACE_PATH = "/admin/pipro/workspace";
export const PIPRO_WORKSPACE_NEW_PATH = PIPRO_WORKSPACE_PATH;

export function piproWorkspaceEditPath(modelId: string): string {
  return `${PIPRO_WORKSPACE_PATH}?id=${encodeURIComponent(modelId)}`;
}
