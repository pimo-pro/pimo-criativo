import { createElement, useCallback, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import JSZip from "jszip";
import { useProject } from "../context/useProject";
import { applyResultados } from "../context/projectState";
import { captureRoomSnapshot, serializeState } from "../context/projectPersistence";
import type { ProjectSnapshot, ProjectState } from "../context/projectTypes";
import { getCurrentProjectUser } from "../core/projects/currentUser";
import { saveProject } from "../core/projects/projectsClient";
import { saveProjectRecord } from "../app/PROJETOS/projetosSnapshotCache";
import { buildProjetosPagePath } from "../app/PROJETOS/projetosPageSlug";
import {
  captureWorkspaceProjectThumbnail,
  uploadProjectThumbnail,
} from "../core/projects/projectThumbnail";
import { getSettings } from "../core/settings/settingsService";
import { listMaterials, listIndustrialMaterialsSnapshot } from "../core/materials/service";
import { buildCutlistItemsForIndustrialExport } from "../core/fabrication/buildCutlistItemsForIndustrialExport";
import {
  terminateIndustrialWorker,
} from "../core/fabrication/industrialWorkerRunner";
import {
  beginIndustrialFileGeneration,
  endIndustrialFileGeneration,
  runAuthorizedIndustrialFileGeneration,
} from "../core/fabrication/industrialGenerationSuspend";
import { measureTime } from "../utils/measureTime";
import { useToast } from "../context/ToastContext";
import { useSettings } from "../context/SettingsContext";
import { gerarPdfTecnicoCompleto } from "../core/pdf/gerarPdfTecnico";
import { buildCutlistPdf } from "../core/pdf/pdfCutlist";
import { buildUnifiedPdf, type UnifiedPdfIndustrialContext } from "../core/pdf/pdfUnified";
import { buildBottomSectionPdfs } from "../core/fabrication/industrialBottomSectionExports";
import { assertFerragensTotaisInExport } from "../core/fabrication/exportProjectFiles";
import { ensureLogoIndustrialLoaded } from "../core/pdf/logoIndustrialPublic";
import { computeConsumoMateriais } from "../core/industrial/computeConsumoMateriais";
import { computeChapasReal } from "../core/industrial/computeChapasReal";
import {
  buildIndustrialArmazemPdf,
  industrialArmazemPdfFileName,
} from "../core/pdf/pdfIndustrialArmazem";
import { resolveIndustrialZipPdf } from "../core/industrial/onlineAnalysis";
import { applyDocumentaryOverridesToCutlistForEtiquetas } from "../core/industrial/onlineAnalysis/applyDocumentaryOverridesToCutlistForEtiquetas";
import { documentHasOverrides } from "../core/industrial/onlineAnalysis/applyIndustrialDocumentOverrides";
import { industrialFeatureFlags } from "../industrial/config/featureFlags";
import { enviarParaFabrica, submitEnviarParaFabrica } from "../core/fabrication/enviarParaFabrica";
import { useComponentTypes } from "./useComponentTypes";
import { useFerragens } from "./useFerragens";
import { useAuth } from "../auth/useAuth";
import { hasFullAccess } from "../auth/rbac";
import { canShowSectionPrices } from "../admin/industrialSectionsConfig";
import { UnifiedEtiquetaEngine } from "../core/etiquetas";
import type { CutlistItemForPieces } from "../core/cutlayout/cutLayoutEngine";
import type { CutListItem, CutListItemComPreco } from "../core/types";
import { buildTcnExportBaseName, getDefaultCncLayoutOptions, getFastCncLayoutOptions } from "../core/cnc/cncPipeline";
import { validateCncExport } from "../industrial/autoCorrection/industrialThicknessAutoCorrection";
import { isIndustrialError } from "../core/industrial/IndustrialError";
import type { ToastMessage } from "../context/ToastContext";
import {
  industrialThicknessEtiquetasPdfFileName,
  industrialThicknessLayoutPdfFileName,
  industrialThicknessEtiquetasPdfPath,
  industrialThicknessLayoutPdfPath,
  industrialThicknessTcnDirPath,
} from "../core/cnc/industrialThicknessGroups";
import {
  buildCncBundlesPerThickness,
  runCutLayoutPerThickness,
} from "../core/fabrication/industrialPerThicknessPipeline";
import { buildIndustrialManifest } from "../core/fabrication/industrialManifest";
import { buildDrillFilesForProject } from "../core/drill/drillExport";
import { devLogger } from "../utils/devLogger";
import { sanitizeZipPath } from "../utils/sanitization";
import { captureMcDimensionsFromViewer } from "../core/industrial/mcDimensions/mcDimensionsCapture";
import { exportMCDimensionsForZip } from "../core/industrial/mcDimensions/mcDimensionsGenerator";
import { loadMcDimensionsConfig } from "../config/mcDimensionsConfig";
import PiLoader from "../components/PiLoader/PiLoader";
import { buildIndustrialFerragensForProject } from "../core/industriais/buildIndustrialFerragensForProject";
import { buildFerragensIndustriaisPdf } from "../core/pdf/pdfFerragensIndustriais";
import {
  industrialFerragensPdfFileName,
  industrialFerragensXlsxFileName,
} from "../core/fabrication/industrialProjectArtifacts";
import { buildFerragensIndustriaisXlsxBuffer } from "../core/xlsx/xlsxFerragensIndustriais";
import {
  assertIndustrialRequiredArtifactsComplete,
  beginIndustrialRequiredArtifactTracking,
  endIndustrialRequiredArtifactTracking,
  IndustrialRequiredArtifactsMissingError,
} from "../core/industrial/industrialOutputGuard";
import { assertExportInvariantsAllowed } from "../core/invariants/integration/invariantContract";
import { InvariantViolationError } from "../core/invariants/errors/InvariantViolationError";
import {
  dispatchIndustrialNotification,
  notifyUser,
  payloadFromIndustrialError,
  payloadFromUnknownError,
  reportExportStepErrors,
} from "../industrial/errors/industrialNotificationBridge";

let cutLayoutLoaderRoot: Root | null = null;

type CutLayoutPdfModule = typeof import("../core/cutlayout/cutLayoutPdf");
type CutLayoutManualPdfModule = typeof import("../core/cutlayout/cutLayoutManualPdf");

/** Import dinâmico com registo em Notificações/Invariantes se o chunk falhar (MIME HTML / 404). */
async function loadCutLayoutPdfModule(step = "PDF Etiquetas / Layout PRO"): Promise<CutLayoutPdfModule> {
  try {
    return await import("../core/cutlayout/cutLayoutPdf");
  } catch (err) {
    const payload = payloadFromUnknownError(err, { step, source: "module" });
    dispatchIndustrialNotification(payload);
    throw err;
  }
}

async function loadCutLayoutManualPdfModule(
  step = "Layout de Corte manual"
): Promise<CutLayoutManualPdfModule> {
  try {
    return await import("../core/cutlayout/cutLayoutManualPdf");
  } catch (err) {
    const payload = payloadFromUnknownError(err, { step, source: "module" });
    dispatchIndustrialNotification(payload);
    throw err;
  }
}

function toastExportError(
  showToast: (text: string, type?: ToastMessage["type"], duration?: number) => void,
  err: unknown,
  fallback: string,
  step = "Exportação industrial"
): void {
  if (err instanceof InvariantViolationError) {
    notifyUser(payloadFromUnknownError(err, { step: "Invariantes", source: "export" }), {
      showToast: (text) => showToast(text, "error", 12000),
    });
    return;
  }
  if (isIndustrialError(err)) {
    notifyUser(payloadFromIndustrialError(err, { step, source: "export" }), {
      showToast: (text) => showToast(text, "error", 12000),
    });
    return;
  }
  const msg = err instanceof Error ? err.message : String(err);
  const payload = payloadFromUnknownError(err, {
    step,
    source: "export",
    severity: "error",
  });
  notifyUser(
    {
      ...payload,
      message: `${fallback}${msg ? ` — ${msg}` : ""}`,
    },
    {
      showToast: (text) => showToast(text, "error", 12000),
    }
  );
}

function guardIndustrialExport(
  project: ProjectState,
  showToast: (text: string, type?: ToastMessage["type"], duration?: number) => void,
  cutList?: CutListItemComPreco[] | CutListItem[]
): boolean {
  try {
    assertExportInvariantsAllowed({
      project,
      cutList: cutList ?? project.cutListComPreco ?? project.cutList,
      phase: "export",
    });
    return true;
  } catch (err) {
    toastExportError(showToast, err, "Exportação bloqueada");
    return false;
  }
}

/** Fase 6: aviso discreto se flag off mas cutlist tem overrides (etiquetas/PDFs ainda reflectem). */
function warnCutlistOverridesWithFlagOff(
  project: ProjectState,
  showToast: (text: string, type?: ToastMessage["type"], duration?: number) => void
): void {
  if (industrialFeatureFlags.industrialOnlineAnalysis) return;
  if (!documentHasOverrides(project.industrialDocumentOverrides, "cutlist")) return;
  showToast(
    "Análise online desligada, mas a cutlist tem edições documentais — PDFs e etiquetas UEE reflectem-nas; CNC/TCN intactos.",
    "warning",
    5200
  );
}

function pushFullExportError(
  errors: Array<{ step: string; message?: string; error?: string }>,
  err: unknown,
  step: string
): void {
  const payload = payloadFromUnknownError(err, { step });
  dispatchIndustrialNotification(payload);
  if (isIndustrialError(err)) {
    errors.push({ step: err.getTitle(), message: err.formatForToast() });
    return;
  }
  const msg = err instanceof Error ? err.message : String(err);
  errors.push({ step, message: msg });
}
let cutLayoutLoaderHost: HTMLDivElement | null = null;

function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function showCutLayoutLoader() {
  if (typeof document === "undefined") return;
  if (!cutLayoutLoaderHost) {
    cutLayoutLoaderHost = document.createElement("div");
    cutLayoutLoaderHost.id = "pimo-cut-layout-loader-root";
    document.body.appendChild(cutLayoutLoaderHost);
    cutLayoutLoaderRoot = createRoot(cutLayoutLoaderHost);
  }
  cutLayoutLoaderRoot!.render(createElement(PiLoader, { isVisible: true }));
}

function hideCutLayoutLoader() {
  if (!cutLayoutLoaderRoot || !cutLayoutLoaderHost) return;
  cutLayoutLoaderRoot.render(createElement(PiLoader, { isVisible: false }));
  const root = cutLayoutLoaderRoot;
  const host = cutLayoutLoaderHost;
  cutLayoutLoaderRoot = null;
  cutLayoutLoaderHost = null;
  queueMicrotask(() => {
    root.unmount();
    host.remove();
  });
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

type LayoutProgressState = {
  visible: boolean;
  percent: number;
  message: string;
  mode: "pro" | "fast";
};

function isMemoryPressureHigh(): boolean {
  try {
    const perf = performance as unknown as {
      memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
    };
    const mem = perf.memory;
    if (!mem || !Number.isFinite(mem.usedJSHeapSize) || !Number.isFinite(mem.jsHeapSizeLimit) || mem.jsHeapSizeLimit <= 0) {
      return false;
    }
    return mem.usedJSHeapSize / mem.jsHeapSizeLimit >= 0.9;
  } catch {
    return false;
  }
}

/**
 * Fonte única de dados para exportação CNC/TCN.
 * Reutilizada pelo fluxo normal de exportação e por fluxos auxiliares (ex.: variantes v1..v6),
 * para garantir mesma cobertura de peças/painéis.
 */
export function buildItemsForCncExport(
  project: {
    rules: unknown;
    materialId?: string;
    projectName?: string;
    remates?: import("../core/remate/rematePieceTypes").RematePiece[];
    rodapes?: import("../core/rodape/rodapeTypes").ProjectRodape[];
    extractedPartsByBoxId?: Record<string, Record<string, unknown[]>>;
    industrialPieceEdits?: import("../core/industrial/industrialPieceEditsTypes").IndustrialPieceEditsStore;
  },
  boxes: Array<{ id: string }>
): Array<Record<string, unknown>> {
  const items = buildCutlistItemsForIndustrialExport({
    boxes: boxes as never[],
    rules: project.rules as never,
    materialId: project.materialId,
    projectName: project.projectName,
    remates: project.remates ?? [],
    rodapes: project.rodapes ?? [],
    extractedPartsByBoxId: project.extractedPartsByBoxId,
    industrialPieceEdits: project.industrialPieceEdits,
  });
  return items as unknown as Array<Record<string, unknown>>;
}

/** Adiciona um PDF ao ZIP apenas se o documento e o blob forem válidos. Retorna true se adicionou. */
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

export function useGerarArquivoHandlers() {
  const { project, viewerSync } = useProject();
  const { settings } = useSettings();
  const { showToast } = useToast();
  const { componentTypes } = useComponentTypes();
  const { ferragens } = useFerragens();
  const { hasPermission } = useAuth();
  const isAdmin = hasFullAccess(hasPermission);
  const abortIndustrialLayoutRef = useRef(false);
  const [layoutProgress, setLayoutProgress] = useState<LayoutProgressState>({
    visible: false,
    percent: 0,
    message: "",
    mode: "pro",
  });
  const boxes = useMemo(() => project.boxes ?? [], [project.boxes]);
  const hasBoxes = boxes.length > 0;
  const slug =
    (project.projectName || "projeto")
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .replace(/\s+/g, "_") || "projeto";
  const tcnSuffix = tcnMethodSuffix(settings?.cnc?.tcnMetodo);

  const pdfProject = useCallback(
    () => ({
      projectName: project.projectName ?? "Projeto",
      boxes,
      rules: project.rules,
      materialId: project.materialId,
      extractedPartsByBoxId: project.extractedPartsByBoxId ?? {},
      settings: settings ?? undefined,
      pieceObservacoes: project.pieceObservacoes ?? {},
      industrialPieceEdits: project.industrialPieceEdits ?? {},
      remates: project.remates ?? [],
      rodapes: project.rodapes ?? [],
      ferragemOrla: project.ferragemOrla,
      financeiroOverrides: project.financeiroOverrides,
      financeiroAdminSettings: project.financeiroAdminSettings,
      orlaPieces: project.orlaPieces,
      orlaPresets: project.orlaPresets,
    }),
    [project, boxes, settings]
  );

  const unifiedIndustrialContext = useCallback((): UnifiedPdfIndustrialContext => {
    return {
      materials: listIndustrialMaterialsSnapshot(),
      componentTypes,
      ferragens,
      showPrices: canShowSectionPrices("resumoFinanceiro", isAdmin),
    };
  }, [componentTypes, ferragens, isAdmin]);

  const prepareItemsForCnc = useCallback(
    <T extends CutlistItemForPieces>(items: T[], materialsSnapshot: ReturnType<typeof listMaterials>): T[] => {
      return validateCncExport(items, materialsSnapshot, { showToast });
    },
    [showToast]
  );

  const cancelIndustrialLayout = useCallback(() => {
    abortIndustrialLayoutRef.current = true;
    terminateIndustrialWorker();
    setLayoutProgress((prev) =>
      prev.visible
        ? { ...prev, message: "Cancelando otimização PRO…" }
        : prev
    );
  }, []);

  const onPdfTecnico = useCallback(async () => {
    if (!hasBoxes) {
      showToast("Nenhuma caixa no projeto. Gere o design primeiro.", "warning");
      return;
    }
    await ensureLogoIndustrialLoaded();
    const proj = pdfProject();
    const full = applyResultados(project as ProjectState);
    const doc = await resolveIndustrialZipPdf(full, "tecnico", () =>
      gerarPdfTecnicoCompleto(proj.boxes, proj.rules, proj.projectName, {
        materialId: proj.materialId,
        extractedPartsByBoxId: proj.extractedPartsByBoxId,
        pieceObservacoes: proj.pieceObservacoes,
      })
    );
    doc.save(`${slug}_tecnico.pdf`);
  }, [hasBoxes, showToast, pdfProject, slug, project]);

  const onCutlist = useCallback(async () => {
    if (!hasBoxes) {
      showToast("Nenhuma caixa no projeto. Gere o design primeiro.", "warning");
      return;
    }
    if (!guardIndustrialExport(project, showToast)) return;
    beginIndustrialFileGeneration();
    try {
      const full = applyResultados(project as ProjectState);
      const doc = await resolveIndustrialZipPdf(full, "cutlist", () => buildCutlistPdf(pdfProject()));
      doc.save(`${slug}_cutlist.pdf`);
    } catch (err) {
      devLogger.error("Erro ao gerar PDF de cutlist:", err);
      showToast("Erro ao gerar PDF.", "error");
    } finally {
      endIndustrialFileGeneration();
    }
  }, [hasBoxes, showToast, pdfProject, slug, project]);

  /** Gera apenas o PDF unificado (técnico + cutlist num único documento). */
  const onUnificado = useCallback(async () => {
    if (!hasBoxes) {
      showToast("Nenhuma caixa no projeto. Gere o design primeiro.", "warning");
      return;
    }
    if (!guardIndustrialExport(project, showToast)) return;
    beginIndustrialFileGeneration();
    try {
      const full = applyResultados(project as ProjectState);
      const doc = await resolveIndustrialZipPdf(full, "unificado", () =>
        buildUnifiedPdf(pdfProject(), unifiedIndustrialContext())
      );
      doc.save(`${slug}_unificado.pdf`);
    } catch (err) {
      devLogger.error("Erro ao gerar PDF unificado:", err);
      showToast("Erro ao gerar PDF unificado.", "error");
    } finally {
      endIndustrialFileGeneration();
    }
  }, [hasBoxes, showToast, pdfProject, slug, project, unifiedIndustrialContext]);

  const onFerragensIndustriais = useCallback(async () => {
    if (!hasBoxes) {
      showToast("Nenhuma caixa no projeto. Gere o design primeiro.", "warning");
      return;
    }
    if (!guardIndustrialExport(project, showToast)) return;
    beginIndustrialFileGeneration();
    try {
      const data = buildIndustrialFerragensForProject({
        projectName: project.projectName,
        boxes,
        rules: project.rules,
        materialId: project.materialId,
        extractedPartsByBoxId: project.extractedPartsByBoxId,
        remates: project.remates ?? [],
        rodapes: project.rodapes ?? [],
        pieceObservacoes: project.pieceObservacoes ?? {},
      });
      const full = applyResultados(project as ProjectState);
      const doc = await resolveIndustrialZipPdf(full, "industrial_ferragens", () =>
        buildFerragensIndustriaisPdf(data)
      );
      doc.save(industrialFerragensPdfFileName(slug));
      showToast("PDF de ferragens industriais gerado.", "info");
    } catch (err) {
      toastExportError(showToast, err, "Erro ao gerar PDF de ferragens industriais");
    } finally {
      endIndustrialFileGeneration();
    }
  }, [hasBoxes, showToast, project, boxes, slug]);

  const onFerragensIndustriaisXlsx = useCallback(async () => {
    if (!hasBoxes) {
      showToast("Nenhuma caixa no projeto. Gere o design primeiro.", "warning");
      return;
    }
    if (!guardIndustrialExport(project, showToast)) return;
    beginIndustrialFileGeneration();
    try {
      const data = buildIndustrialFerragensForProject({
        projectName: project.projectName,
        boxes,
        rules: project.rules,
        materialId: project.materialId,
        extractedPartsByBoxId: project.extractedPartsByBoxId,
        remates: project.remates ?? [],
        rodapes: project.rodapes ?? [],
        pieceObservacoes: project.pieceObservacoes ?? {},
      });
      const buffer = await buildFerragensIndustriaisXlsxBuffer(data);
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = industrialFerragensXlsxFileName(slug);
      a.click();
      URL.revokeObjectURL(url);
      showToast("XLSX de ferragens industriais gerado.", "info");
    } catch (err) {
      toastExportError(showToast, err, "Erro ao gerar XLSX de ferragens industriais");
    } finally {
      endIndustrialFileGeneration();
    }
  }, [hasBoxes, showToast, project, boxes, slug]);

  /** Gera e descarrega os três PDFs em separado: Cutlist, PDF Técnico, Arquivo Unificado. */
  const onAmbos = useCallback(async () => {
    if (!hasBoxes) {
      showToast("Nenhuma caixa no projeto. Gere o design primeiro.", "warning");
      return;
    }
    if (!guardIndustrialExport(project, showToast)) return;
    beginIndustrialFileGeneration();
    try {
      await ensureLogoIndustrialLoaded();
      const proj = pdfProject();
      const full = applyResultados(project as ProjectState);
      const docCutlist = await resolveIndustrialZipPdf(full, "cutlist", () => buildCutlistPdf(proj));
      docCutlist.save(`${slug}_cutlist.pdf`);
      const docTecnico = await resolveIndustrialZipPdf(full, "tecnico", () =>
        gerarPdfTecnicoCompleto(proj.boxes, proj.rules, proj.projectName, {
          materialId: proj.materialId,
          extractedPartsByBoxId: proj.extractedPartsByBoxId,
          pieceObservacoes: proj.pieceObservacoes,
        })
      );
      docTecnico.save(`${slug}_tecnico.pdf`);
      const docUnificado = await resolveIndustrialZipPdf(full, "unificado", () =>
        buildUnifiedPdf(proj, unifiedIndustrialContext())
      );
      docUnificado.save(`${slug}_unificado.pdf`);
      showToast("Cutlist, PDF Técnico e Unificado gerados.", "info");
    } catch (err) {
      devLogger.error("Erro ao gerar PDFs:", err);
      showToast("Erro ao gerar PDFs.", "error");
    } finally {
      endIndustrialFileGeneration();
    }
  }, [hasBoxes, showToast, pdfProject, slug, project, unifiedIndustrialContext]);

  const onEtiquetas = useCallback(async () => {
    if (!hasBoxes) {
      showToast("Nenhuma caixa no projeto. Gere o design primeiro.", "warning");
      return;
    }
    if (!guardIndustrialExport(project, showToast)) return;
    warnCutlistOverridesWithFlagOff(project, showToast);
    beginIndustrialFileGeneration();
    try {
      const proj = pdfProject();
      const allItems = buildCutlistItemsForIndustrialExport({
        boxes,
        rules: project.rules,
        materialId: project.materialId,
        projectName: project.projectName,
        remates: project.remates ?? [],
        rodapes: project.rodapes ?? [],
        extractedPartsByBoxId: project.extractedPartsByBoxId,
        industrialPieceEdits: project.industrialPieceEdits,
      });
      // CNC/nesting: allItems base — nunca applyDocumentaryOverrides aqui
      const settingsSnapshot = getSettings();
      const materialsSnapshot = listMaterials();
      const cncItems = prepareItemsForCnc(allItems as CutlistItemForPieces[], materialsSnapshot);

      const thicknessBundles = await runCutLayoutPerThickness(
        settingsSnapshot,
        materialsSnapshot,
        cncItems,
        getDefaultCncLayoutOptions(),
        {
          projectName: project.projectName ?? "Projeto",
          boxes: proj.boxes ?? boxes,
        }
      );

      if (thicknessBundles.length === 0) {
        showToast("Nenhuma peça com espessura válida para etiquetas.", "warning");
        return;
      }

      for (const bundle of thicknessBundles) {
        const nestingPlacements = bundle.layoutResult.sheets.flatMap((s) => s.placements);
        // Fase 5: merge documental só no ramo UEE (CNC/nesting usaram allItems base)
        const etiquetaItems = applyDocumentaryOverridesToCutlistForEtiquetas(
          bundle.items as CutListItemComPreco[],
          project.industrialDocumentOverrides
        );
        const doc = await UnifiedEtiquetaEngine.build({
          ...proj,
          precomputedItems: etiquetaItems,
          cutLayoutPlacements: nestingPlacements.length > 0 ? nestingPlacements : undefined,
        });
        doc.save(`${slug}_${industrialThicknessEtiquetasPdfFileName(bundle.bucket)}`);
      }
      const cutlistOverridden = documentHasOverrides(
        project.industrialDocumentOverrides,
        "cutlist"
      );
      showToast(
        thicknessBundles.length === 1
          ? cutlistOverridden
            ? "PDF de etiquetas (UEE v5) gerado (com edições documentais da cutlist)."
            : "PDF de etiquetas (UEE v5) gerado."
          : cutlistOverridden
            ? `${thicknessBundles.length} PDFs de etiquetas gerados (com edições documentais da cutlist).`
            : `${thicknessBundles.length} PDFs de etiquetas gerados (um por espessura).`,
        "info"
      );
    } catch (err) {
      devLogger.error("Erro ao gerar PDF de etiquetas:", err);
      toastExportError(showToast, err, "Erro ao gerar PDF de etiquetas.");
    } finally {
      endIndustrialFileGeneration();
    }
  }, [hasBoxes, showToast, pdfProject, slug, boxes, project, prepareItemsForCnc]);

  const onLayoutCorte = useCallback(async () => {
    if (!hasBoxes) {
      showToast("Nenhuma caixa no projeto. Gere o design primeiro.", "warning");
      return;
    }
    if (!guardIndustrialExport(project, showToast)) return;
    beginIndustrialFileGeneration();
    try {
      const allItems = buildCutlistItemsForIndustrialExport({
        boxes,
        rules: project.rules,
        materialId: project.materialId,
        projectName: project.projectName,
        remates: project.remates ?? [],
        rodapes: project.rodapes ?? [],
        extractedPartsByBoxId: project.extractedPartsByBoxId,
        industrialPieceEdits: project.industrialPieceEdits,
      });
      const settingsSnapshot = getSettings();
      const materialsSnapshot = listMaterials();
      const cncItems = prepareItemsForCnc(allItems as CutlistItemForPieces[], materialsSnapshot);

      const thicknessBundles = await buildCncBundlesPerThickness(
        settingsSnapshot,
        materialsSnapshot,
        { projectName: project.projectName ?? "Projeto" },
        cncItems,
        getDefaultCncLayoutOptions()
      );

      if (thicknessBundles.length === 0) {
        showToast("Nenhuma peça com espessura válida para o layout de corte.", "warning");
        return;
      }

      const { buildCutLayoutPdf } = await loadCutLayoutPdfModule("Layout de corte");
      const boxNomeById = Object.fromEntries(boxes.map((b) => [b.id, b.nome ?? ""]));
      for (const bundle of thicknessBundles) {
        const doc = await buildCutLayoutPdf(bundle.cncBundle.layoutResult, {
          projectName: project.projectName ?? "Projeto",
          industrialProjectName: project.projectName ?? "Projeto",
          boxNomeById,
        });
        doc.save(`${slug}_${industrialThicknessLayoutPdfFileName(bundle.bucket)}`);
      }
    } catch (err) {
      devLogger.error("Erro ao gerar layout de corte:", err);
      toastExportError(showToast, err, "Erro ao gerar layout de corte.");
    } finally {
      endIndustrialFileGeneration();
    }
  }, [
    hasBoxes,
    showToast,
    boxes,
    project.rules,
    project.materialId,
    project.projectName,
    project.extractedPartsByBoxId,
    slug,
    prepareItemsForCnc,
  ]);

  /** Handler legado: gera Layout de Corte PRO (distribuição das peças em chapa MDF). */
  const onLayoutCortePro = useCallback(async () => {
    if (!hasBoxes) {
      showToast("Nenhuma caixa no projeto. Gere o design primeiro.", "warning");
      return;
    }
    if (!guardIndustrialExport(project, showToast)) return;
    try {
      showCutLayoutLoader();
      await yieldToMainThread();
      beginIndustrialFileGeneration();
      try {
        viewerSync.setUltraPerformanceMode(true);
      } catch {
        /* ignore */
      }
      const allItems = buildCutlistItemsForIndustrialExport({
        boxes,
        rules: project.rules,
        materialId: project.materialId,
        projectName: project.projectName,
        remates: project.remates ?? [],
        rodapes: project.rodapes ?? [],
        extractedPartsByBoxId: project.extractedPartsByBoxId,
        industrialPieceEdits: project.industrialPieceEdits,
      });

      const settingsSnapshot = getSettings();
      const materialsSnapshot = listMaterials();
      const cncItems = prepareItemsForCnc(allItems as CutlistItemForPieces[], materialsSnapshot);

      await yieldToMainThread();

      const thicknessBundles = await measureTime("Layout de corte PRO (layout CNC por espessura)", async () =>
        buildCncBundlesPerThickness(
          settingsSnapshot,
          materialsSnapshot,
          { projectName: project.projectName ?? "Projeto" },
          cncItems,
          {
            ...getDefaultCncLayoutOptions(),
          }
        )
      );

      if (thicknessBundles.length === 0) {
        showToast("Nenhuma peça com espessura válida para o layout de corte.", "warning");
        return;
      }

      const rejectedTotal = thicknessBundles.reduce((sum, bundle) => {
        const rejected = bundle.layoutResult.diagnostics?.rejectedByLimit?.length ?? 0;
        return sum + rejected;
      }, 0);
      if (rejectedTotal > 0) {
        showToast(
          `Atenção: ${rejectedTotal} peça(s) não couberam no layout e foram omitidas.`,
          "warning"
        );
      }

      await yieldToMainThread();
      const { buildCutLayoutPdf } = await loadCutLayoutPdfModule("Layout de Corte PRO");
      const boxNomeById = Object.fromEntries(boxes.map((b) => [b.id, b.nome ?? ""]));
      for (const bundle of thicknessBundles) {
        const doc = await buildCutLayoutPdf(bundle.cncBundle.layoutResult, {
          projectName: `${project.projectName ?? "Projeto"} — ${bundle.bucket}`,
          industrialProjectName: project.projectName ?? "Projeto",
          boxNomeById,
        });
        doc.save(`${slug}_${industrialThicknessLayoutPdfFileName(bundle.bucket)}`);
      }
      showToast(
        thicknessBundles.length === 1
          ? "Layout de Corte PRO gerado."
          : `${thicknessBundles.length} layouts de corte PRO gerados (um por espessura).`,
        "info"
      );
    } catch (err) {
      devLogger.error("Layout de Corte PRO:", err);
      toastExportError(showToast, err, "Layout de Corte PRO: falha");
    } finally {
      try {
        viewerSync.setUltraPerformanceMode(false);
      } catch {
        /* ignore */
      }
      endIndustrialFileGeneration();
      hideCutLayoutLoader();
    }
  }, [
    hasBoxes,
    showToast,
    boxes,
    project,
    slug,
    viewerSync,
    prepareItemsForCnc,
  ]);

  /** PDF único para marceneiro: nesting + cotas/furos (todas as espessuras). */
  const onLayoutCorteManual = useCallback(async () => {
    if (!hasBoxes) {
      showToast("Nenhuma caixa no projeto. Gere o design primeiro.", "warning");
      return;
    }
    if (!guardIndustrialExport(project, showToast)) return;
    try {
      showCutLayoutLoader();
      await yieldToMainThread();
      beginIndustrialFileGeneration();
      try {
        viewerSync.setUltraPerformanceMode(true);
      } catch {
        /* ignore */
      }
      const allItems = buildCutlistItemsForIndustrialExport({
        boxes,
        rules: project.rules,
        materialId: project.materialId,
        projectName: project.projectName,
        remates: project.remates ?? [],
        rodapes: project.rodapes ?? [],
        extractedPartsByBoxId: project.extractedPartsByBoxId,
        industrialPieceEdits: project.industrialPieceEdits,
      });

      const settingsSnapshot = getSettings();
      const materialsSnapshot = listMaterials();
      const cncItems = prepareItemsForCnc(allItems as CutlistItemForPieces[], materialsSnapshot);

      await yieldToMainThread();

      const thicknessBundles = await measureTime("Layout de corte manual (layout CNC por espessura)", async () =>
        buildCncBundlesPerThickness(
          settingsSnapshot,
          materialsSnapshot,
          { projectName: project.projectName ?? "Projeto" },
          cncItems,
          {
            ...getDefaultCncLayoutOptions(),
          }
        )
      );

      if (thicknessBundles.length === 0) {
        showToast("Nenhuma peça com espessura válida para o layout de corte manual.", "warning");
        return;
      }

      await yieldToMainThread();
      const { buildCutLayoutManualPdf, cutLayoutManualPdfFileName } =
        await loadCutLayoutManualPdfModule("Layout de Corte manual");
      const boxNomeById = Object.fromEntries(boxes.map((b) => [b.id, b.nome ?? ""]));
      const sheets = thicknessBundles.flatMap((bundle) =>
        bundle.cncBundle.layoutResult.sheets.map((sheetResult) => ({
          sheetResult,
          bucket: bundle.bucket,
        }))
      );
      const doc = await buildCutLayoutManualPdf(sheets, {
        projectName: project.projectName ?? "Projeto",
        industrialProjectName: project.projectName ?? "Projeto",
        boxNomeById,
      });
      doc.save(`${slug}_${cutLayoutManualPdfFileName()}`);
      showToast("Layout de Corte manual gerado.", "info");
    } catch (err) {
      devLogger.error("Layout de Corte manual:", err);
      toastExportError(showToast, err, "Layout de Corte manual: falha");
    } finally {
      try {
        viewerSync.setUltraPerformanceMode(false);
      } catch {
        /* ignore */
      }
      endIndustrialFileGeneration();
      hideCutLayoutLoader();
    }
  }, [
    hasBoxes,
    showToast,
    boxes,
    project,
    slug,
    viewerSync,
    prepareItemsForCnc,
  ]);

  const onExportarCnc = useCallback(async () => {
    if (!hasBoxes) {
      showToast("Nenhuma caixa no projeto. Gere o design primeiro.", "warning");
      return;
    }
    if (!guardIndustrialExport(project, showToast)) return;
    showToast("Gerando layout industrial otimizado… aguarde.", "info");
    abortIndustrialLayoutRef.current = false;
    const forceFastMode = false;
    setLayoutProgress({
      visible: true,
      percent: 1,
      message: "Gerando layout industrial otimizado… aguarde.",
      mode: "pro",
    });

    beginIndustrialFileGeneration();
    try {
      viewerSync.setUltraPerformanceMode(true);
    } catch {
      /* ignore */
    }

    try {
      await measureTime("Exportação CNC (projeto único)", async () => {
        const allItems = buildItemsForCncExport(project, boxes) as CutlistItemForPieces[];
        const settingsSnapshot = getSettings();
        const materialsSnapshot = listMaterials();
        const cncItems = prepareItemsForCnc(allItems, materialsSnapshot);

        const cncProjectStub = { projectName: project.projectName ?? "Projeto" };

        const collectFiles = async (mode: "pro" | "fast"): Promise<Array<{ name: string; tcn: string; base: string }>> => {
          if (
            abortIndustrialLayoutRef.current ||
            isMemoryPressureHigh()
          ) {
            const err = new Error("CutLayout aborted");
            err.name = "CutLayoutAbortedError";
            throw err;
          }
          const layoutOptionsBase = mode === "pro" ? getDefaultCncLayoutOptions() : getFastCncLayoutOptions();
          setLayoutProgress((prev) => ({
            ...prev,
            visible: true,
            mode,
            percent: Math.max(prev.percent, 50),
            message: "Gerando layout industrial otimizado… aguarde.",
          }));
          const thicknessBundles = await buildCncBundlesPerThickness(
            settingsSnapshot,
            materialsSnapshot,
            cncProjectStub,
            cncItems,
            layoutOptionsBase
          );
          const rows: Array<{ name: string; tcn: string; base: string }> = [];
          for (const bundle of thicknessBundles) {
            const files = bundle.cncBundle.cnc?.files ?? [];
            if (!files.length) continue;
            const tcnDir = industrialThicknessTcnDirPath(bundle.bucket);
            const usedNames = new Set<string>();
            for (const file of files) {
              const base = buildTcnExportBaseName(
                bundle.cncBundle.layoutResult,
                file.panelIndex,
                files.length
              );
              let finalBase = base;
              let dedupeIndex = 2;
              while (usedNames.has(finalBase)) {
                finalBase = `${base}_${dedupeIndex}`;
                dedupeIndex += 1;
              }
              usedNames.add(finalBase);
              rows.push({
                name: `${tcnDir}/${finalBase}_cnc_${tcnSuffix}.tcn`,
                tcn: file.tcn,
                base: file.filenameBase,
              });
            }
          }
          return rows;
        };

        let rows: Array<{ name: string; tcn: string; base: string }> = [];
        if (forceFastMode) {
          rows = await collectFiles("fast");
        } else {
          try {
            rows = await collectFiles("pro");
          } catch (err) {
            const name = (err as { name?: string })?.name;
            const shouldFallback =
              name === "CutLayoutAbortedError" ||
              abortIndustrialLayoutRef.current ||
              isMemoryPressureHigh();
            if (!shouldFallback) throw err;
            setLayoutProgress({
              visible: true,
              percent: 40,
              message: "Layout PRO cancelado. A gerar modo rápido…",
              mode: "fast",
            });
            showToast("Layout PRO interrompido. A usar Fast Mode.", "warning");
            rows = await collectFiles("fast");
          }
        }

        if (rows.length === 0) {
          showToast("Nenhuma peça na cutlist para exportar CNC.", "warning");
          return;
        }
        const urls: string[] = [];
        for (const row of rows) {
          const tcnBlob = new Blob([row.tcn], { type: "text/plain" });
          const tcnUrl = URL.createObjectURL(tcnBlob);
          urls.push(tcnUrl);
          const link1 = document.createElement("a");
          link1.href = tcnUrl;
          link1.download = row.name;
          link1.click();
        }
        setTimeout(() => urls.forEach((u) => URL.revokeObjectURL(u)), 500);
        setLayoutProgress({
          visible: true,
          percent: 100,
          message: "Layout concluído. A transferir ficheiros…",
          mode: abortIndustrialLayoutRef.current ? "fast" : "pro",
        });
        setTimeout(() => {
          setLayoutProgress({ visible: false, percent: 0, message: "", mode: "pro" });
        }, 700);
      });
    } catch (err) {
      toastExportError(showToast, err, "Falha na exportação CNC");
      setLayoutProgress({ visible: false, percent: 0, message: "", mode: "pro" });
    } finally {
      try {
        viewerSync.setUltraPerformanceMode(false);
      } catch {
        /* ignore */
      }
      endIndustrialFileGeneration();
    }
  }, [hasBoxes, showToast, project, boxes, tcnSuffix, viewerSync, prepareItemsForCnc]);

  /** TCN (via fluxo existente) + XML de furação; só orquestração, mesmas funções de export. */
  const onArquivosCnc = useCallback(async () => {
    if (!hasBoxes) return;
    if (!guardIndustrialExport(project, showToast)) return;
    await onExportarCnc();
    try {
      await runAuthorizedIndustrialFileGeneration("txml", async () => {
        const allItems = buildCutlistItemsForIndustrialExport({
          boxes,
          rules: project.rules,
          materialId: project.materialId,
          projectName: project.projectName,
          remates: project.remates ?? [],
          rodapes: project.rodapes ?? [],
          extractedPartsByBoxId: project.extractedPartsByBoxId,
        });
        const drillFiles = buildDrillFilesForProject(allItems, {
          projectName: project.projectName ?? "Projeto",
          boxes: boxes ?? [],
          rules: project.rules,
        });
        if (drillFiles.length === 0) {
          showToast("Nenhum ficheiro XML de furação para exportar.", "info");
          return;
        }
        const urls: string[] = [];
        for (const f of drillFiles) {
          const blob = new Blob([f.xml], { type: "application/xml" });
          const url = URL.createObjectURL(blob);
          urls.push(url);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${f.filenameBase}.xml`;
          a.click();
        }
        setTimeout(() => urls.forEach((u) => URL.revokeObjectURL(u)), 500);
        const nCnc = drillFiles.filter((f) => f.machineTarget === "cnc").length;
        const nDrill = drillFiles.filter((f) => f.machineTarget === "drill").length;
        const nCompleto = drillFiles.filter((f) => f.machineTarget === "completo").length;
        showToast(`XML gerado: ${nCnc} CNC + ${nDrill} DRILL + ${nCompleto} COMPLETO.`, "info");
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Falha ao gerar XML: ${msg}`, "error");
    }
  }, [onExportarCnc, hasBoxes, boxes, project, showToast]);

  /** Gera todos os arquivos disponíveis, coloca numa pasta (ZIP) e descarrega. */
  const onArquivoCompleto = useCallback(async () => {
    let redirectProjectPagePath: string | null = null;

    try {
      if (!hasBoxes) {
        showToast("Nenhuma caixa no projeto. Gere o design primeiro.", "warning");
        return;
      }

      if (!guardIndustrialExport(project, showToast)) return;
      warnCutlistOverridesWithFlagOff(project, showToast);

      try {
        viewerSync.setUltraPerformanceMode(true);
      } catch {
        /* ignore */
      }

      await runAuthorizedIndustrialFileGeneration("all", async () =>
      measureTime("Arquivo completo (ZIP)", async () => {
      type StepError = { step: string; message?: string; error?: string; detail?: string };
      const errors: StepError[] = [];
      const zip = new JSZip();
      const proj = pdfProject();
      const tcnManifestFiles: Array<{ path: string; content: string }> = [];
      let abortFullExport = false;
      beginIndustrialRequiredArtifactTracking();
      try {
      // --- Snapshot final → cache PROJETOS (antes de PDFs/ZIP) ---
      try {
        const currentUser = getCurrentProjectUser();
        const stateForSnapshot = applyResultados(project as ProjectState);
        const persistedSnapshot: ProjectSnapshot = {
          projectState: serializeState(stateForSnapshot),
          viewerSnapshot: viewerSync.saveViewerSnapshot(),
          roomSnapshot: captureRoomSnapshot(stateForSnapshot.room),
        };
        const saved = await saveProject({
          name: stateForSnapshot.projectName ?? project.projectName ?? "Projeto",
          ownerId: currentUser.ownerId,
          ownerName: currentUser.ownerName,
          snapshot: persistedSnapshot,
          localProjectId: project.currentProjectId ?? undefined,
        });
        const internalProjectId = saved?.id ?? project.currentProjectId ?? null;
        const projectName =
          saved?.name ?? stateForSnapshot.projectName ?? project.projectName ?? "Projeto";
        if (internalProjectId) {
          await saveProjectRecord(internalProjectId, persistedSnapshot, {
            ...(saved ?? {}),
            name: projectName,
          });
          redirectProjectPagePath = buildProjetosPagePath({ name: projectName });

          if (typeof viewerSync.renderScene === "function") {
            const thumbBlob = await captureWorkspaceProjectThumbnail((opts) =>
              viewerSync.renderScene!(opts)
            );
            // Só POST thumb depois do save e com imagem realmente gerada
            if (thumbBlob && thumbBlob.size > 0) {
              await uploadProjectThumbnail(projectName, thumbBlob);
            }
          }
        }
      } catch (err) {
        devLogger.warn("PROJETOS: falha ao guardar snapshot antes do arquivo completo", err);
      }

      const allItems = buildCutlistItemsForIndustrialExport({
        boxes,
        rules: project.rules,
        materialId: project.materialId,
        projectName: project.projectName,
        remates: project.remates ?? [],
        rodapes: project.rodapes ?? [],
        extractedPartsByBoxId: project.extractedPartsByBoxId,
        industrialPieceEdits: project.industrialPieceEdits,
      });

      const settingsSnapshot = getSettings();
      const materialsSnapshot = listMaterials();
      const cncProjectStub = { projectName: project.projectName ?? "Projeto" };

      const safeSlug = sanitizeZipPath(slug) || "projeto";
      await ensureLogoIndustrialLoaded();
      const fullProjectState = applyResultados(project as ProjectState);

      // --- Cutlist PDF ---
      try {
        const docCutlist = await resolveIndustrialZipPdf(fullProjectState, "cutlist", () =>
          buildCutlistPdf(proj)
        );
        if (!safeAddPdf(zip, `${safeSlug}_cutlist.pdf`, docCutlist)) {
          errors.push({ step: "Cutlist PDF", message: "Documento ou blob inválido." });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ step: "Cutlist PDF", message: msg });
        devLogger.error("Full export: Cutlist PDF", err);
      }

      // --- PDF Técnico ---
      try {
        const docTecnico = await resolveIndustrialZipPdf(fullProjectState, "tecnico", () =>
          gerarPdfTecnicoCompleto(proj.boxes, proj.rules, proj.projectName, {
            materialId: proj.materialId,
            extractedPartsByBoxId: proj.extractedPartsByBoxId,
            pieceObservacoes: proj.pieceObservacoes,
          })
        );
        if (!safeAddPdf(zip, `${safeSlug}_tecnico.pdf`, docTecnico)) {
          errors.push({ step: "PDF Técnico", message: "Documento ou blob inválido." });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ step: "PDF Técnico", message: msg });
        devLogger.error("Full export: PDF Técnico", err);
      }

      // --- Unificado ---
      try {
        const docUnificado = await resolveIndustrialZipPdf(fullProjectState, "unificado", () =>
          buildUnifiedPdf(proj, unifiedIndustrialContext())
        );
        if (!safeAddPdf(zip, `${safeSlug}_unificado.pdf`, docUnificado)) {
          errors.push({ step: "PDF Unificado", message: "Documento ou blob inválido." });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ step: "PDF Unificado", message: msg });
        devLogger.error("Full export: PDF Unificado", err);
      }

      // --- Ferragens Industriais ---
      try {
        const ferragensData = buildIndustrialFerragensForProject({
          projectName: proj.projectName,
          boxes: proj.boxes,
          rules: proj.rules,
          materialId: proj.materialId,
          extractedPartsByBoxId: proj.extractedPartsByBoxId,
          remates: project.remates ?? [],
          rodapes: project.rodapes ?? [],
          pieceObservacoes: proj.pieceObservacoes,
        });
        const docFerragens = await resolveIndustrialZipPdf(
          fullProjectState,
          "industrial_ferragens",
          () => buildFerragensIndustriaisPdf(ferragensData)
        );
        if (!safeAddPdf(zip, industrialFerragensPdfFileName(safeSlug), docFerragens)) {
          errors.push({ step: "PDF Ferragens Industriais", message: "Documento ou blob inválido." });
        }
        const xlsxBuffer = await buildFerragensIndustriaisXlsxBuffer(ferragensData);
        if (!safeAddXlsx(zip, industrialFerragensXlsxFileName(safeSlug), xlsxBuffer)) {
          errors.push({ step: "XLSX Ferragens Industriais", message: "Ficheiro XLSX inválido." });
        }
        assertIndustrialRequiredArtifactsComplete();
      } catch (err) {
        if (err instanceof IndustrialRequiredArtifactsMissingError) {
          errors.push({
            step: "Ferragens Industriais",
            message: `Artefactos obrigatórios em falta: ${err.missing.join(", ")}`,
          });
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push({ step: "Ferragens Industriais", message: msg });
        }
        devLogger.error("Full export: Ferragens Industriais", err);
      }

      // --- PDFs industriais por secção (BottomInfoToolbar) ---
      try {
        const bottomPdfs = await buildBottomSectionPdfs({
          project: {
            projectName: proj.projectName,
            boxes: proj.boxes,
            rules: proj.rules,
            materialId: proj.materialId,
            extractedPartsByBoxId: proj.extractedPartsByBoxId,
            remates: project.remates ?? [],
            rodapes: project.rodapes ?? [],
            pieceObservacoes: proj.pieceObservacoes,
            industrialPieceEdits: project.industrialPieceEdits,
            ferragemOrla: project.ferragemOrla,
            orlaPresets: project.orlaPresets,
            orlaPieces: project.orlaPieces,
            financeiroOverrides: project.financeiroOverrides,
            financeiroAdminSettings: project.financeiroAdminSettings,
          },
          materials: listIndustrialMaterialsSnapshot(),
          componentTypes,
          ferragens,
          showPrices: canShowSectionPrices("resumoFinanceiro", isAdmin),
        });
        // Lista oficial: ferragens_totais e industrial_armazem coexistem (nao se substituem).
        const expectedFerragensTotais = assertFerragensTotaisInExport(proj.projectName ?? safeSlug);

        const resumoDoc = await resolveIndustrialZipPdf(
          fullProjectState,
          "resumo_financeiro",
          () => bottomPdfs.resumoFinanceiro
        );
        const pecasDoc = await resolveIndustrialZipPdf(fullProjectState, "pecas_totais", () =>
          bottomPdfs.pecasTotais
        );
        const ferragensTotaisDoc = await resolveIndustrialZipPdf(
          fullProjectState,
          "ferragens_totais",
          () => bottomPdfs.ferragensTotais
        );
        const totaisDoc = await resolveIndustrialZipPdf(fullProjectState, "totais_projeto", () =>
          bottomPdfs.totaisProjeto
        );

        const bottomEntries: Array<[string, typeof resumoDoc]> = [
          [bottomPdfs.fileNames.resumoFinanceiro, resumoDoc],
          [bottomPdfs.fileNames.pecasTotais, pecasDoc],
          [bottomPdfs.fileNames.ferragensTotais || expectedFerragensTotais, ferragensTotaisDoc],
          [bottomPdfs.fileNames.totaisProjeto, totaisDoc],
        ];
        for (const [name, doc] of bottomEntries) {
          if (!safeAddPdf(zip, name, doc)) {
            errors.push({ step: `PDF ${name}`, message: "Documento inválido." });
          }
        }

        const consumoSummary = computeConsumoMateriais(
          allItems,
          listIndustrialMaterialsSnapshot(),
          proj.projectName ?? safeSlug,
          boxes
        );
        const chapasReal = computeChapasReal(allItems, proj.projectName ?? safeSlug, boxes);
        const armazemPdf = await resolveIndustrialZipPdf(
          fullProjectState,
          "industrial_armazem",
          () => buildIndustrialArmazemPdf(proj.projectName ?? safeSlug, chapasReal, consumoSummary)
        );
        if (!safeAddPdf(zip, industrialArmazemPdfFileName(safeSlug), armazemPdf)) {
          errors.push({ step: "PDF industrial_armazem", message: "Documento inválido." });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ step: "PDFs secções industriais", message: msg });
        devLogger.error("Full export: PDFs secções industriais", err);
      }

      // --- Nesting por espessura (fonte única CNC para Layout PRO + Etiquetas + TCN) ---
      let thicknessCncBundles: Awaited<ReturnType<typeof buildCncBundlesPerThickness>> = [];
      try {
        const cncItemsForLayout = prepareItemsForCnc(allItems as CutlistItemForPieces[], materialsSnapshot);
        showCutLayoutLoader();
        await yieldToMainThread();
        thicknessCncBundles = await buildCncBundlesPerThickness(
          settingsSnapshot,
          materialsSnapshot,
          cncProjectStub,
          cncItemsForLayout,
          {
            ...getDefaultCncLayoutOptions(),
          }
        );
      } catch (err) {
        pushFullExportError(errors, err, "Nesting por espessura");
        devLogger.error("Full export: Nesting por espessura", err);
      } finally {
        hideCutLayoutLoader();
      }

      // --- Etiquetas UEE (um PDF por espessura em cnc/<espessura>/) ---
      // Nesting/CNC usam thicknessCncBundles.items base; merge documental só aqui (Fase 5).
      try {
        const { buildCutLayoutPdf } = await loadCutLayoutPdfModule(
          "PDF Etiquetas / Layout PRO (arquivo completo)"
        );
        const boxNomeById = Object.fromEntries(boxes.map((b) => [b.id, b.nome ?? ""]));
        for (const bundle of thicknessCncBundles) {
          const layoutResult = bundle.cncBundle.layoutResult;
          const nestingPlacements = layoutResult.sheets.flatMap((s) => s.placements);
          const etiquetaItems = applyDocumentaryOverridesToCutlistForEtiquetas(
            bundle.items as CutListItemComPreco[],
            (project as ProjectState).industrialDocumentOverrides
          );
          const docEtiquetas = await UnifiedEtiquetaEngine.build({
            ...proj,
            precomputedItems: etiquetaItems,
            cutLayoutPlacements: nestingPlacements.length > 0 ? nestingPlacements : undefined,
          });
          const etiquetasPath = industrialThicknessEtiquetasPdfPath(bundle.bucket);
          if (!safeAddPdf(zip, etiquetasPath, docEtiquetas)) {
            errors.push({
              step: `PDF Etiquetas (${bundle.bucket})`,
              message: "Documento ou blob inválido.",
            });
          }

          const docLayout = await buildCutLayoutPdf(layoutResult, {
            projectName: `${project.projectName ?? "Projeto"} — ${bundle.bucket}`,
            industrialProjectName: project.projectName ?? "Projeto",
            boxNomeById,
          });
          const layoutPath = industrialThicknessLayoutPdfPath(bundle.bucket);
          if (!safeAddPdf(zip, layoutPath, docLayout)) {
            errors.push({
              step: `Layout de Corte PRO (${bundle.bucket})`,
              message: "Falha ao adicionar PDF ao ZIP.",
            });
          }
        }

        // Layout de Corte manual — PDF único com todas as chapas/espessuras
        const { buildCutLayoutManualPdf, cutLayoutManualPdfFileName } =
          await loadCutLayoutManualPdfModule("Layout de Corte manual (arquivo completo)");
        const manualSheets = thicknessCncBundles.flatMap((bundle) =>
          bundle.cncBundle.layoutResult.sheets.map((sheetResult) => ({
            sheetResult,
            bucket: bundle.bucket,
          }))
        );
        if (manualSheets.length > 0) {
          const docManual = await buildCutLayoutManualPdf(manualSheets, {
            projectName: project.projectName ?? "Projeto",
            industrialProjectName: project.projectName ?? "Projeto",
            boxNomeById,
          });
          if (!safeAddPdf(zip, cutLayoutManualPdfFileName(), docManual)) {
            errors.push({
              step: "Layout de Corte manual",
              message: "Falha ao adicionar PDF ao ZIP.",
            });
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ step: "PDF Etiquetas / Layout PRO", message: msg });
        devLogger.error("Full export: Etiquetas / Layout PRO por espessura", err);
      }

      // --- CNC (TCN): um nesting por espessura ---
      try {
        if (thicknessCncBundles.length === 0) {
          abortFullExport = true;
          throw new Error("Nenhum layout CNC disponível para gerar TCN.");
        }
        const usedTcnNamesByPath = new Set<string>();
        let tcnFilesAdded = 0;
        for (const bundle of thicknessCncBundles) {
          const files = bundle.cncBundle.cnc?.files ?? [];
          for (const file of files) {
            if (!file || file.tcn == null) {
              errors.push({
                step: "CNC",
                message: `Painel ${file?.panelIndex ?? "?"} sem TCN (${bundle.bucket}).`,
              });
              continue;
            }
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
        if (allItems.length > 0 && tcnFilesAdded === 0) {
          errors.push({ step: "CNC (TCN)", message: "Nenhum ficheiro TCN foi gerado." });
        }
      } catch (err) {
        pushFullExportError(errors, err, "CNC (TCN)");
        devLogger.error("Full export: CNC", err);
      }

      // --- Manifesto de proteção dos TCNs (não altera conteúdo dos .tcn) ---
      try {
        if (tcnManifestFiles.length > 0) {
          const manifest = await buildIndustrialManifest(tcnManifestFiles);
          zip.file("manifest-industrial.json", JSON.stringify(manifest, null, 2));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ step: "Manifesto Industrial", message: msg });
        devLogger.error("Full export: manifest-industrial", err);
      }

      // --- MC Dimensions (overlay técnico — pipeline independente) ---
      if (!abortFullExport && loadMcDimensionsConfig().enabled) {
        try {
          const dimensionsData = await captureMcDimensionsFromViewer({
            getPrintReadyDimensions: () => viewerSync.getPrintReadyDimensions?.() ?? { entries: [], generatedAt: Date.now() },
            setDimensionsOverlayVisible: viewerSync.setDimensionsOverlayVisible,
            getDimensionsOverlayVisible: viewerSync.getDimensionsOverlayVisible,
            renderScene: (opts) =>
              viewerSync.renderScene(opts as unknown as Parameters<typeof viewerSync.renderScene>[0]),
          });
          const mcFiles = await exportMCDimensionsForZip(dimensionsData);
          for (const f of mcFiles) {
            zip.file(f.path, f.blob);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push({ step: "MC Dimensions", message: msg });
          devLogger.error("Full export: MC Dimensions", err);
        }
      }

      // --- XML CNC + DRILL: pastas separadas ---
      if (!abortFullExport) {
        try {
          const xmlFiles = buildDrillFilesForProject(allItems, {
            projectName: project.projectName ?? "Projeto",
            boxes: boxes ?? [],
            rules: project.rules,
          });
          for (const f of xmlFiles) {
            zip.file(f.zipPath, f.xml);
          }
        } catch (err) {
          errors.push({ step: "XML CNC/DRILL", error: String(err) });
        }
      }

      // --- Gerar e descarregar ZIP ---
      if (!abortFullExport) {
        try {
          assertIndustrialRequiredArtifactsComplete();
          const fabricaProject = {
            projectName: proj.projectName,
            currentProjectId: project.currentProjectId,
            boxes: proj.boxes,
            rules: proj.rules,
            materialId: proj.materialId,
            remates: project.remates ?? [],
            rodapes: project.rodapes ?? [],
            extractedPartsByBoxId: proj.extractedPartsByBoxId,
            pieceObservacoes: proj.pieceObservacoes,
            industrialPieceEdits: project.industrialPieceEdits,
            industrialOperacoes: project.industrialOperacoes,
          };
          const materialsSnapshot = listIndustrialMaterialsSnapshot();
          const fabricaCheck = enviarParaFabrica(
            fabricaProject,
            Object.keys(zip.files),
            materialsSnapshot
          );
          if (!fabricaCheck.ok) {
            devLogger.warn("enviarParaFabrica: artefactos em falta", fabricaCheck.missing);
          } else if (fabricaCheck.payload) {
            devLogger.info("enviarParaFabrica: payload preparado", {
              pecas: fabricaCheck.payload.pecas.length,
              caixas: fabricaCheck.payload.caixas.length,
            });
            const submitResult = await submitEnviarParaFabrica(fabricaProject, materialsSnapshot, {
              skipArtifactValidation: true,
            });
            if (submitResult.submit?.ok) {
              devLogger.info("enviarParaFabrica: ordem enviada ao PIMO TRAK", {
                orderId: submitResult.submit.orderId,
              });
            } else if (submitResult.submit?.error) {
              devLogger.warn("enviarParaFabrica: falha no envio TRAK", submitResult.submit.error);
            }
          }
          const blob = await zip.generateAsync({ type: "blob" });
          if (!blob || blob.size === 0) {
            errors.push({ step: "ZIP", message: "ZIP gerado está vazio ou inválido." });
          } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${safeSlug}_completo.zip`;
            a.click();
            URL.revokeObjectURL(url);
          }
        } catch (err) {
          if (err instanceof IndustrialRequiredArtifactsMissingError) {
            errors.push({
              step: "ZIP",
              message: `Artefactos industriais obrigatórios em falta: ${err.missing.join(", ")}`,
            });
          } else {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push({ step: "ZIP (generateAsync)", message: msg });
          }
          devLogger.error("Full export: zip.generateAsync", err);
        }
      }

      if (errors.length > 0) {
        const first = errors[0];
        const detail = `${first.step}: ${first.message ?? first.error ?? "Erro desconhecido"}`;
        devLogger.error("Erro ao gerar arquivo completo:", errors);
        reportExportStepErrors(errors, {
          showToast: undefined,
          projectName: project.projectName ?? slug,
        });
        showToast(`Erro ao gerar arquivo completo — ${detail}`, "error");
      } else {
        showToast("Arquivo completo (ZIP) gerado.", "info");
        if (redirectProjectPagePath && typeof window !== "undefined") {
          window.location.href = redirectProjectPagePath;
        }
      }
      } finally {
        endIndustrialRequiredArtifactTracking();
      }
      }));
    } catch (err) {
      devLogger.error("Arquivo completo: falha global", err);
      toastExportError(showToast, err, "Erro ao gerar arquivo completo");
    } finally {
      try {
        viewerSync.setUltraPerformanceMode(false);
      } catch {
        /* ignore */
      }
    }
  }, [
    hasBoxes,
    showToast,
    pdfProject,
    slug,
    boxes,
    project,
    tcnSuffix,
    viewerSync,
    prepareItemsForCnc,
  ]);

  return {
    hasBoxes,
    layoutProgress,
    cancelIndustrialLayout,
    onPdfTecnico,
    onCutlist,
    onUnificado,
    onFerragensIndustriais,
    onFerragensIndustriaisXlsx,
    onAmbos,
    onArquivoCompleto,
    onLayoutCorte,
    onLayoutCortePro,
    onLayoutCorteManual,
    onEtiquetas,
    onExportarCnc,
    onArquivosCnc,
  };
}
