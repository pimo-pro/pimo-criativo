/**
 * Rotas Industrial Admin UI (Fase F).
 * Declara path + componente; mount em App fica fora desta fase (ficheiro não listado).
 */

import type { ComponentType } from "react";
import { IndustrialModelsPage } from "../industrialAdmin/IndustrialModelsPage";

export type IndustrialAdminRoute = {
  path: string;
  label: string;
  Component: ComponentType;
};

export const INDUSTRIAL_ADMIN_MODELS_PATH = "/admin/industrial/models";

export const industrialAdminRoutes: readonly IndustrialAdminRoute[] = [
  {
    path: INDUSTRIAL_ADMIN_MODELS_PATH,
    label: "Industrial Models",
    Component: IndustrialModelsPage,
  },
];

export { IndustrialModelsPage };
