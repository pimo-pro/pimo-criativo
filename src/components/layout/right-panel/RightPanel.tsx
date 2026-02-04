import { useState } from "react";
import { useProject } from "../../../context/useProject";
import {
  cutlistComPrecoFromBoxes,
} from "../../../core/manufacturing/cutlistFromBoxes";
import { buildTechnicalPdf } from "../../../core/pdf/pdfTechnical";
import { buildCutlistPdf } from "../../../core/pdf/pdfCutlist";
import { buildUnifiedPdf } from "../../../core/pdf/pdfUnified";
import { runCutLayout, cutlistToPieces } from "../../../core/cutlayout/cutLayoutEngine";
import type { GerarArquivoConteudo } from "./GerarArquivoModal";
import GerarArquivoModal from "./GerarArquivoModal";

export default function RightPanel() {
  const { project, actions } = useProject();
  const selectedId = project.selectedWorkspaceBoxId;
  const workspaceBoxes = project.workspaceBoxes;
  const boxes = project.boxes ?? [];
  const hasBoxes = boxes.length > 0;
  const slug = (project.projectName || "projeto").replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s+/g, "_") || "projeto";
  const [showGerarArquivoModal, setShowGerarArquivoModal] = useState(false);

  const handleGerarArquivoConfirm = (opcoes: { conteudo: GerarArquivoConteudo; download: boolean }) => {
  if (!opcoes.download || !hasBoxes) return;

  if (opcoes.conteudo === "cutlist") {
    actions.exportarPDF();
    return;
  }

  if (opcoes.conteudo === "tecnico") {
    actions.exportarPdfTecnico();
    return;
  }

  if (opcoes.conteudo === "ambos") {
    actions.exportarPDF();
    actions.exportarPdfTecnico();
    actions.exportarPdfUnificado();
  }
};

  const pdfProject = () => ({
    projectName: project.projectName ?? "Projeto",
    boxes,
    rules: project.rules,
    extractedPartsByBoxId: project.extractedPartsByBoxId ?? {},
  });

  const onPdfTecnico = () => {
    if (!hasBoxes) {
      alert("Nenhuma caixa no projeto. Gere o design primeiro.");
      return;
    }
    const doc = buildTechnicalPdf(pdfProject());
    doc.save(`${slug}_tecnico.pdf`);
  };

  const onCutlist = () => {
    if (!hasBoxes) {
      alert("Nenhuma caixa no projeto. Gere o design primeiro.");
      return;
    }
    const doc = buildCutlistPdf(pdfProject());
    doc.save(`${slug}_cutlist.pdf`);
  };

  const onAmbos = () => {
    if (!hasBoxes) {
      alert("Nenhuma caixa no projeto. Gere o design primeiro.");
      return;
    }
    const doc = buildUnifiedPdf(pdfProject());
    doc.save(`${slug}_completo.pdf`);
  };

  const onLayoutCorte = async () => {
    if (!hasBoxes) {
      alert("Nenhuma caixa no projeto. Gere o design primeiro.");
      return;
    }
    const parametric = cutlistComPrecoFromBoxes(boxes, project.rules);
    const extracted = boxes.flatMap((b) =>
      Object.values(project.extractedPartsByBoxId?.[b.id] ?? {}).flat()
    );
    const allItems = [...parametric, ...extracted].map((p) => ({ ...p, boxId: p.boxId ?? "" }));
    const pieces = cutlistToPieces(allItems);
    if (pieces.length === 0) {
      alert("Nenhuma peça na cutlist para o layout de corte.");
      return;
    }
    const result = runCutLayout(pieces, { largura_mm: 2750, altura_mm: 1830, espessura_mm: 19 });
    const { buildCutLayoutPdf } = await import("../../../core/cutlayout/cutLayoutPdf");
const doc = buildCutLayoutPdf(result);
    doc.save(`${slug}_layout_corte.pdf`);
  };

  const onExportarCnc = async () => {
    if (!hasBoxes) {
      alert("Nenhuma caixa no projeto. Gere o design primeiro.");
      return;
    }
    const parametric = cutlistComPrecoFromBoxes(boxes, project.rules);
    const extracted = boxes.flatMap((b) =>
      Object.values(project.extractedPartsByBoxId?.[b.id] ?? {}).flat()
    );
    const allItems = [...parametric, ...extracted].map((p) => ({ ...p, boxId: p.boxId ?? "" }));
    const pieces = cutlistToPieces(allItems);
    if (pieces.length === 0) {
      alert("Nenhuma peça na cutlist para exportar CNC.");
      return;
    }
    const layoutResult = runCutLayout(pieces, { largura_mm: 2750, altura_mm: 1830, espessura_mm: 19 });
const { exportCncFiles, buildBasicDrillOperations } = await import("../../../core/cnc/cncExport");
const drillOps = buildBasicDrillOperations(layoutResult);
const cnc = exportCncFiles(project, layoutResult, drillOps);
    const tcnBlob = new Blob([cnc.tcn], { type: "text/plain" });
    const kdtBlob = new Blob([cnc.kdt], { type: "text/xml" });
    const tcnUrl = URL.createObjectURL(tcnBlob);
    const kdtUrl = URL.createObjectURL(kdtBlob);
    const link1 = document.createElement("a");
    link1.href = tcnUrl;
    link1.download = `${slug}.tcn`;
    link1.click();
    const link2 = document.createElement("a");
    link2.href = kdtUrl;
    link2.download = `${slug}.kdt`;
    link2.click();
    setTimeout(() => {
      URL.revokeObjectURL(tcnUrl);
      URL.revokeObjectURL(kdtUrl);
    }, 500);
  };

  return (
    <aside className="panel-content panel-content--side">
      <div className="section-title" style={{ marginBottom: 8 }}>Ações</div>

      <div className="stack-tight">
        {/* Gerar Design 3D */}
        <button
          onClick={() => actions.gerarDesign()}
          disabled={project.estaCarregando}
          className="button button-primary"
          style={{
            background: project.estaCarregando
              ? "rgba(59, 130, 246, 0.5)"
              : "var(--blue-light)",
            cursor: project.estaCarregando ? "not-allowed" : "pointer",
          }}
        >
          {project.estaCarregando ? "A Calcular..." : "Gerar Design 3D"}
        </button>

        {/* Adicionar caixote: cria um novo card na lista; o Viewer recebe via sync */}
        <button
          onClick={() => actions.addWorkspaceBox()}
          className="button button-ghost"
        >
          Adicionar caixote
        </button>

        <div className="row row-gap-sm" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            onClick={() => actions.duplicateWorkspaceBox()}
            disabled={!selectedId || workspaceBoxes.length === 0}
            className="button button-ghost"
            style={{ flex: 1, opacity: selectedId ? 1 : 0.6 }}
          >
            Duplicar
          </button>
          <button
            onClick={() => setShowGerarArquivoModal(true)}
            className="button button-ghost"
            style={{ flex: 1 }}
          >
            Gerar Arquivo
          </button>
        </div>

        {showGerarArquivoModal && (
          <GerarArquivoModal
            onClose={() => setShowGerarArquivoModal(false)}
            onConfirm={handleGerarArquivoConfirm}
            hasBoxes={hasBoxes}
            onPdfTecnico={onPdfTecnico}
            onCutlist={onCutlist}
            onAmbos={onAmbos}
            onLayoutCorte={onLayoutCorte}
            onExportarCnc={onExportarCnc}
          />
        )}

      </div>
    </aside>
  );
}
