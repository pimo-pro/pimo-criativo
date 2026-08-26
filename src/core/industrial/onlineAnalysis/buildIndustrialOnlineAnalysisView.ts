/**
 * Vista estruturada dos PDFs industriais.
 * Fase 2: secções canónicas com rowId + apply de industrialDocumentOverrides.
 */

import type { ProjectState } from "@/context/projectTypes";
import { resolveFullIndustrialNameForDocument } from "@/core/etiquetas/industrialDisplayName";
import { buildCutlistItemsForIndustrialExport } from "@/core/fabrication/buildCutlistItemsForIndustrialExport";
import { COMPONENT_TYPES_DEFAULT, type ComponentType } from "@/core/components/componentTypes";
import { FERRAGENS_DEFAULT, type Ferragem } from "@/core/ferragens/ferragens";
import { buildIndustrialFerragensForProject } from "@/core/industriais/buildIndustrialFerragensForProject";
import { computeChapasReal } from "@/core/industrial/computeChapasReal";
import { computeConsumoMateriais } from "@/core/industrial/computeConsumoMateriais";
import {
  buildFerragensTotaisArmazemData,
  buildFerragensTotaisPdfData,
  buildPecasTotaisRows,
  buildResumoFinanceiroPdfRows,
  buildResumoIndustriaisRows,
  buildTotaisProjetoPdfRows,
} from "@/core/industrial/industrialBottomSectionData";
import { listIndustrialMaterialsSnapshot } from "@/core/materials/service";
import {
  formatObservacoesForPdf,
  resolveObservacoesForCutListItem,
} from "@/core/observacoes/ObservacoesService";
import { safeGetItem } from "@/utils/storage";
import { applyIndustrialDocumentOverrides } from "./applyIndustrialDocumentOverrides";
import type { IndustrialDocumentOverridesStore } from "./industrialDocumentOverridesTypes";
import {
  INDUSTRIAL_ONLINE_ANALYSIS_DOCS,
  type IndustrialOnlineAnalysisDocId,
} from "./industrialOnlineAnalysisDocs";
import {
  makeCanonicalRowId,
  makeIndicatorRowId,
  makeSsotCutlistRowId,
} from "./industrialOnlineAnalysisRowIds";
import type {
  IndustrialOnlineAnalysisEditableColumn,
  IndustrialOnlineAnalysisRow,
  IndustrialOnlineAnalysisTableSection,
} from "./industrialOnlineAnalysisViewTypes";

export type { IndustrialOnlineAnalysisTableSection } from "./industrialOnlineAnalysisViewTypes";

export type IndustrialOnlineAnalysisView = {
  docId: IndustrialOnlineAnalysisDocId;
  label: string;
  description: string;
  projectName: string;
  sections: IndustrialOnlineAnalysisTableSection[];
};

function col(
  key: string,
  label: string,
  editable: boolean
): IndustrialOnlineAnalysisEditableColumn {
  return { key, label, editable };
}

function rowFromCells(
  rowId: string,
  cells: Record<string, string>
): IndustrialOnlineAnalysisRow {
  return {
    rowId,
    cells,
    origin: "canonical",
    modifiedFields: [],
    pendingDelete: false,
  };
}

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

function metaFor(docId: IndustrialOnlineAnalysisDocId) {
  return INDUSTRIAL_ONLINE_ANALYSIS_DOCS.find((d) => d.id === docId)!;
}

function cutlistItems(project: ProjectState) {
  return buildCutlistItemsForIndustrialExport({
    boxes: project.boxes ?? [],
    rules: project.rules,
    materialId: project.materialId,
    projectName: project.projectName,
    remates: project.remates ?? [],
    rodapes: project.rodapes ?? [],
    extractedPartsByBoxId: project.extractedPartsByBoxId,
    industrialPieceEdits: project.industrialPieceEdits,
  });
}

