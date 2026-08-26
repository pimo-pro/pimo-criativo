/**
 * Builders classicos por docId — fallback da politica PDF binaria (P1).
 * Usado por ZIP, /analise, hubs e handlers individuais quando o projeto
 * nao tem overrides documentais.
 */
import type { ProjectState } from "@/context/projectTypes";
import { COMPONENT_TYPES_DEFAULT, type ComponentType } from "@/core/components/componentTypes";
import { FERRAGENS_DEFAULT, type Ferragem } from "@/core/ferragens/ferragens";
import { buildCutlistItemsForIndustrialExport } from "@/core/fabrication/buildCutlistItemsForIndustrialExport";
import { buildBottomSectionPdfs } from "@/core/fabrication/industrialBottomSectionExports";
import { computeChapasReal } from "@/core/industrial/computeChapasReal";
import { computeConsumoMateriais } from "@/core/industrial/computeConsumoMateriais";
import { buildIndustrialFerragensForProject } from "@/core/industriais/buildIndustrialFerragensForProject";
import { listIndustrialMaterialsSnapshot } from "@/core/materials/service";
import { gerarPdfTecnicoCompleto } from "@/core/pdf/gerarPdfTecnico";
import { buildCutlistPdf, type ProjectForPdf } from "@/core/pdf/pdfCutlist";
import { buildFerragensIndustriaisPdf } from "@/core/pdf/pdfFerragensIndustriais";
import { buildIndustrialArmazemPdf } from "@/core/pdf/pdfIndustrialArmazem";
import {
  buildUnifiedPdf,
  type UnifiedPdfIndustrialContext,
} from "@/core/pdf/pdfUnified";
import { safeGetItem } from "@/utils/storage";
import type { IndustrialOnlineAnalysisDocId } from "./industrialOnlineAnalysisDocs";
import type { IndustrialPdfDoc } from "./resolveIndustrialZipPdf";

function loadComponentTypes(): ComponentType[] {
  const raw = safeGetItem("pimo_component_types");
  if (!raw) return COMPONENT_TYPES_DEFAULT;
  try {
    const parsed = JSON.parse(raw) as ComponentType[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : COMPONENT_TYPES_DEFAULT;
  } catch {
    return COMPONENT_TYPES_DEFAULT;
  }
}

function loadFerragens(): Ferragem[] {
  const raw = safeGetItem("pimo_ferragens");
  if (!raw) return FERRAGENS_DEFAULT;
  try {
    const parsed = JSON.parse(raw) as Ferragem[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : FERRAGENS_DEFAULT;
  } catch {
    return FERRAGENS_DEFAULT;
  }
}

function toProjectForPdf(project: ProjectState): ProjectForPdf & {
  ferragemOrla?: ProjectState["ferragemOrla"];
  financeiroOverrides?: ProjectState["financeiroOverrides"];
  financeiroAdminSettings?: ProjectState["financeiroAdminSettings"];
  orlaPieces?: ProjectState["orlaPieces"];
  orlaPresets?: ProjectState["orlaPresets"];
} {
  return {
    projectName: project.projectName?.trim() || "Projeto",
    boxes: project.boxes ?? [],
    rules: project.rules,
    materialId: project.materialId,
    extractedPartsByBoxId: project.extractedPartsByBoxId ?? {},
    pieceObservacoes: project.pieceObservacoes ?? {},
    industrialPieceEdits: project.industrialPieceEdits ?? {},
    remates: project.remates ?? [],
    rodapes: project.rodapes ?? [],
    ferragemOrla: project.ferragemOrla,
    financeiroOverrides: project.financeiroOverrides,
    financeiroAdminSettings: project.financeiroAdminSettings,
    orlaPieces: project.orlaPieces,
    orlaPresets: project.orlaPresets,
  };
}

function unifiedContext(showPrices: boolean): UnifiedPdfIndustrialContext {
  return {
    materials: listIndustrialMaterialsSnapshot(),
    componentTypes: loadComponentTypes(),
    ferragens: loadFerragens(),
    showPrices,
  };
}

export type BuildClassicIndustrialPdfOptions = {
  showPrices?: boolean;
};

/** Gera o PDF classico rico para um docId industrial. */
export async function buildClassicIndustrialPdf(
  project: ProjectState,
  docId: IndustrialOnlineAnalysisDocId,
  options?: BuildClassicIndustrialPdfOptions
): Promise<IndustrialPdfDoc> {
  const showPrices = options?.showPrices ?? false;
  const proj = toProjectForPdf(project);
  const projectName = proj.projectName;
  const boxes = proj.boxes;
  const materials = listIndustrialMaterialsSnapshot();
  const componentTypes = loadComponentTypes();
  const ferragens = loadFerragens();

  switch (docId) {
    case "cutlist":
      return buildCutlistPdf(proj);
    case "tecnico":
      return gerarPdfTecnicoCompleto(boxes, project.rules, projectName, {
        materialId: project.materialId,
        extractedPartsByBoxId: project.extractedPartsByBoxId,
        pieceObservacoes: project.pieceObservacoes,
      });
    case "unificado":
      return buildUnifiedPdf(proj, unifiedContext(showPrices));
    case "industrial_ferragens": {
      const data = buildIndustrialFerragensForProject({
        projectName,
        boxes,
        rules: project.rules,
        materialId: project.materialId,
        extractedPartsByBoxId: project.extractedPartsByBoxId,
        remates: project.remates ?? [],
        rodapes: project.rodapes ?? [],
        pieceObservacoes: project.pieceObservacoes,
      });
      return buildFerragensIndustriaisPdf(data);
    }
    case "resumo_financeiro":
    case "pecas_totais":
    case "ferragens_totais":
    case "totais_projeto": {
      const bottom = await buildBottomSectionPdfs({
        project: {
          projectName,
          boxes,
          rules: project.rules,
          materialId: project.materialId,
          extractedPartsByBoxId: project.extractedPartsByBoxId,
          remates: project.remates ?? [],
          rodapes: project.rodapes ?? [],
          pieceObservacoes: project.pieceObservacoes,
          industrialPieceEdits: project.industrialPieceEdits,
          ferragemOrla: project.ferragemOrla,
          orlaPresets: project.orlaPresets,
          orlaPieces: project.orlaPieces,
          financeiroOverrides: project.financeiroOverrides,
          financeiroAdminSettings: project.financeiroAdminSettings,
        },
        materials,
        componentTypes,
        ferragens,
        showPrices,
      });
      if (docId === "resumo_financeiro") return bottom.resumoFinanceiro;
      if (docId === "pecas_totais") return bottom.pecasTotais;
      if (docId === "ferragens_totais") return bottom.ferragensTotais;
      return bottom.totaisProjeto;
    }
    case "industrial_armazem": {
      const items = buildCutlistItemsForIndustrialExport({
        boxes,
        rules: project.rules,
        materialId: project.materialId,
        projectName,
        remates: project.remates ?? [],
        rodapes: project.rodapes ?? [],
        extractedPartsByBoxId: project.extractedPartsByBoxId,
        industrialPieceEdits: project.industrialPieceEdits,
      });
      const consumo = computeConsumoMateriais(items, materials, projectName, boxes);
      const chapas = computeChapasReal(items, projectName, boxes, { projectId: projectName });
      return buildIndustrialArmazemPdf(projectName, chapas, consumo);
    }
    default: {
      const _exhaustive: never = docId;
      throw new Error(`Doc industrial sem builder classico: ${String(_exhaustive)}`);
    }
  }
}
