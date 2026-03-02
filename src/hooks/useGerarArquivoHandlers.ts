import { useCallback } from "react";
import { useProject } from "../context/useProject";
import { useToast } from "../context/ToastContext";
import { useSettings } from "../context/SettingsContext";
import { cutlistComPrecoFromBoxes } from "../core/manufacturing/cutlistFromBoxes";
import { buildTechnicalPdf } from "../core/pdf/pdfTechnical";
import { buildCutlistPdf } from "../core/pdf/pdfCutlist";
import { buildUnifiedPdf } from "../core/pdf/pdfUnified";
import { buildEtiquetasPdf } from "../core/pdf/pdfEtiquetas";
import { runCutLayout, cutlistToPieces } from "../core/cutlayout/cutLayoutEngine";
import {
  buildCncFromCutlistItems,
  getSheetDefinitionFromSettings,
} from "../core/cnc/cncPipeline";
import type { GerarArquivoConteudo } from "../components/layout/right-panel/GerarArquivoModal";

export function useGerarArquivoHandlers() {
  const { project, actions } = useProject();
  useSettings();
  const { showToast } = useToast();
  const boxes = project.boxes ?? [];
  const hasBoxes = boxes.length > 0;
  const slug =
    (project.projectName || "projeto")
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .replace(/\s+/g, "_") || "projeto";

  const pdfProject = useCallback(
    () => ({
      projectName: project.projectName ?? "Projeto",
      boxes,
      rules: project.rules,
      materialId: project.materialId,
      extractedPartsByBoxId: project.extractedPartsByBoxId ?? {},
    }),
    [project, boxes]
  );

  const handleGerarArquivoConfirm = useCallback(
    async (opcoes: { conteudo: GerarArquivoConteudo; download: boolean }) => {
      if (!opcoes.download || !hasBoxes) return;
      if (opcoes.conteudo === "cutlist") {
        await actions.exportarPDF();
        return;
      }
      if (opcoes.conteudo === "tecnico") {
        actions.exportarPdfTecnico();
        return;
      }
      if (opcoes.conteudo === "ambos") {
        await actions.exportarPDF();
        actions.exportarPdfTecnico();
        await actions.exportarPdfUnificado();
      }
    },
    [hasBoxes, actions]
  );

  const onPdfTecnico = useCallback(() => {
    if (!hasBoxes) {
      showToast("Nenhuma caixa no projeto. Gere o design primeiro.", "warning");
      return;
    }
    const doc = buildTechnicalPdf(pdfProject());
    doc.save(`${slug}_tecnico.pdf`);
  }, [hasBoxes, showToast, pdfProject, slug]);

  const onCutlist = useCallback(async () => {
    if (!hasBoxes) {
      showToast("Nenhuma caixa no projeto. Gere o design primeiro.", "warning");
      return;
    }
    try {
      const doc = await buildCutlistPdf(pdfProject());
      doc.save(`${slug}_cutlist.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF de cutlist:", err);
      showToast("Erro ao gerar PDF.", "error");
    }
  }, [hasBoxes, showToast, pdfProject, slug]);

  const onAmbos = useCallback(async () => {
    if (!hasBoxes) {
      showToast("Nenhuma caixa no projeto. Gere o design primeiro.", "warning");
      return;
    }
    try {
      const doc = await buildUnifiedPdf(pdfProject());
      doc.save(`${slug}_completo.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF unificado:", err);
      showToast("Erro ao gerar PDF.", "error");
    }
  }, [hasBoxes, showToast, pdfProject, slug]);

  const onEtiquetas = useCallback(async () => {
    if (!hasBoxes) {
      showToast("Nenhuma caixa no projeto. Gere o design primeiro.", "warning");
      return;
    }
    try {
      const doc = await buildEtiquetasPdf(pdfProject());
      doc.save(`${slug}_etiquetas.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF de etiquetas:", err);
      showToast("Erro ao gerar PDF.", "error");
    }
  }, [hasBoxes, showToast, pdfProject, slug]);

  const onLayoutCorte = useCallback(async () => {
    if (!hasBoxes) {
      showToast("Nenhuma caixa no projeto. Gere o design primeiro.", "warning");
      return;
    }
    const parametric = cutlistComPrecoFromBoxes(
      boxes,
      project.rules,
      project.materialId,
      project.projectName
    );
    const extracted = boxes.flatMap((b) =>
      Object.values(project.extractedPartsByBoxId?.[b.id] ?? {}).flat()
    );
    const allItems = [...parametric, ...extracted].map((p) => ({
      ...p,
      boxId: p.boxId ?? "",
    }));
    const pieces = cutlistToPieces(allItems);
    if (pieces.length === 0) {
      showToast("Nenhuma peça na cutlist para o layout de corte.", "warning");
      return;
    }
    const result = runCutLayout(pieces, getSheetDefinitionFromSettings(), {
      rotationPreferenceMode: "aggressive",
      rotationWeight: 0.8,
      rotationPenalty: 0.45,
    });
    const { buildCutLayoutPdf } = await import(
      "../core/cutlayout/cutLayoutPdf"
    );
    const doc = buildCutLayoutPdf(result);
    doc.save(`${slug}_layout_corte.pdf`);
  }, [
    hasBoxes,
    showToast,
    boxes,
    project.rules,
    project.materialId,
    project.projectName,
    project.extractedPartsByBoxId,
    slug,
  ]);

  const onExportarCnc = useCallback(async () => {
    if (!hasBoxes) {
      showToast("Nenhuma caixa no projeto. Gere o design primeiro.", "warning");
      return;
    }
    const parametric = cutlistComPrecoFromBoxes(
      boxes,
      project.rules,
      project.materialId,
      project.projectName
    );
    const extracted = boxes.flatMap((b) =>
      Object.values(project.extractedPartsByBoxId?.[b.id] ?? {}).flat()
    );
    const allItems = [...parametric, ...extracted].map((p) => ({
      ...p,
      boxId: p.boxId ?? "",
    }));
    const cncBundle = buildCncFromCutlistItems(project, allItems);
    if (!cncBundle) {
      showToast("Nenhuma peça na cutlist para exportar CNC.", "warning");
      return;
    }
    const cnc = cncBundle.cnc;
    const urls: string[] = [];
    for (const file of cnc.files) {
      const base = file.filenameBase || `${slug}_panel_${file.panelIndex}`;
      const tcnBlob = new Blob([file.tcn], { type: "text/plain" });
      const kdtBlob = new Blob([file.kdt], { type: "text/xml" });
      const tcnUrl = URL.createObjectURL(tcnBlob);
      const kdtUrl = URL.createObjectURL(kdtBlob);
      urls.push(tcnUrl, kdtUrl);
      const link1 = document.createElement("a");
      link1.href = tcnUrl;
      link1.download = `${base}.tcn`;
      link1.click();
      const link2 = document.createElement("a");
      link2.href = kdtUrl;
      link2.download = `${base}.kdt`;
      link2.click();
    }
    setTimeout(() => urls.forEach((u) => URL.revokeObjectURL(u)), 500);
  }, [
    hasBoxes,
    showToast,
    project,
    boxes,
    slug,
  ]);

  return {
    hasBoxes,
    handleGerarArquivoConfirm,
    onPdfTecnico,
    onCutlist,
    onAmbos,
    onLayoutCorte,
    onEtiquetas,
    onExportarCnc,
  };
}
