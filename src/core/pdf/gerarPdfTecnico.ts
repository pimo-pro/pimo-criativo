/**
 * PDF Técnico Industrial — tabela estilo Excel, A4 landscape.
 * Lista de corte com paginação densa (35–40 linhas por página de continuação).
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ComponentType } from "../components/componentTypes";
import type { BoxModule, CutListItemComPreco } from "../types";
import type { RulesConfig } from "../rules/rulesConfig";
import { buildCutlistItemsForIndustrialExport } from "../fabrication/buildCutlistItemsForIndustrialExport";
import type { IndustrialPieceEditsStore } from "../industrial/industrialPieceEditsTypes";
import { resolveFullIndustrialNameForDocument } from "../etiquetas/industrialDisplayName";
import {
  buildIndustrialListPiecesPerSheet,
  resolveIndustrialListNqr,
} from "./industrialListQr";
import { resolveIndustrialPdfAttribution } from "./industrialPdfAttribution";
import { safeGetItem } from "../../utils/storage";
import type { PieceObservacoesStore } from "../observacoes/observacoesTypes";
import {
  formatObservacoesForPdf,
  normalizeObservacoesList,
  resolveObservacoesForCutListItem,
} from "../observacoes/ObservacoesService";
import {
  PDF_INDUSTRIAL_HEADER_COLOR,
  PDF_INDUSTRIAL_MARGIN,
  PDF_INDUSTRIAL_ROW_ALT,
  PDF_INDUSTRIAL_TABLE_W,
  applyEtqCellStyle,
  buildColumnStylesFromWidths,
  drawIndustrialOperationalDatesBlock,
  drawIndustrialPdfFooter,
  drawIndustrialPdfTitleHeader,
  drawIndustrialProjectInfoBlock,
  drawIndustrialSectionTitle,
  formatEtqForPdf,
  formatIndustrialDesignDate,
  getIndustrialAutoTableMargins,
  getIndustrialAutoTableStyles,
  getIndustrialHeadStyles,
} from "./pdfIndustrialListShell";
import {
  PDF_TECNICO_COL_COUNT,
  PDF_TECNICO_TABLE_HEAD,
  buildTecnicoColumnWidthsMm,
} from "./pdfExcelModelLayout";

import { COMPONENT_TYPES_DEFAULT } from "../components/componentTypes";
import { MATERIAIS_INDUSTRIAIS, getMaterial, type MaterialIndustrial } from "../manufacturing/materials";

/** Mapeamento tipo peça (boxManufacturing) → id componentType */
const TIPO_TO_COMPONENT_ID: Record<string, string> = {
  cima: "cima",
  fundo: "fundo",
  lateral_esquerda: "lateral_esquerda",
  lateral_direita: "lateral_direita",
  COSTA: "costa",
  prateleira: "prateleira",
  porta_dupla: "porta",
  porta_simples: "porta",
  porta_correr: "porta",
  gaveta_frente: "gaveta_frente",
  gaveta_lat_esq: "gaveta_lat_esq",
  gaveta_lat_dir: "gaveta_lat_dir",
  gaveta_fundo: "gaveta_fundo",
  gaveta_traseira: "gaveta_traseira",
};

interface LinhaPeca {
  refPeca: string;
  boxIndex: number;
  material: string;
  matRef: string;
  qtd: number;
  comp: number;
  larg: number;
  esp: number;
  cnc: string;
  drill: string;
  o2: string;
  o3: string;
  o4: string;
  o5: string;
  f2: string;
  f3: string;
  f4: string;
  f5: string;
  go: string;
  observacoes: string;
  nQr: string;
  boxNome: string;
  espessura_mm: number;
  tipo: string;
}

function loadComponentTypesFromStorage(): ComponentType[] {
  const raw = safeGetItem("pimo_component_types");
  if (!raw) return [...COMPONENT_TYPES_DEFAULT];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as ComponentType[];
  } catch {
    /* ignore */
  }
  return [...COMPONENT_TYPES_DEFAULT];
}

function loadMaterialsFromStorage(): MaterialIndustrial[] {
  const raw = safeGetItem("pimo_admin_materials");
  if (!raw) return [...MATERIAIS_INDUSTRIAIS];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as MaterialIndustrial[];
  } catch {
    /* ignore */
  }
  return [...MATERIAIS_INDUSTRIAIS];
}

function formatMaterial(materialNome: string, espessura: number, materials: MaterialIndustrial[]): string {
  const mat =
    materials.find((m) => m.nome === materialNome || m.id === materialNome) ?? getMaterial(materialNome);
  const cor = mat.cor ?? "";
  const parts = [materialNome];
  if (cor) parts.push(cor);
  parts.push(`${espessura}mm`);
  return parts.join(" ");
}

