/**
 * Full Local Development Access — capabilities no cliente.
 * Só activo em runtime local-dev. Nunca em staging/production builds.
 */

import { ALL_KNOWN_PERMISSIONS } from "../../auth/permissionsMap";
import { isFullLocalDevelopmentAccessEnabled } from "./pimoEnvironment";

/** Permissões efectivas para sessão de desenvolvimento local. */
export function getLocalDevelopmentPermissions(): string[] {
  if (!isFullLocalDevelopmentAccessEnabled()) {
    return [];
  }
  return [...ALL_KNOWN_PERMISSIONS];
}

/**
 * Gate de permissão com full local access.
 * `baseHas` = check da lista de permissões da sessão.
 */
export function hasPermissionWithLocalDevAccess(
  permission: string,
  baseHas: (permission: string) => boolean,
  opts?: { localDevSessionActive?: boolean }
): boolean {
  if (
    isFullLocalDevelopmentAccessEnabled() &&
    opts?.localDevSessionActive === true
  ) {
    return true;
  }
  return baseHas(permission);
}
