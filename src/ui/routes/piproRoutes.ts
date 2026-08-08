/**
 * Rotas públicas da biblioteca pipro (móveis).
 * Paths em piproPaths — sem import de páginas (evita ciclo PiproModelsPage ↔ routes).
 */

import {
  PIPRO_MODELS_PUBLIC_PATH,
  PIPRO_WORKSPACE_NEW_PATH,
  PIPRO_WORKSPACE_PATH,
  piproWorkspaceEditPath,
} from "./piproPaths";

export type PiproPublicRoute = {
  path: string;
  label: string;
};

export {
  PIPRO_MODELS_PUBLIC_PATH,
  PIPRO_WORKSPACE_NEW_PATH,
  PIPRO_WORKSPACE_PATH,
  piproWorkspaceEditPath,
};

export const piproPublicRoutes: readonly PiproPublicRoute[] = [
  {
    path: PIPRO_MODELS_PUBLIC_PATH,
    label: "Móveis pipro",
  },
];
