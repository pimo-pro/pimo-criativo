import { useMemo } from "react";
import { useProject } from "../../context/useProject";
import { useComponentTypes } from "../../hooks/useComponentTypes";
import { useFerragens } from "../../hooks/useFerragens";
import Panel from "../ui/Panel";
import IndustrialPanelPdfActions from "./IndustrialPanelPdfActions";
import { useIndustrialBottomPdf } from "../../hooks/useIndustrialBottomPdf";
import { buildFerragensTotaisPdfData } from "../../core/industrial/industrialBottomSectionData";

export default function FerragensTotaisPanel({ embedded }: { embedded?: boolean } = {}) {
  const { project } = useProject();
  const { componentTypes } = useComponentTypes();
  const { ferragens } = useFerragens();
  const { exportFerragensTotaisPdf, viewFerragensTotaisPdf } = useIndustrialBottomPdf();

  const { detalhe, porTipo, totalQty } = useMemo(
    () =>
      buildFerragensTotaisPdfData(
        {
          boxes: project.boxes ?? [],
          rules: project.rules,
          materialId: project.materialId,
          projectName: project.projectName,
          remates: project.remates,
          rodapes: project.rodapes,
          extractedPartsByBoxId: project.extractedPartsByBoxId,
          pieceObservacoes: project.pieceObservacoes,
          workspaceBoxes: project.workspaceBoxes,
          ferragemOrla: project.ferragemOrla,
          orlaPresets: project.orlaPresets,
        },
        componentTypes,
        ferragens
      ),
    [project, componentTypes, ferragens]
  );

  return (
    <Panel title={embedded ? undefined : "Ferragens totais"}>
      <IndustrialPanelPdfActions
        onViewPdf={viewFerragensTotaisPdf}
        onDownloadPdf={exportFerragensTotaisPdf}
      />
      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
        Total de unidades: <strong style={{ color: "var(--text-main)" }}>{totalQty}</strong>
      </p>

      <h4 style={{ fontSize: 12, margin: "12px 0 6px", color: "var(--text-main)" }}>Por tipo</h4>
      <div className="data-list" style={{ marginBottom: 16 }}>
        {porTipo.map(([tipo, total]) => (
          <div key={tipo} className="data-list__row">
            <span className="data-list__label">{tipo}</span>
            <span className="data-list__value">{total}</span>
          </div>
        ))}
      </div>

      <h4 style={{ fontSize: 12, margin: "0 0 6px", color: "var(--text-main)" }}>Detalhe por caixa</h4>
      <div style={{ maxHeight: 280, overflow: "auto", fontSize: 11 }}>
        {detalhe.map((row, idx) => {
          const freeagemFmt =
            row[1] === "Pé" ||
            row[1] === "Parafuso 3×30" ||
            row[1] === "Parafuso 3\u00d730" ||
            row[1] === "Parafuso 4×35" ||
            row[1] === "Parafuso 4\u00d735" ||
            row[1] === "Parafuso 5×50" ||
            row[1] === "Parafuso 5\u00d750" ||
            row[1] === "puxa 8mm";
          const line = freeagemFmt
            ? `${row[0]} — ${row[1]} — ${row[2]} unidades — ${row[3]} — total ${row[4]}`
            : `${row[0]} — ${row[1]} ×${row[2]}`;
          return (
            <div key={`${row[0]}-${row[1]}-${idx}`} style={{ padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {line}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
