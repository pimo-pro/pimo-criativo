/**
 * Rotas públicas da biblioteca pipro (móveis).
 */

import type { ComponentType } from "react";
import { PiproModelsPage } from "../pipro/PiproModelsPage";
import { PIPRO_WORKSPACE_PATH } from "./industrialAdminRoutes";

export type PiproPublicRoute = {
  path: string;
  label: string;
  Component: ComponentType;
};

export const PIPRO_MODELS_PUBLIC_PATH = "/moveis";
export const PIPRO_WORKSPACE_NEW_PATH = PIPRO_WORKSPACE_PATH;

export function piproWorkspaceEditPath(modelId: string): string {
  return `${PIPRO_WORKSPACE_PATH}?id=${encodeURIComponent(modelId)}`;
}

export const piproPublicRoutes: readonly PiproPublicRoute[] = [
  {
    path: PIPRO_MODELS_PUBLIC_PATH,
    label: "Móveis pipro",
    Component: PiproModelsPage,
  },
];

export { PiproModelsPage };
