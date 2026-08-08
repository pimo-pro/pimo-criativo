/**
 * Rotas Industrial Admin UI (Fase F) + Workspace Design Mode (pipro).
 * Declara path + componente; mount em App.
 */

import type { ComponentType } from "react";
import { IndustrialModelsPage } from "../industrialAdmin/IndustrialModelsPage";
import { WorkspaceDesignModePage } from "../pipro/WorkspaceDesignModePage";

export type IndustrialAdminRoute = {
  path: string;
  label: string;
  Component: ComponentType;
};

export const INDUSTRIAL_ADMIN_MODELS_PATH = "/admin/industrial/models";
export const PIPRO_WORKSPACE_PATH = "/admin/pipro/workspace";

export const industrialAdminRoutes: readonly IndustrialAdminRoute[] = [
  {
    path: INDUSTRIAL_ADMIN_MODELS_PATH,
    label: "Industrial Models",
    Component: IndustrialModelsPage,
  },
  {
    path: PIPRO_WORKSPACE_PATH,
    label: "Workspace Design Mode",
    Component: WorkspaceDesignModePage,
  },
];

export { IndustrialModelsPage, WorkspaceDesignModePage };
