/**
 * Motor de fabricacao multiprojeto (Fase 1).
 *
 * @deprecated P3 — orfao sem caller UI. Preferir producao individual + IndustrialCenter.
 * Mantido para eventual ligacao futura; nao usar em novos fluxos.
 * Agrega varios projetos num unico ZIP sem alterar snapshots, estado em memoria nem o motor industrial existente.
 */

import JSZip from "jszip";
import type { BoxModule, CutListItemComPreco } from "../types";
import type { ProjectState } from "../../context/projectTypes";
import { applyResultados } from "../../context/projectState";
import { reviveState } from "../../context/projectPersistence";
import { loadProjectRecord } from "../projects/projectsClient";
import { buildCutlistItemsForIndustrialExport } from "./buildCutlistItemsForIndustrialExport";
import { gerarPdfTecnicoCompleto } from "../pdf/gerarPdfTecnico";
import { buildCutlistPdf, type ProjectForPdf } from "../pdf/pdfCutlist";
import { buildUnifiedPdf } from "../pdf/pdfUnified";
import type { ProjectForEtiquetasPdf } from "../pdf/pdfEtiquetas";
import { UnifiedEtiquetaEngine } from "../etiquetas";
import type { CutlistItemForPieces } from "../cutlayout/cutLayoutEngine";
import type { CutLayoutResult, CutPlacement } from "../cutlayout/cutLayoutTypes";
import { buildTcnExportBaseName, getDefaultCncLayoutOptions, getFastCncLayoutOptions } from "../cnc/cncPipeline";
import {
  autoFixCncThicknessMismatch,
} from "../../industrial/autoCorrection/industrialThicknessAutoCorrection";
import {
  industrialThicknessEtiquetasPdfPath,
  industrialThicknessLayoutPdfPath,
  industrialThicknessTcnDirPath,
} from "../cnc/industrialThicknessGroups";
import {
  buildCncBundlesPerThickness,
  mergePerThicknessPlacements,
} from "./industrialPerThicknessPipeline";
import { buildDrillFilesForProject } from "../drill/drillExport";
import { getSettings } from "../settings/settingsService";
import { listMaterials, listIndustrialMaterialsSnapshot } from "../materials/service";
import { buildIndustrialManifest } from "./industrialManifest";
import { sanitizeZipPath } from "../../utils/sanitization";
import { devLogger } from "../../utils/devLogger";
import type { PrintReadyDimensions } from "../../3d/viewer-engine/overlays/boxDimensionsLayout";
import type { McDimensionsViewerSource } from "../industrial/mcDimensions/mcDimensionsCapture";
import { captureMcDimensionsFromViewer } from "../industrial/mcDimensions/mcDimensionsCapture";
import { exportMCDimensionsForZip } from "../industrial/mcDimensions/mcDimensionsGenerator";
import { loadMcDimensionsConfig } from "../../config/mcDimensionsConfig";
import { mergePieceObservacoesStores } from "../observacoes/ObservacoesService";
import {
  applyDocumentaryOverridesToCutlistForEtiquetas,
  applyMultiProjectDocumentaryOverridesForEtiquetas,
} from "../industrial/onlineAnalysis/applyDocumentaryOverridesToCutlistForEtiquetas";
import {
  beginIndustrialFileGeneration,
  endIndustrialFileGeneration,
} from "./industrialGenerationSuspend";
import { measureTime } from "../../utils/measureTime";
import { buildIndustrialFerragensForProject } from "../industriais/buildIndustrialFerragensForProject";
import { buildFerragensIndustriaisPdf } from "../pdf/pdfFerragensIndustriais";
import { buildFerragensIndustriaisXlsxBuffer } from "../xlsx/xlsxFerragensIndustriais";
import {
  industrialFerragensPdfFileName,
  industrialFerragensXlsxFileName,
} from "./industrialProjectArtifacts";
import { buildBottomSectionPdfs } from "./industrialBottomSectionExports";
import { ensureLogoIndustrialLoaded } from "../pdf/logoIndustrialPublic";
import { computeConsumoMateriais } from "../industrial/computeConsumoMateriais";
import { computeChapasReal } from "../industrial/computeChapasReal";
import {
  buildIndustrialArmazemPdf,
  industrialArmazemPdfFileName,
} from "../pdf/pdfIndustrialArmazem";
import { COMPONENT_TYPES_DEFAULT, type ComponentType } from "../components/componentTypes";
import { FERRAGENS_DEFAULT, type Ferragem } from "../ferragens/ferragens";
import { safeGetItem } from "../../utils/storage";
import {
  assertIndustrialRequiredArtifactsComplete,
  beginIndustrialRequiredArtifactTracking,
  endIndustrialRequiredArtifactTracking,
  resetIndustrialRequiredArtifacts,
} from "../industrial/industrialOutputGuard";
import { resolveIndustrialZipPdf } from "../industrial/onlineAnalysis/resolveIndustrialZipPdf";

