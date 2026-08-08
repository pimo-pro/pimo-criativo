/**
 * Rotas Industrial Admin UI (Fase F).
 * Paths em industrialAdminPaths / piproPaths — sem import cruzado de páginas.
 */

import type { ComponentType } from "react";
import { IndustrialModelsPage } from "../industrialAdmin/IndustrialModelsPage";
import { INDUSTRIAL_ADMIN_MODELS_PATH } from "./industrialAdminPaths";
import { PIPRO_WORKSPACE_PATH } from "./piproPaths";

export type IndustrialAdminRoute = {
  path: string;
  label: string;
  /** Carregamento lazy no App — não importar páginas aqui. */
  Component?: ComponentType;
};

export { INDUSTRIAL_ADMIN_MODELS_PATH } from "./industrialAdminPaths";
export { PIPRO_WORKSPACE_PATH } from "./piproPaths";

export const industrialAdminRoutes: readonly IndustrialAdminRoute[] = [
  {
    path: INDUSTRIAL_ADMIN_MODELS_PATH,
    label: "Industrial Models",
    Component: IndustrialModelsPage,
  },
  {
    path: PIPRO_WORKSPACE_PATH,
    label: "Workspace Design Mode",
  },
];

export { IndustrialModelsPage };
