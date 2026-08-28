/**
 * SSOT Ferragens Totais — pipeline único (armazém + normalização) para PDF, UI e relatório.
 */

import { buildCutlistItemsForIndustrialExport } from "../fabrication/buildCutlistItemsForIndustrialExport";
import {
  buildFerragensTotaisArmazemData,
  type FerragensTotaisArmazemRow,
} from "../industrial/industrialBottomSectionData";
import { normalizeFerragensTotaisForPdf } from "../pdf/pdfFerragensTotaisNormalize";
import type { ComponentType } from "../components/componentTypes";
import type { Ferragem } from "./ferragens";
import type { MaterialIndustrial } from "../manufacturing/materials";
import type { ProjectState } from "../../context/projectTypes";
import type { CutListItemComPreco } from "../types";
import { sanitizeFerragensCatalog } from "./ferragensCatalogSanitize";

export type FerragensTotaisProjectSlice = Pick<
  ProjectState,
  | "boxes"
  | "rules"
  | "materialId"
  | "projectName"
  | "remates"
  | "rodapes"
  | "extractedPartsByBoxId"
  | "pieceObservacoes"
> & {
  workspaceBoxes?: ProjectState["workspaceBoxes"];
  ferragemOrla?: ProjectState["ferragemOrla"];
  orlaPresets?: ProjectState["orlaPresets"];
};

export type FerragensTotaisNormalized = {
  materiaisChapas: FerragensTotaisArmazemRow[];
  ferragens: FerragensTotaisArmazemRow[];
  cutlistItems: CutListItemComPreco[];
  totalQty: number;
};

export function buildFerragensTotaisNormalized(
  project: FerragensTotaisProjectSlice,
  componentTypes: ComponentType[],
  catalogFerragens: Ferragem[],
  materials: MaterialIndustrial[] = []
): FerragensTotaisNormalized {
  const catalog = sanitizeFerragensCatalog(catalogFerragens);
  const boxes = project.boxes ?? [];
  const projectName = project.projectName?.trim() || "Projeto";

  const { materiaisChapas, ferragens: rawFerragens } = buildFerragensTotaisArmazemData(
    project,
    componentTypes,
    catalog,
    materials
  );

  const cutlistItems = buildCutlistItemsForIndustrialExport({
    boxes,
    rules: project.rules,
    materialId: project.materialId,
    projectName,
    remates: project.remates ?? [],
    rodapes: project.rodapes ?? [],
    extractedPartsByBoxId: project.extractedPartsByBoxId,
  });

  const ferragens = normalizeFerragensTotaisForPdf({
    ferragens: rawFerragens,
    cutlistItems,
    boxes,
    rules: project.rules,
    ferragemOrla: project.ferragemOrla,
    orlaPresets: project.orlaPresets,
    projectMaterialId: project.materialId,
    remates: project.remates ?? [],
    workspaceBoxes: project.workspaceBoxes,
  });

  const totalQty = ferragens.reduce((s, r) => s + Math.max(0, Math.floor(r.quantidade)), 0);

  return { materiaisChapas, ferragens, cutlistItems, totalQty };
}