export interface GeneratedFabricationPackage {
  zipBlob: Blob;
  summary: {
    totalPieces: number;
    projects: string[];
  };
}

export type GenerationStep = {
  step: number;
  total: number;
  label: string;
  detail?: string;
  elapsed: number;
};

export type MultiProjectFabricationOptions = {
  nesting?: "auto" | "none";
  signal?: AbortSignal;
  onProgress?: (_step: GenerationStep) => void;
  /** Fonte opcional de medidas MC (viewer). Se omitido, MC não é gerado. */
  mcDimensionsViewer?: McDimensionsViewerSource;
};

function loadExportComponentTypes(): ComponentType[] {
  const raw = safeGetItem("pimo_component_types");
  if (!raw) return COMPONENT_TYPES_DEFAULT;
  try {
    const parsed = JSON.parse(raw) as ComponentType[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : COMPONENT_TYPES_DEFAULT;
  } catch {
    return COMPONENT_TYPES_DEFAULT;
  }
}

function loadExportFerragens(): Ferragem[] {
  const raw = safeGetItem("pimo_ferragens");
  if (!raw) return FERRAGENS_DEFAULT;
  try {
    const parsed = JSON.parse(raw) as Ferragem[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : FERRAGENS_DEFAULT;
  } catch {
    return FERRAGENS_DEFAULT;
  }
}

function pdfToBlob(doc: { output: (_type: string) => ArrayBuffer | Uint8Array }): Blob {
  const arr = doc.output("arraybuffer");
  const buffer = arr instanceof ArrayBuffer ? arr : new Uint8Array(arr).buffer;
  return new Blob([buffer], { type: "application/pdf" });
}

function tcnMethodSuffix(tcnMetodo: string | undefined): "mo" | "v2n" {
  switch (tcnMetodo) {
    case "v2_new":
      return "v2n";
    case "nesting_mo":
    default:
      return "mo";
  }
}

function projectSlug(name: string): string {
  return (
    (name || "projeto")
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .replace(/\s+/g, "_") || "projeto"
  );
}

function buildItemsForCncExportFromState(state: ProjectState): CutListItemComPreco[] {
  return buildCutlistItemsForIndustrialExport({
    boxes: state.boxes ?? [],
    rules: state.rules,
    materialId: state.materialId,
    projectName: state.projectName,
    remates: state.remates ?? [],
    rodapes: state.rodapes ?? [],
    extractedPartsByBoxId: state.extractedPartsByBoxId,
    industrialPieceEdits: state.industrialPieceEdits,
  });
}

function prefixCutlistItem(item: CutListItemComPreco, prefix: string): CutListItemComPreco {
  const o = { ...item } as Record<string, unknown>;
  if (typeof o.id === "string") o.id = `${prefix}${o.id}`;
  if (typeof o.boxId === "string" && o.boxId) o.boxId = `${prefix}${o.boxId}`;
  if (typeof o.nome === "string") o.nome = `${prefix}${o.nome}`;
  if (typeof o.modelInstanceId === "string" && o.modelInstanceId) o.modelInstanceId = `${prefix}${o.modelInstanceId}`;
  if (typeof o.partName === "string" && o.partName) o.partName = `${prefix}${o.partName}`;
  return o as unknown as CutListItemComPreco;
}

function prefixBoxModule(box: BoxModule, prefix: string): BoxModule {
  return {
    ...box,
    id: `${prefix}${box.id}`,
    nome: `${prefix}${box.nome}`,
  };
}

function stateToProjectForPdf(state: ProjectState): ProjectForPdf {
  return {
    projectName: state.projectName ?? "Projeto",
    boxes: state.boxes ?? [],
    rules: state.rules,
    materialId: state.materialId,
    extractedPartsByBoxId: state.extractedPartsByBoxId ?? {},
    pieceObservacoes: state.pieceObservacoes ?? {},
  };
}

function safeAddPdf(
  zip: JSZip,
  zipPath: string,
  doc: { output: (_type: string) => ArrayBuffer | Uint8Array } | null | undefined
): boolean {
  if (!doc || typeof doc.output !== "function") return false;
  const safePath = sanitizeZipPath(zipPath);
  if (!safePath) return false;
  try {
    const blob = pdfToBlob(doc);
    if (!blob || blob.size === 0) return false;
    zip.file(safePath, blob);
    return true;
  } catch {
    return false;
  }
}

function safeAddXlsx(zip: JSZip, zipPath: string, buffer: ArrayBuffer | null | undefined): boolean {
  if (!buffer || buffer.byteLength === 0) return false;
  const safePath = sanitizeZipPath(zipPath);
  if (!safePath) return false;
  try {
    zip.file(safePath, buffer);
    return true;
  } catch {
    return false;
  }
}

function uniqueFolderSegment(base: string, used: Set<string>): string {
  const sanitized = sanitizeZipPath(base) || "projeto";
  if (!used.has(sanitized)) {
    used.add(sanitized);
    return sanitized;
  }
  let n = 2;
  let candidate = `${sanitized}_${n}`;
  while (used.has(candidate)) {
    n += 1;
    candidate = `${sanitized}_${n}`;
  }
  used.add(candidate);
  return candidate;
}

// --- Numeração global de peças (Fabricação em Massa) ---

type GlobalPieceInfo = {
  globalNumber: number;
  sheetIndex: number;
  rotacao: number;
};

/**
 * Cria índice de numeração global ordenado pelo layout de chapas.
 * Ordem: chapa ascendente → y descendente (base da chapa primeiro) → x ascendente.
 * Peças sem colocação no nesting ficam no fim, em ordem de aparição.
 */
function buildGlobalPieceIndex(
  items: CutListItemComPreco[],
  sheets: Array<{ placements: CutPlacement[] }>
): Map<string, GlobalPieceInfo> {
  const posLookup = new Map<string, { sheetIndex: number; x_mm: number; y_mm: number; rotacao: number }>();
  for (const sheet of sheets) {
    for (const placement of sheet.placements) {
      const key = `${placement.boxId ?? ""}::${placement.partName ?? ""}`;
      if (!posLookup.has(key)) {
        posLookup.set(key, {
          sheetIndex: placement.sheetIndex,
          x_mm: placement.x_mm,
          y_mm: placement.y_mm,
          rotacao: placement.rotacao,
        });
      }
    }
  }

  const sortedItems = [...items].sort((a, b) => {
    const keyA = `${a.boxId ?? ""}::${a.nome ?? ""}`;
    const keyB = `${b.boxId ?? ""}::${b.nome ?? ""}`;
    const posA = posLookup.get(keyA);
    const posB = posLookup.get(keyB);
    if (!posA && !posB) return 0;
    if (!posA) return 1;
    if (!posB) return -1;
    if (posA.sheetIndex !== posB.sheetIndex) return posA.sheetIndex - posB.sheetIndex;
    const yDiff = posB.y_mm - posA.y_mm;
    if (Math.abs(yDiff) > 1) return yDiff;
    return posA.x_mm - posB.x_mm;
  });

  const result = new Map<string, GlobalPieceInfo>();
  for (let i = 0; i < sortedItems.length; i++) {
    const item = sortedItems[i]!;
    const key = `${item.boxId ?? ""}::${item.nome ?? ""}`;
    const pos = posLookup.get(key);
    result.set(key, {
      globalNumber: i + 1,
      sheetIndex: pos?.sheetIndex ?? -1,
      rotacao: pos?.rotacao ?? 0,
    });
  }
  return result;
}

/**
 * Aplica numeração global e projeto de origem a todos os itens prefixados (in-place).
 * Após esta chamada cada item tem `pieceNumber` global único e `sourceProjectName`.
 */
function applyGlobalPieceNumbers(
  items: CutListItemComPreco[],
  globalIndex: Map<string, GlobalPieceInfo>,
  prefixToProjectName: Map<string, string>
): void {
  const prefixes = [...prefixToProjectName.keys()];
  for (const item of items) {
    const key = `${item.boxId ?? ""}::${item.nome ?? ""}`;
    const info = globalIndex.get(key);
    const prefix = prefixes.find((p) => (item.boxId ?? "").startsWith(p));
    const o = item as unknown as Record<string, unknown>;
    if (info) {
      o.pieceNumber = info.globalNumber;
    }
    if (prefix) {
      o.sourceProjectName = prefixToProjectName.get(prefix);
    }
  }
}

/**
 * Constrói itens originais (não prefixados) de um projeto com numeração global atribuída.
 * Usados para PDFs de cutlist e etiquetas por projeto (IDs originais, números globais).
 */
function buildProjectDisplayItems(
  entry: { state: ProjectState; prefix: string; recordId: string },
  globalIndex: Map<string, GlobalPieceInfo>
): CutListItemComPreco[] {
  const rawItems = buildItemsForCncExportFromState(entry.state);
  let fallback = globalIndex.size + 1;
  return rawItems.map((item) => {
    const prefixedKey = `${entry.prefix}${item.boxId ?? ""}::${entry.prefix}${item.nome ?? ""}`;
    const info = globalIndex.get(prefixedKey);
    return {
      ...item,
      pieceNumber: info?.globalNumber ?? fallback++,
    };
  });
}

/**
 * Carrega snapshots, recalcula com `applyResultados` e gera ZIP com:
 * - Layout global único de corte PRO
 * - Etiquetas globais (numeração 1..N, nome do projeto de origem em cada etiqueta)
 * - TCN/CNC global (por material) + por projeto
 * - Drill XML global + por projeto
 * - Por projeto: cutlist, técnico, unificado, etiquetas (com numeração global)
 */
export async function generateMultiProjectFabrication(
  projectIds: string[],
  options?: MultiProjectFabricationOptions
): Promise<GeneratedFabricationPackage> {
  if (!Array.isArray(projectIds) || projectIds.length === 0) {
    throw new Error("multiProjectFabrication: indique pelo menos um projectId.");
  }

  beginIndustrialFileGeneration();
  try {
    await ensureLogoIndustrialLoaded();
    return await measureTime("Fabricação multi-projeto (ZIP)", async () => {
  const nestingMode = options?.nesting ?? "auto";
  const signal = options?.signal;
  const onProgress = options?.onProgress;
  const totalSteps = 7;
  const t0 = Date.now();

  const emit = (step: number, label: string, detail?: string) => {
    onProgress?.({ step, total: totalSteps, label, detail, elapsed: Date.now() - t0 });
  };

  const checkAbort = () => {
    if (signal?.aborted) {
      const err = new Error("AbortError");
      err.name = "AbortError";
      throw err;
    }
  };

  const cncPipelineOpts = nestingMode === "none" ? getFastCncLayoutOptions() : getDefaultCncLayoutOptions();
  const tcnSuffix = tcnMethodSuffix(getSettings()?.cnc?.tcnMetodo);
  const settingsSnapshot = getSettings();
  const materialsSnapshot = listMaterials();
  const industrialMaterialsSnapshot = listIndustrialMaterialsSnapshot();
  const exportComponentTypes = loadExportComponentTypes();
  const exportFerragens = loadExportFerragens();

  type LoadedEntry = {
    state: ProjectState;
    recordId: string;
    prefix: string;
  };

  const loaded: LoadedEntry[] = [];

  // PASSO 1 — Carregar projetos
  emit(1, "Carregando projetos…");
  for (let i = 0; i < projectIds.length; i += 1) {
    checkAbort();
    const recordId = projectIds[i];
    emit(1, "Carregando projetos…", `Projeto ${i + 1} de ${projectIds.length}`);
    const record = await loadProjectRecord(recordId);
    if (!record?.snapshot?.projectState) {
      throw new Error(`multiProjectFabrication: projeto não encontrado ou sem snapshot (${recordId}).`);
    }
    const revived = reviveState(record.snapshot.projectState);
    if (!revived) {
      throw new Error(`multiProjectFabrication: falha ao reviver estado (${recordId}).`);
    }
    const state = applyResultados(revived);
    loaded.push({ state, recordId, prefix: `P${i + 1}_` });
  }

  const mergedPieceObservacoes = mergePieceObservacoesStores(
    ...loaded.map((entry) => entry.state.pieceObservacoes)
  );

  checkAbort();

  const projectNames: string[] = [];
  const allPrefixedItems: CutListItemComPreco[] = [];
  const allPrefixedBoxes: BoxModule[] = [];
  const rulesForGlobal = loaded[0]!.state.rules;
  const prefixToProjectName = new Map<string, string>();

  for (const entry of loaded) {
    const { state, prefix } = entry;
    const projName = state.projectName || entry.recordId;
    projectNames.push(projName);
    prefixToProjectName.set(prefix, projName);

    const items = buildItemsForCncExportFromState(state).map((it) => prefixCutlistItem(it, prefix));
    allPrefixedItems.push(...items);

    for (const b of state.boxes ?? []) {
      allPrefixedBoxes.push(prefixBoxModule(b, prefix));
    }
  }

  const globalProjectStub = {
    projectName: "Fabricacao_Multi",
    rules: rulesForGlobal,
  };

  // PASSO 2 — Layout global por espessura (para numeração e ficheiros industriais)
  checkAbort();
  emit(2, "Otimizando layout por espessura…");

  const allItemsForLayout = allPrefixedItems as CutlistItemForPieces[];
  const layoutTitle = projectNames.join(" + ");
  let globalThicknessBundles: Awaited<ReturnType<typeof buildCncBundlesPerThickness>> = [];
  let combinedPlacements: CutPlacement[] = [];

  try {
    if (allItemsForLayout.length > 0) {
      emit(2, "Otimizando layout por espessura…", "Executando nesting…");
      globalThicknessBundles = await buildCncBundlesPerThickness(
        settingsSnapshot,
        materialsSnapshot,
        globalProjectStub,
        allItemsForLayout,
        cncPipelineOpts
      );
      combinedPlacements = mergePerThicknessPlacements(globalThicknessBundles);
    }
  } catch (err) {
    devLogger.error("multiProjectFabrication: layout por espessura", err);
  }

  const layoutResult: CutLayoutResult | null =
    globalThicknessBundles.length > 0
      ? {
          ...globalThicknessBundles[0]!.cncBundle.layoutResult,
          sheets: globalThicknessBundles.flatMap((b) => b.cncBundle.layoutResult.sheets),
        }
      : null;

  // Atribuir numeração global única e projeto de origem a todos os itens prefixados
  const globalIndex = buildGlobalPieceIndex(allPrefixedItems, layoutResult?.sheets ?? []);
  applyGlobalPieceNumbers(allPrefixedItems, globalIndex, prefixToProjectName);
  const allPrefixedCncItems = autoFixCncThicknessMismatch(
    allPrefixedItems as CutlistItemForPieces[],
    materialsSnapshot
  ) as CutListItemComPreco[];

  // PASSO 3 — PDF do layout de corte PRO + etiquetas globais (um conjunto por espessura em cnc/)
  checkAbort();
  emit(3, "Gerando PDFs industriais por espessura…");

  const zip = new JSZip();
  const folderNamesUsed = new Set<string>();
  let tcnFilesAdded = 0;
  const tcnManifestFiles: Array<{ path: string; content: string }> = [];
  beginIndustrialRequiredArtifactTracking();

  if (globalThicknessBundles.length > 0) {
    try {
      const { buildCutLayoutPdf } = await import("../cutlayout/cutLayoutPdf");
      const overrideEntries = loaded.map((entry) => ({
        prefix: entry.prefix,
        overrides: entry.state.industrialDocumentOverrides,
      }));
      for (const bundle of globalThicknessBundles) {
        const layout = bundle.cncBundle.layoutResult;
        const docLayout = await buildCutLayoutPdf(layout, {
          projectName: `${layoutTitle || "Multi-projeto"} — ${bundle.bucket}`,
        });
        safeAddPdf(zip, industrialThicknessLayoutPdfPath(bundle.bucket), docLayout);

        // Fase 5: merge documental só nas etiquetas (layout/CNC usam items base)
        const etiquetaItems = applyMultiProjectDocumentaryOverridesForEtiquetas(
          bundle.items as CutListItemComPreco[],
          overrideEntries
        );
        const globalEtiquetasProj: ProjectForEtiquetasPdf = {
          projectName: layoutTitle || "Multi-projeto",
          boxes: allPrefixedBoxes,
          rules: rulesForGlobal,
          settings: getSettings(),
          precomputedItems: etiquetaItems,
          cutLayoutPlacements: layout.sheets.flatMap((s) => s.placements),
          pieceObservacoes: mergedPieceObservacoes,
        };
        const docEtiquetasTodas = await UnifiedEtiquetaEngine.build(globalEtiquetasProj);
        safeAddPdf(zip, industrialThicknessEtiquetasPdfPath(bundle.bucket), docEtiquetasTodas);
      }
    } catch (err) {
      devLogger.error("multiProjectFabrication: layout/etiquetas por espessura", err);
    }
  }

  // PASSO 4 — Loop por projeto (com numeração global já disponível)
  checkAbort();
  emit(4, "Gerando ficheiros por projeto…");

  for (const entry of loaded) {
    checkAbort();
    const proj = stateToProjectForPdf(entry.state);
    emit(4, "Gerando ficheiros por projeto…", proj.projectName || entry.recordId);

    const folder = uniqueFolderSegment(projectSlug(proj.projectName), folderNamesUsed);
    const basePath = `projetos/${folder}`;

    // Itens originais do projeto com numeração global (para cutlist e etiquetas)
    const projDisplayItems = buildProjectDisplayItems(entry, globalIndex);

    // Placements filtrados do projeto (IDs sem prefixo, para ordenação das etiquetas)
    const prefixLen = entry.prefix.length;
    const projPlacements = combinedPlacements
      .filter((p) => (p.boxId ?? "").startsWith(entry.prefix))
      .map((p) => ({
        ...p,
        boxId: (p.boxId ?? "").slice(prefixLen),
        partName: (p.partName ?? "").slice(prefixLen),
      }));

    // Cutlist PDF com numeração global
    try {
      const projForCutlist: ProjectForPdf = {
        ...proj,
        precomputedItems: projDisplayItems,
      };
      const docCutlist = await resolveIndustrialZipPdf(entry.state, "cutlist", () =>
        buildCutlistPdf(projForCutlist)
      );
      safeAddPdf(zip, `${basePath}/cutlist.pdf`, docCutlist);
    } catch (err) {
      devLogger.error("multiProjectFabrication: cutlist PDF", err);
    }

    // PDF Técnico
    try {
      const docTecnico = await resolveIndustrialZipPdf(entry.state, "tecnico", () =>
        gerarPdfTecnicoCompleto(proj.boxes, proj.rules, proj.projectName, {
          materialId: proj.materialId,
          extractedPartsByBoxId: proj.extractedPartsByBoxId ?? {},
          precomputedItems: projDisplayItems,
          pieceObservacoes: proj.pieceObservacoes,
        })
      );
      safeAddPdf(zip, `${basePath}/tecnico.pdf`, docTecnico);
    } catch (err) {
      devLogger.error("multiProjectFabrication: técnico PDF", err);
    }

    // PDF Unificado
    try {
      const docUnificado = await resolveIndustrialZipPdf(entry.state, "unificado", () =>
        buildUnifiedPdf(
          {
            ...proj,
            precomputedItems: projDisplayItems,
            remates: entry.state.remates ?? [],
            rodapes: entry.state.rodapes ?? [],
          },
          {
            materials: industrialMaterialsSnapshot,
            componentTypes: exportComponentTypes,
            ferragens: exportFerragens,
            showPrices: false,
          }
        )
      );
      safeAddPdf(zip, `${basePath}/unificado.pdf`, docUnificado);
    } catch (err) {
      devLogger.error("multiProjectFabrication: unificado PDF", err);
    }

    try {
      resetIndustrialRequiredArtifacts();
      const ferragensData = buildIndustrialFerragensForProject({
        projectName: proj.projectName,
        boxes: proj.boxes,
        rules: proj.rules,
        materialId: proj.materialId,
        extractedPartsByBoxId: proj.extractedPartsByBoxId ?? {},
        remates: entry.state.remates ?? [],
        rodapes: entry.state.rodapes ?? [],
        pieceObservacoes: proj.pieceObservacoes,
      });
      const docFerragens = await resolveIndustrialZipPdf(
        entry.state,
        "industrial_ferragens",
        () => buildFerragensIndustriaisPdf(ferragensData)
      );
      safeAddPdf(zip, `${basePath}/${industrialFerragensPdfFileName(folder)}`, docFerragens);
      const xlsxBuffer = await buildFerragensIndustriaisXlsxBuffer(ferragensData);
      safeAddXlsx(zip, `${basePath}/${industrialFerragensXlsxFileName(folder)}`, xlsxBuffer);
      assertIndustrialRequiredArtifactsComplete();

      const bottomPdfs = await buildBottomSectionPdfs({
        project: {
          projectName: proj.projectName,
          boxes: proj.boxes,
          rules: proj.rules,
          materialId: proj.materialId,
          extractedPartsByBoxId: proj.extractedPartsByBoxId ?? {},
          remates: entry.state.remates ?? [],
          rodapes: entry.state.rodapes ?? [],
          pieceObservacoes: proj.pieceObservacoes,
          industrialPieceEdits: entry.state.industrialPieceEdits ?? {},
          ferragemOrla: entry.state.ferragemOrla,
          orlaPresets: entry.state.orlaPresets,
          orlaPieces: entry.state.orlaPieces,
          financeiroOverrides: entry.state.financeiroOverrides,
          financeiroAdminSettings: entry.state.financeiroAdminSettings,
        },
        materials: industrialMaterialsSnapshot,
        componentTypes: exportComponentTypes,
        ferragens: exportFerragens,
        showPrices: false,
      });
      const resumoDoc = await resolveIndustrialZipPdf(entry.state, "resumo_financeiro", () =>
        bottomPdfs.resumoFinanceiro
      );
      const pecasDoc = await resolveIndustrialZipPdf(entry.state, "pecas_totais", () =>
        bottomPdfs.pecasTotais
      );
      const ferragensTotaisDoc = await resolveIndustrialZipPdf(entry.state, "ferragens_totais", () =>
        bottomPdfs.ferragensTotais
      );
      const totaisDoc = await resolveIndustrialZipPdf(entry.state, "totais_projeto", () =>
        bottomPdfs.totaisProjeto
      );
      safeAddPdf(zip, `${basePath}/${bottomPdfs.fileNames.resumoFinanceiro}`, resumoDoc);
      safeAddPdf(zip, `${basePath}/${bottomPdfs.fileNames.pecasTotais}`, pecasDoc);
      safeAddPdf(zip, `${basePath}/${bottomPdfs.fileNames.ferragensTotais}`, ferragensTotaisDoc);
      safeAddPdf(zip, `${basePath}/${bottomPdfs.fileNames.totaisProjeto}`, totaisDoc);

      const armazemItems = buildCutlistItemsForIndustrialExport({
        boxes: proj.boxes,
        rules: proj.rules,
        materialId: proj.materialId,
        projectName: proj.projectName,
        remates: entry.state.remates ?? [],
        rodapes: entry.state.rodapes ?? [],
        extractedPartsByBoxId: proj.extractedPartsByBoxId ?? {},
        industrialPieceEdits: entry.state.industrialPieceEdits ?? {},
      });
      const chapasReal = computeChapasReal(armazemItems, proj.projectName ?? folder, proj.boxes);
      const consumoSummary = computeConsumoMateriais(
        armazemItems,
        industrialMaterialsSnapshot,
        proj.projectName ?? folder,
        proj.boxes
      );
      const armazemPdf = await resolveIndustrialZipPdf(entry.state, "industrial_armazem", () =>
        buildIndustrialArmazemPdf(proj.projectName ?? folder, chapasReal, consumoSummary)
      );
      safeAddPdf(zip, `${basePath}/${industrialArmazemPdfFileName(folder)}`, armazemPdf);
    } catch (err) {
      devLogger.error("multiProjectFabrication: ferragens PDF/XLSX", err);
      throw err;
    }

    // Etiquetas com numeração global e nome do projeto original
    try {
      const etiquetaItems = applyDocumentaryOverridesToCutlistForEtiquetas(
        projDisplayItems,
        entry.state.industrialDocumentOverrides
      );
      const docEtiquetas = await UnifiedEtiquetaEngine.build({
        projectName: proj.projectName,
        boxes: proj.boxes,
        rules: proj.rules,
        materialId: proj.materialId,
        settings: getSettings(),
        precomputedItems: etiquetaItems,
        cutLayoutPlacements: projPlacements.length > 0 ? projPlacements : undefined,
        pieceObservacoes: proj.pieceObservacoes,
      });
      safeAddPdf(zip, `${basePath}/etiquetas.pdf`, docEtiquetas);
    } catch (err) {
      devLogger.error("multiProjectFabrication: etiquetas PDF", err);
    }

    // TCN/CNC por projeto (nesting por espessura das peças do projeto)
    try {
      const projPrefixedItems = allPrefixedCncItems.filter((item) =>
        (item.boxId ?? "").startsWith(entry.prefix)
      );
      if (projPrefixedItems.length > 0) {
        checkAbort();
        const projThicknessBundles = await buildCncBundlesPerThickness(
          settingsSnapshot,
          materialsSnapshot,
          { projectName: proj.projectName || entry.recordId, rules: entry.state.rules },
          projPrefixedItems as CutlistItemForPieces[],
          cncPipelineOpts
        );
        const usedProjTcnNames = new Set<string>();
        for (const bundle of projThicknessBundles) {
          const files = bundle.cncBundle.cnc?.files ?? [];
          for (const file of files) {
            if (!file || file.tcn == null) continue;
            const tcnDir = `${basePath}/${industrialThicknessTcnDirPath(bundle.bucket)}`;
            const base = buildTcnExportBaseName(
              bundle.cncBundle.layoutResult,
              file.panelIndex,
              files.length
            );
            let finalBase = base;
            let dedupeIdx = 2;
            while (usedProjTcnNames.has(`${tcnDir}/${finalBase}`)) {
              finalBase = `${base}_${dedupeIdx}`;
              dedupeIdx += 1;
            }
            usedProjTcnNames.add(`${tcnDir}/${finalBase}`);
            const tcnPath = sanitizeZipPath(
              `${tcnDir}/${finalBase}_${tcnSuffix}.tcn`
            );
            if (tcnPath && typeof file.tcn === "string") {
              zip.file(tcnPath, file.tcn);
              tcnManifestFiles.push({ path: tcnPath, content: file.tcn });
              tcnFilesAdded += 1;
            }
          }
        }
      }
    } catch (err) {
      devLogger.error("multiProjectFabrication: TCN por projeto", err);
    }

    // Drill XML por projeto
    try {
      const projPrefixedItemsDrill = allPrefixedItems.filter((item) =>
        (item.boxId ?? "").startsWith(entry.prefix)
      );
      const projPrefixedBoxes = allPrefixedBoxes.filter((b) => b.id.startsWith(entry.prefix));
      const drillFiles = buildDrillFilesForProject(projPrefixedItemsDrill, {
        projectName: proj.projectName || entry.recordId,
        boxes: projPrefixedBoxes,
        rules: entry.state.rules,
      });
      const usedDrillNames = new Set<string>();
      for (const f of drillFiles) {
        const base = sanitizeZipPath(f.filenameBase) || "peca";
        let n = 2;
        let name = base;
        while (usedDrillNames.has(name)) {
          name = `${base}_${n}`;
          n += 1;
        }
        usedDrillNames.add(name);
        zip.file(sanitizeZipPath(`${basePath}/drill/${name}.xml`), f.xml);
      }
    } catch (err) {
      devLogger.error("multiProjectFabrication: drill XML por projeto", err);
    }
  }

  // PASSO 5 — TCN/CNC global (nesting por espessura)
  checkAbort();
  emit(5, "Gerando ficheiros TCN/CNC globais por espessura…");

  try {
    checkAbort();
    emit(5, "Gerando ficheiros TCN/CNC globais…", "nesting por espessura");
    const usedTcnNamesByPath = new Set<string>();
    for (const bundle of globalThicknessBundles) {
      const files = bundle.cncBundle.cnc?.files ?? [];
      for (const file of files) {
        if (!file || file.tcn == null) continue;
        const tcnDir = industrialThicknessTcnDirPath(bundle.bucket);
        const base = buildTcnExportBaseName(
          bundle.cncBundle.layoutResult,
          file.panelIndex,
          files.length
        );
        let finalBase = base;
        let dedupeIndex = 2;
        while (usedTcnNamesByPath.has(`${tcnDir}/${finalBase}`)) {
          finalBase = `${base}_${dedupeIndex}`;
          dedupeIndex += 1;
        }
        usedTcnNamesByPath.add(`${tcnDir}/${finalBase}`);
        const tcnPathFinal = sanitizeZipPath(
          `${tcnDir}/${finalBase}_cnc_${tcnSuffix}.tcn`
        );
        if (tcnPathFinal && typeof file.tcn === "string") {
          zip.file(tcnPathFinal, file.tcn);
          tcnManifestFiles.push({ path: tcnPathFinal, content: file.tcn });
          tcnFilesAdded += 1;
        }
      }
    }
  } catch (err) {
    devLogger.error("multiProjectFabrication: CNC global", err);
  }

  if (allPrefixedItems.length > 0 && tcnFilesAdded === 0) {
    throw new Error("multiProjectFabrication: nenhum ficheiro TCN foi gerado.");
  }

  // PASSO 6 — Drill XML global
  checkAbort();
  emit(6, "Gerando ficheiros de furação (drill) globais…");

  try {
    const drillFiles = buildDrillFilesForProject(allPrefixedItems, {
      projectName: globalProjectStub.projectName,
      boxes: allPrefixedBoxes,
      rules: rulesForGlobal,
    });
    const usedDrill = new Set<string>();
    for (const f of drillFiles) {
      const base = sanitizeZipPath(f.filenameBase) || "peca";
      let n = 2;
      let name = base;
      while (usedDrill.has(name)) {
        name = `${base}_${n}`;
        n += 1;
      }
      usedDrill.add(name);
      zip.file(sanitizeZipPath(`drill/${name}.xml`), f.xml);
    }
  } catch (err) {
    devLogger.error("multiProjectFabrication: drill XML global", err);
  }

  // PASSO 7 — Compactar pacote
  checkAbort();
  emit(7, "Compactando pacote industrial…");

  if (tcnManifestFiles.length > 0) {
    const manifest = await buildIndustrialManifest(tcnManifestFiles);
    zip.file("manifest-industrial.json", JSON.stringify(manifest, null, 2));
  }

  // MC Dimensions — pipeline independente (após industrial, antes do ZIP final)
  if (loadMcDimensionsConfig().enabled && options?.mcDimensionsViewer) {
    try {
      const dimensionsData: PrintReadyDimensions = await captureMcDimensionsFromViewer(
        options.mcDimensionsViewer
      );
      const mcFiles = await exportMCDimensionsForZip(dimensionsData);
      for (const f of mcFiles) {
        zip.file(f.path, f.blob);
      }
    } catch (err) {
      devLogger.error("multiProjectFabrication: MC Dimensions", err);
    }
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  if (!zipBlob || zipBlob.size === 0) {
    throw new Error("multiProjectFabrication: ZIP gerado inválido ou vazio.");
  }

  return {
    zipBlob,
    summary: {
      totalPieces: allPrefixedItems.length,
      projects: projectNames,
    },
  };
    });
  } finally {
    endIndustrialFileGeneration();
    endIndustrialRequiredArtifactTracking();
  }
}
