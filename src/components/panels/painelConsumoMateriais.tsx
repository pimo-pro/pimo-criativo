import { useMemo } from "react";
import { useProject } from "../../context/useProject";
import { useMaterials } from "../../hooks/useMaterials";
import { buildCutlistItemsForIndustrialExport } from "../../core/fabrication/buildCutlistItemsForIndustrialExport";
import { computeConsumoMateriais } from "../../core/industrial/computeConsumoMateriais";
import { computeChapasReal } from "../../core/industrial/computeChapasReal";
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

export default function PainelConsumoMateriais({ embedded }: { embedded?: boolean } = {}) {
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

  const summary = useMemo(
    () => computeConsumoMateriais(items, materials, projectName, boxes),
    [items, materials, projectName, boxes]
  );

  const exportPdf = () => {
    beginIndustrialFileGeneration();
    void (async () => {
      try {
        const chapas = computeChapasReal(items, projectName, boxes, { projectId: projectName });
        const doc = await buildIndustrialArmazemPdf(projectName, chapas, summary);
        doc.save(industrialArmazemPdfFileName(projectName));
      } finally {
        endIndustrialFileGeneration();
      }
    })();
  };

  return (
    <Panel title={embedded ? undefined : "Consumo de Materiais"}>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 0 }}>
        Consumo por chapa e por peça, com estimativa de desperdício (nesting quando disponível).
      </p>
      <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 12 }}>
        <span>
          Desperdício total: <strong>{summary.desperdicioTotalPct.toFixed(1)}%</strong>
        </span>
        <span>
          Peças: <strong>{summary.porPeca.length}</strong>
        </span>
        <span>
          Chapas: <strong>{summary.porChapa.length}</strong>
        </span>
      </div>
      <Button variant="secondary" onClick={exportPdf} style={{ marginBottom: 12, fontSize: 12 }}>
        Gerar PDF — consumo_materiais
      </Button>
      <div style={{ overflowX: "auto" }}>
        <h4 style={{ fontSize: 12, margin: "8px 0" }}>Por peça</h4>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 16 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
              {["Peça", "N QR", "Material", "Qtd", "Área m²", "Peso kg"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: 6, color: "var(--text-muted)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary.porPeca.map((r) => (
              <tr key={r.pecaId} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{ padding: 6 }}>{r.peca}</td>
                <td style={{ padding: 6, fontFamily: "monospace" }}>{r.nQr}</td>
                <td style={{ padding: 6 }}>{r.material}</td>
                <td style={{ padding: 6 }}>{r.quantidade}</td>
                <td style={{ padding: 6 }}>{(r.areaMm2 / 1_000_000).toFixed(4)}</td>
                <td style={{ padding: 6 }}>{r.pesoKg.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h4 style={{ fontSize: 12, margin: "8px 0" }}>Por chapa</h4>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
              {["Chapa", "Material", "Esp.", "Usada m²", "Desperdício %"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: 6, color: "var(--text-muted)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary.porChapa.map((r) => (
              <tr key={r.chapaIndex} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{ padding: 6 }}>{r.chapaIndex}</td>
                <td style={{ padding: 6 }}>{r.material}</td>
                <td style={{ padding: 6 }}>{r.espessuraMm} mm</td>
                <td style={{ padding: 6 }}>{(r.areaUsadaMm2 / 1_000_000).toFixed(4)}</td>
                <td style={{ padding: 6 }}>{r.desperdicioPct.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