function buildCutlistLikeSections(
  project: ProjectState,
  _docId: IndustrialOnlineAnalysisDocId
): IndustrialOnlineAnalysisTableSection[] {
  const items = cutlistItems(project);
  const boxNome = Object.fromEntries(
    (project.boxes ?? []).map((b) => [b.id, b.nome?.trim() || b.id])
  );
  const projectName = project.projectName?.trim() || "Projeto";
  const columns = [
    col("caixa", "Caixa", true),
    col("peca", "Peça", true),
    col("qtd", "Qtd", true),
    col("dimensoes", "L×A×P (mm)", false),
    col("material", "Material", true),
    col("observacoes", "Observações", true),
    col("ref", "Ref.", false),
  ];
  return [
    {
      id: "cutlist",
      title: "Lista de corte",
      columns,
      rows: items.map((item, index) => {
        const caixa = boxNome[item.boxId ?? ""] ?? item.boxId ?? "—";
        const obs = formatObservacoesForPdf(
          resolveObservacoesForCutListItem(item, { pieceObservacoes: project.pieceObservacoes })
        );
        const ref = resolveFullIndustrialNameForDocument(item, projectName, caixa);
        // Sempre namespace cutlist — cutlist e técnico partilham o mesmo rowId SSOT.
        const rowId =
          item.id?.trim() ||
          makeSsotCutlistRowId([
            item.boxId,
            item.tipo,
            item.dimensoes.largura,
            item.dimensoes.altura,
            item.espessura,
            index,
          ]);
        return rowFromCells(rowId, {
          caixa,
          peca: item.tipo,
          qtd: String(item.quantidade ?? 1),
          dimensoes: `${item.dimensoes.largura}×${item.dimensoes.altura}×${item.espessura ?? item.dimensoes.profundidade ?? "—"}`,
          material: String(item.material ?? item.materialId ?? "—"),
          observacoes: obs || "—",
          ref,
        });
      }),
    },
  ];
}

