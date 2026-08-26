import { useMemo } from "react";
import { useProject } from "../../context/useProject";
import { useMaterials } from "../../hooks/useMaterials";
import { buildCutlistItemsForIndustrialExport } from "../../core/fabrication/buildCutlistItemsForIndustrialExport";
import { computeChapasReal } from "../../core/industrial/computeChapasReal";
import { computeConsumoMateriais } from "../../core/industrial/computeConsumoMateriais";
import {
  financeiroChapasBadgeLabel,
  financeiroChapasEstimadoHint,
  isChapasModeEstimado,
  isChapasModeOficial,
} from "../../core/financeiro/financeiroChapasModeLabels";
import type { FinanceiroChapasMode } from "../../core/financeiro/financeiroUnificadoTypes";
import {
  buildIndustrialArmazemPdf,
  industrialArmazemPdfFileName,
} from "../../core/pdf/pdfIndustrialArmazem";
import Panel from "../ui/Panel";
import Button from "../ui/Button";
import {
  beginIndustrialFileGeneration,
  endIndustrialFileGeneration,
} from "../../core/fabrication/industrialGenerationSuspend";

export default function PainelChapasReal({ embedded }: { embedded?: boolean } = {}) {
  const { project } = useProject();
  const { materials } = useMaterials();
  const boxes = project.boxes ?? [];
  const projectName = project.projectName?.trim() || "Projeto";

  const items = useMemo(
    () =>
      buildCutlistItemsForIndustrialExport({
        boxes,
        rules: project.rules,
        materialId: project.materialId,
        projectName,
        remates: project.remates ?? [],
        rodapes: project.rodapes ?? [],
        extractedPartsByBoxId: project.extractedPartsByBoxId,
        industrialPieceEdits: project.industrialPieceEdits,
      }),
    [boxes, project, projectName]
  );

  const chapas = useMemo(
    () => computeChapasReal(items, projectName, boxes, { projectId: projectName }),
    [items, projectName, boxes]
  );

  const chapasUiMode: FinanceiroChapasMode | null =
    chapas.mode === "oficial_pro" || chapas.mode === "estimado" || chapas.mode === "real"
      ? chapas.mode
      : null;

  const exportPdf = () => {
    beginIndustrialFileGeneration();
    void (async () => {
      try {
        const consumo = computeConsumoMateriais(items, materials, projectName, boxes);
        const doc = await buildIndustrialArmazemPdf(projectName, chapas, consumo);
        doc.save(industrialArmazemPdfFileName(projectName));
      } finally {
        endIndustrialFileGeneration();
      }
    })();
  };

  return (
    <Panel title={embedded ? undefined : "Cálculo de Chapas Real"}>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 0 }}>
        Distribuição real das peças nas chapas via motor de nesting industrial.
      </p>
      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 12,
          fontSize: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <span>
          Chapas: <strong>{chapas.totalSheets}</strong>
          {chapasUiMode ? (
            <span
              style={{
                marginLeft: 8,
                fontWeight: 600,
                color: isChapasModeOficial(chapasUiMode) ? "#16a34a" : "#ea580c",
                fontSize: 11,
              }}
            >
              {financeiroChapasBadgeLabel(chapasUiMode)}
            </span>
          ) : null}
        </span>
        <span>
          Desperdício: <strong>{chapas.totalWastePct.toFixed(1)}%</strong>
        </span>
      </div>
      {chapasUiMode && isChapasModeEstimado(chapasUiMode) ? (
        <p style={{ fontSize: 12, color: "#ea580c", fontWeight: 600, marginTop: 0 }}>
          {financeiroChapasEstimadoHint()}
        </p>
      ) : null}
      <Button variant="secondary" onClick={exportPdf} style={{ marginBottom: 12, fontSize: 12 }}>
        Gerar PDF — chapas_real
      </Button>
      <div style={{ overflowX: "auto" }}>
        {chapas.sheets.map((sheet) => (
          <div
            key={sheet.sheetIndex}
            style={{
              marginBottom: 12,
              padding: 10,
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
              Chapa {sheet.sheetIndex} — {sheet.material} {sheet.espessuraMm}mm · {sheet.pieceCount} peças ·
              desperdício {sheet.wastePct.toFixed(1)}%
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  {["Peça", "N QR", "Largura", "Altura"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: 4, color: "var(--text-muted)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.pieces.map((p, i) => (
                  <tr key={`${sheet.sheetIndex}-${i}`}>
                    <td style={{ padding: 4 }}>{p.nome}</td>
                    <td style={{ padding: 4, fontFamily: "monospace" }}>{p.nQr}</td>
                    <td style={{ padding: 4 }}>{p.largura} mm</td>
                    <td style={{ padding: 4 }}>{p.altura} mm</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {chapas.sheets.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Nesting indisponível — estimativa: {chapas.totalSheets} chapa(s).
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