function getFurosLados(componentType: ComponentType): Set<string> {
  const lados = new Set<string>();
  for (const r of componentType.regras_de_furo ?? []) {
    for (const lado of r.aplicar_em ?? []) {
      lados.add(lado);
    }
  }
  return lados;
}

function temFurosLaterais(ladosFuro: Set<string>): boolean {
  return ladosFuro.has("fundo") || ladosFuro.has("esquerda") || ladosFuro.has("direita");
}

export type GerarPdfTecnicoOpcoes = {
  incluirPaginaPrecos?: boolean;
  materialId?: string;
  extractedPartsByBoxId?: Record<string, Record<string, CutListItemComPreco[]>>;
  precomputedItems?: CutListItemComPreco[];
  pieceObservacoes?: PieceObservacoesStore;
  industrialPieceEdits?: IndustrialPieceEditsStore;
  remates?: import("../remate/rematePieceTypes").RematePiece[];
  rodapes?: import("../rodape/rodapeTypes").ProjectRodape[];
};

function loadCutlistForIndustrialList(
  boxes: BoxModule[],
  rules: RulesConfig,
  projectName: string,
  pdfOpts?: Pick<
    GerarPdfTecnicoOpcoes,
    | "materialId"
    | "extractedPartsByBoxId"
    | "precomputedItems"
    | "industrialPieceEdits"
    | "remates"
    | "rodapes"
  >
): CutListItemComPreco[] {
  if (pdfOpts?.precomputedItems && pdfOpts.precomputedItems.length > 0) {
    return pdfOpts.precomputedItems;
  }
  return buildCutlistItemsForIndustrialExport({
    boxes,
    rules,
    materialId: pdfOpts?.materialId,
    projectName,
    remates: pdfOpts?.remates ?? [],
    rodapes: pdfOpts?.rodapes ?? [],
    extractedPartsByBoxId: pdfOpts?.extractedPartsByBoxId,
    industrialPieceEdits: pdfOpts?.industrialPieceEdits,
  });
}