/** Secções canónicas (sem overrides). */
export function buildCanonicalIndustrialOnlineAnalysisSections(
  project: ProjectState,
  docId: IndustrialOnlineAnalysisDocId,
  options?: { showPrices?: boolean }
): IndustrialOnlineAnalysisTableSection[] {
  const showPrices = options?.showPrices ?? false;
  const materials = listIndustrialMaterialsSnapshot();
  const componentTypes = loadComponentTypes();
  const ferragens = loadFerragens();
  const projectName = project.projectName?.trim() || "Projeto";
  const boxes = project.boxes ?? [];

  if (docId === "cutlist" || docId === "tecnico") {
    return buildCutlistLikeSections(project, docId);
  }

  if (docId === "unificado") {
    const items = cutlistItems(project);
    const rows = buildResumoIndustriaisRows(
      items,
      boxes,
      project.pieceObservacoes,
      project.industrialPieceEdits,
      materials
    );
    return [
      {
        id: "resumo",
        title: "Resumo industrial",
        columns: [
          col("caixa", "Caixa", true),
          col("peca", "Peça", true),
          col("dimensoes", "Dimensões", false),
          col("areaM2", "Área m²", false),
          col("pesoKg", "Peso kg", false),
          col("consumoM2", "Consumo m²", false),
          col("observacoes", "Obs.", true),
          col("mod", "Mod.", false),
        ],
        rows: rows.map((r, index) =>
          rowFromCells(
            makeCanonicalRowId(docId, "resumo", [r.caixa, r.peca, r.dimensoes, index]),
            {
              caixa: r.caixa,
              peca: r.peca,
              dimensoes: r.dimensoes,
              areaM2: r.areaM2.toFixed(3),
              pesoKg: r.pesoKg.toFixed(2),
              consumoM2: r.consumoM2.toFixed(3),
              observacoes: r.observacoes,
              mod: r.modified ? "sim" : "—",
            }
          )
        ),
      },
    ];
  }

  if (docId === "resumo_financeiro") {
    const data = buildResumoFinanceiroPdfRows(
      {
        boxes,
        rules: project.rules,
        materialId: project.materialId,
        projectName,
        remates: project.remates,
        rodapes: project.rodapes,
        extractedPartsByBoxId: project.extractedPartsByBoxId,
        industrialPieceEdits: project.industrialPieceEdits,
        ferragemOrla: project.ferragemOrla,
        financeiroOverrides: project.financeiroOverrides,
        financeiroAdminSettings: project.financeiroAdminSettings,
      },
      materials,
      showPrices
    );
    return [
      {
        id: "summary",
        title: "Resumo",
        columns: [col("indicador", "Indicador", false), col("valor", "Valor", false)],
        rows: data.summary.map((r) =>
          rowFromCells(makeIndicatorRowId(docId, r[0] ?? "x"), {
            indicador: r[0] ?? "",
            valor: r[1] ?? "",
          })
        ),
      },
      {
        id: "pecas",
        title: "Peças",
        columns: [
          col("caixa", "Caixa", true),
          col("tipo", "Tipo", true),
          col("dimensoes", "Dimensões", false),
          col("qtd", "Qtd", true),
          col("material", "Material", true),
        ],
        rows: data.pecas.map((r, index) =>
          rowFromCells(makeCanonicalRowId(docId, "pecas", [r[0], r[1], r[2], index]), {
            caixa: r[0] ?? "",
            tipo: r[1] ?? "",
            dimensoes: r[2] ?? "",
            qtd: r[3] ?? "",
            material: r[4] ?? "",
          })
        ),
      },
    ];
  }

  if (docId === "pecas_totais") {
    const rows = buildPecasTotaisRows(project, materials);
    return [
      {
        id: "pecas",
        title: "Peças totais",
        columns: [
          col("categoria", "Categoria", true),
          col("caixa", "Caixa", true),
          col("tipo", "Tipo", true),
          col("dimensoes", "Dimensões", false),
          col("material", "Material", true),
          col("pesoKg", "Peso kg", false),
          col("qtd", "Qtd", true),
        ],
        rows: rows.map((r, index) =>
          rowFromCells(
            makeCanonicalRowId(docId, "pecas", [r.caixa, r.tipo, r.dimensoes, index]),
            {
              categoria: r.categoria,
              caixa: r.caixa,
              tipo: r.tipo,
              dimensoes: r.dimensoes,
              material: r.material,
              pesoKg: r.pesoKg.toFixed(2),
              qtd: String(r.qtd),
            }
          )
        ),
      },
    ];
  }

  if (docId === "ferragens_totais") {
    const pdfData = buildFerragensTotaisPdfData(project, componentTypes, ferragens);
    const armazem = buildFerragensTotaisArmazemData(
      project,
      componentTypes,
      ferragens,
      materials
    );
    return [
      {
        id: "detalhe",
        title: "Detalhe",
        columns: [
          col("caixa", "Caixa", true),
          col("ferragem", "Ferragem", true),
          col("qtd", "Qtd", true),
          col("material", "Material", true),
          col("codigo", "Código", false),
        ],
        rows: pdfData.detalhe.map((r, index) =>
          rowFromCells(makeCanonicalRowId(docId, "detalhe", [r[0], r[1], r[4], index]), {
            caixa: r[0] ?? "",
            ferragem: r[1] ?? "",
            qtd: r[2] ?? "",
            material: r[3] ?? "",
            codigo: r[4] ?? "",
          })
        ),
      },
      {
        id: "porTipo",
        title: "Por tipo",
        columns: [col("tipo", "Tipo", true), col("total", "Total", true)],
        rows: pdfData.porTipo.map((r, index) =>
          rowFromCells(makeCanonicalRowId(docId, "porTipo", [r[0], index]), {
            tipo: r[0] ?? "",
            total: r[1] ?? "",
          })
        ),
      },
      {
        id: "chapas",
        title: "Materiais / chapas (armazém)",
        columns: [
          col("material", "Material", true),
          col("ref", "Ref.", true),
          col("medida", "Medida", true),
          col("qtd", "Qtd", true),
        ],
        rows: armazem.materiaisChapas.map((r, index) =>
          rowFromCells(makeCanonicalRowId(docId, "chapas", [r.material, r.ref, index]), {
            material: r.material,
            ref: r.ref,
            medida: r.medida,
            qtd: String(r.quantidade),
          })
        ),
      },
      {
        id: "ferragensAgg",
        title: "Ferragens agregadas (armazém)",
        columns: [
          col("material", "Material", true),
          col("ref", "Ref.", true),
          col("medida", "Medida", true),
          col("qtd", "Qtd", true),
        ],
        rows: armazem.ferragens.map((r, index) =>
          rowFromCells(makeCanonicalRowId(docId, "ferragensAgg", [r.material, r.ref, index]), {
            material: r.material,
            ref: r.ref,
            medida: r.medida,
            qtd: String(r.quantidade),
          })
        ),
      },
    ];
  }

  if (docId === "totais_projeto") {
    const rows = buildTotaisProjetoPdfRows(
      {
        boxes,
        rules: project.rules,
        materialId: project.materialId,
        projectName,
        remates: project.remates,
        rodapes: project.rodapes,
        extractedPartsByBoxId: project.extractedPartsByBoxId,
        industrialPieceEdits: project.industrialPieceEdits,
        ferragemOrla: project.ferragemOrla,
        financeiroOverrides: project.financeiroOverrides,
        financeiroAdminSettings: project.financeiroAdminSettings,
      },
      materials,
      showPrices
    );
    return [
      {
        id: "totais",
        title: "Totais do projeto",
        columns: [col("indicador", "Indicador", false), col("valor", "Valor", false)],
        rows: rows.map((r) =>
          rowFromCells(makeIndicatorRowId(docId, r[0] ?? "x"), {
            indicador: r[0] ?? "",
            valor: r[1] ?? "",
          })
        ),
      },
    ];
  }

  if (docId === "industrial_armazem") {
    const items = cutlistItems(project);
    const chapas = computeChapasReal(items, projectName, boxes, { projectId: projectName });
    const consumo = computeConsumoMateriais(items, materials, projectName, boxes);
    return [
      {
        id: "chapas",
        title: `Chapas reais (${chapas.totalSheets})`,
        columns: [
          col("index", "#", false),
          col("material", "Material", true),
          col("espessura", "Esp. mm", false),
          col("chapa", "Chapa L×A", false),
          col("pecas", "Peças", true),
          col("usado", "Usado m²", false),
          col("desperdicio", "Desperdício %", false),
        ],
        rows: chapas.sheets.map((s) =>
          rowFromCells(
            makeCanonicalRowId(docId, "chapas", [s.sheetIndex, s.material, s.espessuraMm]),
            {
              index: String(s.sheetIndex),
              material: s.material,
              espessura: String(s.espessuraMm),
              chapa: `${s.sheetLarguraMm}×${s.sheetAlturaMm}`,
              pecas: String(s.pieceCount),
              usado: (s.usedAreaMm2 / 1_000_000).toFixed(3),
              desperdicio: s.wastePct.toFixed(1),
            }
          )
        ),
      },
      {
        id: "consumoPeca",
        title: "Consumo por peça",
        columns: [
          col("peca", "Peça", true),
          col("nQr", "N QR", false),
          col("material", "Material", true),
          col("area", "Área m²", false),
          col("pesoKg", "Peso kg", false),
          col("qtd", "Qtd", true),
        ],
        rows: consumo.porPeca.map((r) =>
          rowFromCells(
            r.pecaId || makeCanonicalRowId(docId, "consumoPeca", [r.peca, r.nQr, r.material]),
            {
              peca: r.peca,
              nQr: r.nQr,
              material: r.material,
              area: (r.areaMm2 / 1_000_000).toFixed(3),
              pesoKg: r.pesoKg.toFixed(2),
              qtd: String(r.quantidade),
            }
          )
        ),
      },
      {
        id: "consumoChapa",
        title: "Consumo por chapa",
        columns: [
          col("index", "#", false),
          col("material", "Material", true),
          col("espessura", "Esp. mm", false),
          col("usado", "Usado m²", false),
          col("desperdicio", "Desperdício %", false),
        ],
        rows: consumo.porChapa.map((r) =>
          rowFromCells(
            makeCanonicalRowId(docId, "consumoChapa", [r.chapaIndex, r.material, r.espessuraMm]),
            {
              index: String(r.chapaIndex),
              material: r.material,
              espessura: String(r.espessuraMm),
              usado: (r.areaUsadaMm2 / 1_000_000).toFixed(3),
              desperdicio: r.desperdicioPct.toFixed(1),
            }
          )
        ),
      },
    ];
  }

  const industrial = buildIndustrialFerragensForProject({
    projectName: project.projectName,
    boxes,
    rules: project.rules,
    materialId: project.materialId,
    extractedPartsByBoxId: project.extractedPartsByBoxId,
    remates: project.remates ?? [],
    rodapes: project.rodapes ?? [],
    pieceObservacoes: project.pieceObservacoes,
  });
  return [
    {
      id: "ferragens",
      title: "Ferragens industriais",
      columns: [
        col("peca", "Peça", true),
        col("ferragem", "Ferragem", true),
        col("qtd", "Qtd", true),
        col("material", "Material", true),
        col("nQr", "N QR", false),
        col("observacoes", "Obs.", true),
      ],
      rows: industrial.rows.map((r, index) =>
        rowFromCells(
          makeCanonicalRowId(docId, "ferragens", [r.peca, r.ferragem, r.nQr, index]),
          {
            peca: r.peca,
            ferragem: r.ferragem,
            qtd: String(r.qtd),
            material: r.material,
            nQr: r.nQr,
            observacoes: r.observacoes || "—",
          }
        )
      ),
    },
  ];
}

export function buildIndustrialOnlineAnalysisView(
  project: ProjectState,
  docId: IndustrialOnlineAnalysisDocId,
  options?: { showPrices?: boolean; applyOverrides?: boolean }
): IndustrialOnlineAnalysisView {
  const meta = metaFor(docId);
  const projectName = project.projectName?.trim() || "Projeto";
  const canonical = buildCanonicalIndustrialOnlineAnalysisSections(project, docId, options);
  const apply = options?.applyOverrides !== false;
  const sections = apply
    ? applyIndustrialDocumentOverrides(
        docId,
        canonical,
        project.industrialDocumentOverrides as IndustrialDocumentOverridesStore | undefined
      )
    : canonical;

  return {
    docId,
    label: meta.label,
    description: meta.description,
    projectName,
    sections,
  };
}

/** Ponto —nico UI + ZIP: rows efetivas (canónico + overrides). */
export function getEffectiveRowsForDoc(
  project: ProjectState,
  docId: IndustrialOnlineAnalysisDocId,
  options?: { showPrices?: boolean }
): IndustrialOnlineAnalysisView {
  return buildIndustrialOnlineAnalysisView(project, docId, {
    ...options,
    applyOverrides: true,
  });
}