function construirLinhas(
  boxes: BoxModule[],
  rules: RulesConfig,
  componentTypes: ComponentType[],
  materials: MaterialIndustrial[],
  projectName: string,
  pdfOpts?: Pick<
    GerarPdfTecnicoOpcoes,
    "materialId" | "extractedPartsByBoxId" | "precomputedItems" | "pieceObservacoes"
  >
): LinhaPeca[] {
  const ctById = Object.fromEntries(componentTypes.map((c) => [c.id, c]));
  const boxById = new Map(boxes.map((b) => [b.id, b]));
  const boxIndexById = new Map(boxes.map((b, i) => [b.id, i + 1]));

  const cutlist = loadCutlistForIndustrialList(boxes, rules, projectName, pdfOpts);
  const piecesPerSheet = buildIndustrialListPiecesPerSheet(cutlist);
  const qrCtx = { projectName, boxes, rules };

  const pecasCompletas: Array<{
    box: BoxModule | undefined;
    boxIndex: number;
    tipo: string;
    refPeca: string;
    larg: number;
    comp: number;
    esp: number;
    material: string;
    matRef: string;
    qtd: number;
    nQr: string;
    observacoes: string[];
  }> = [];

  cutlist.forEach((item, index0) => {
    const box = item.boxId ? boxById.get(item.boxId) : undefined;
    const boxIndex = item.boxId ? (boxIndexById.get(item.boxId) ?? 0) : 0;
    const boxNome = box?.nome ?? item.boxId ?? "";
    const refPeca = resolveFullIndustrialNameForDocument(item, projectName, boxNome);
    const materialNome = item.material ?? box?.material ?? "mdf_branco";
    const matInfo = materials.find((m) => m.nome === materialNome || m.id === materialNome) ?? getMaterial(materialNome);
    const matRef = matInfo.id ?? materialNome;
    const itemObs = resolveObservacoesForCutListItem(item, {
      pieceObservacoes: pdfOpts?.pieceObservacoes,
    });

    pecasCompletas.push({
      box,
      boxIndex,
      tipo: item.tipo,
      refPeca,
      larg: item.dimensoes.largura,
      comp: item.dimensoes.altura,
      esp: item.espessura,
      material: materialNome,
      matRef,
      qtd: item.quantidade,
      nQr: resolveIndustrialListNqr(item, qrCtx, piecesPerSheet, index0),
      observacoes: itemObs,
    });
  });

  pecasCompletas.sort((a, b) => {
    const boxCmp = a.boxIndex - b.boxIndex;
    if (boxCmp !== 0) return boxCmp;
    const espCmp = a.esp - b.esp;
    if (espCmp !== 0) return espCmp;
    return a.refPeca.localeCompare(b.refPeca);
  });

  const agrupado = new Map<string, LinhaPeca & { observacoesLista: string[] }>();

  for (const p of pecasCompletas) {
    const componentId = TIPO_TO_COMPONENT_ID[p.tipo] ?? p.tipo;
    const ct = ctById[componentId];
    const ladosFuro = ct ? getFurosLados(ct) : new Set<string>();

    const materialStr = formatMaterial(p.material, p.esp, materials);
    const temFurosLateraisPiece = temFurosLaterais(ladosFuro);
    const key = `${p.refPeca}|${p.larg}|${p.comp}|${p.esp}|${materialStr}|${p.box?.id ?? ""}`;
    const esp10 = p.esp === 10;
    const o2o5 = esp10 ? "" : "X";

    const exist = agrupado.get(key);
    if (exist) {
      exist.qtd += p.qtd;
      exist.observacoesLista = normalizeObservacoesList([...exist.observacoesLista, ...p.observacoes]);
      exist.observacoes = formatObservacoesForPdf(exist.observacoesLista);
    } else {
      agrupado.set(key, {
        refPeca: p.refPeca,
        material: materialStr,
        matRef: p.matRef,
        qtd: p.qtd,
        comp: p.comp,
        larg: p.larg,
        esp: p.esp,
        cnc: "X",
        drill: temFurosLateraisPiece ? "X" : "",
        o2: o2o5,
        o3: o2o5,
        o4: o2o5,
        o5: o2o5,
        f2: ladosFuro.has("topo") ? "X" : "",
        f3: ladosFuro.has("fundo") ? "X" : "",
        f4: ladosFuro.has("esquerda") ? "X" : "",
        f5: ladosFuro.has("direita") ? "X" : "",
        go: "",
        observacoes: formatObservacoesForPdf(p.observacoes),
        observacoesLista: normalizeObservacoesList(p.observacoes),
        nQr: p.nQr,
        boxNome: p.box?.nome || p.box?.id || "—",
        boxIndex: p.boxIndex,
        espessura_mm: p.esp,
        tipo: p.tipo,
      });
    }
  }

  const resultado = Array.from(agrupado.values()).map(({ observacoesLista: _omit, ...row }) => row);
  resultado.sort((a, b) => {
    const boxCmp = a.boxIndex - b.boxIndex;
    if (boxCmp !== 0) return boxCmp;
    const espCmp = a.espessura_mm - b.espessura_mm;
    if (espCmp !== 0) return espCmp;
    return a.refPeca.localeCompare(b.refPeca);
  });

  return resultado;
}

function gerarPdfPrecos(doc: jsPDF, boxes: BoxModule[], rules: RulesConfig): void {
  void doc;
  void boxes;
  void rules;
}

function getAcabamentosUnicos(boxes: BoxModule[], materials: MaterialIndustrial[]): string[] {
  const seen = new Set<string>();
  const acc: string[] = [];
  for (const box of boxes) {
    const mat = box.material ?? "mdf_branco";
    const esp = box.espessura > 0 ? box.espessura : 18;
    const matInfo = materials.find((m) => m.nome === mat || m.id === mat) ?? getMaterial(mat);
    const cor = matInfo.cor ?? "";
    const s = `${mat}${cor ? " " + cor : ""} ${esp}mm`;
    if (!seen.has(s)) {
      seen.add(s);
      acc.push(s);
    }
  }
  return acc;
}

const COL_COUNT = PDF_TECNICO_COL_COUNT;
const ETQ_COL_INDEX = COL_COUNT - 1;

/**
 * Gera PDF técnico industrial em tabela (landscape, paginada).
 */
export function gerarPdfTecnicoCompleto(
  boxes: BoxModule[],
  rules: RulesConfig,
  projectName: string,
  opcoes?: GerarPdfTecnicoOpcoes
): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const componentTypes = loadComponentTypesFromStorage();
  const materials = loadMaterialsFromStorage();

  const acabamentos = getAcabamentosUnicos(boxes, materials);
  const dataHoje = formatIndustrialDesignDate();
  const { designer, responsible } = resolveIndustrialPdfAttribution();

  let y = drawIndustrialPdfTitleHeader(doc, { designer, designDate: dataHoje, responsible });

  const blockW = PDF_INDUSTRIAL_TABLE_W;
  const blockX = PDF_INDUSTRIAL_MARGIN;
  const c1x = blockX + 4;
  const c2x = blockX + blockW / 2 + 4;

  const { nextY, totalPiecesLabelPos } = drawIndustrialProjectInfoBlock(doc, y, {
    projectName: projectName || "Projeto",
    acabamento: acabamentos.length > 0 ? acabamentos[0] : "—",
    boxCount: boxes.length,
    totalPieces: 0,
  });
  y = nextY;

  y = drawIndustrialOperationalDatesBlock(doc, blockX, y, blockW, c1x, c2x);

  const linhas = construirLinhas(boxes, rules, componentTypes, materials, projectName, {
    materialId: opcoes?.materialId,
    extractedPartsByBoxId: opcoes?.extractedPartsByBoxId,
    precomputedItems: opcoes?.precomputedItems,
    pieceObservacoes: opcoes?.pieceObservacoes,
  });

  const totalPecasReal = linhas.reduce((sum, r) => sum + r.qtd, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(String(totalPecasReal), totalPiecesLabelPos.x, totalPiecesLabelPos.y);

  y = drawIndustrialSectionTitle(doc, y, "Lista de Corte - Painéis");

  const head = [...PDF_TECNICO_TABLE_HEAD];
  const colWidths = buildTecnicoColumnWidthsMm(doc);
  const columnStyles = buildColumnStylesFromWidths(colWidths, {
    3: { halign: "center" },
    4: { halign: "right" },
    5: { halign: "right" },
    6: { halign: "center" },
    7: { halign: "center" },
    8: { halign: "center" },
    9: { halign: "center" },
    10: { halign: "center" },
    11: { halign: "center" },
    12: { halign: "center" },
    13: { halign: "center" },
    14: { halign: "center" },
    15: { halign: "center" },
    16: { halign: "center" },
    17: { halign: "center" },
    [ETQ_COL_INDEX]: { halign: "center" },
  });

  const bodyRows: string[][] = [];
  const separatorRowIndices = new Set<number>();
  let prevBoxIndex = 0;

  if (linhas.length === 0) {
    bodyRows.push(Array(COL_COUNT).fill("—"));
    bodyRows[0][0] = "Nenhuma peca";
  } else {
    for (const r of linhas) {
      if (prevBoxIndex > 0 && prevBoxIndex !== r.boxIndex) {
        separatorRowIndices.add(bodyRows.length);
        bodyRows.push(Array(COL_COUNT).fill(""));
      }
      prevBoxIndex = r.boxIndex;
      bodyRows.push([
        r.refPeca,
        r.material,
        r.matRef,
        String(r.qtd),
        String(r.comp),
        String(r.larg),
        String(r.esp),
        r.cnc,
        r.drill,
        r.o2,
        r.o3,
        r.o4,
        r.o5,
        r.f2,
        r.f3,
        r.f4,
        r.f5,
        r.go,
        r.observacoes,
        formatEtqForPdf(String(r.nQr)),
      ]);
    }
  }

  const isSeparatorRow = (rowIndex: number) => separatorRowIndices.has(rowIndex);

  autoTable(doc, {
    head: [head],
    body: bodyRows,
    theme: "grid",
    showHead: "everyPage",
    rowPageBreak: "avoid",
    tableWidth: PDF_INDUSTRIAL_TABLE_W,
    didParseCell: (data) => {
      if (data.section === "head") {
        data.cell.styles.fillColor = PDF_INDUSTRIAL_HEADER_COLOR;
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 6.5;
      }
      if (data.section === "body") {
        data.cell.styles.overflow = "hidden";
        applyEtqCellStyle(data, ETQ_COL_INDEX);
        if (isSeparatorRow(data.row.index)) {
          data.cell.styles.fillColor = [235, 238, 242];
        } else if (data.row.index % 2 === 0) {
          data.cell.styles.fillColor = [255, 255, 255];
        } else {
          data.cell.styles.fillColor = PDF_INDUSTRIAL_ROW_ALT;
        }
      }
    },
    startY: y,
    styles: getIndustrialAutoTableStyles(),
    headStyles: getIndustrialHeadStyles(),
    margin: getIndustrialAutoTableMargins(),
    columnStyles,
  });

  drawIndustrialPdfFooter(doc, dataHoje, linhas.length, totalPecasReal);

  if (opcoes?.incluirPaginaPrecos) {
    gerarPdfPrecos(doc, boxes, rules);
  }

  return doc;
}
