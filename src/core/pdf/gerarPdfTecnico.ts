/**
 * PDF Técnico Industrial — tabela única estilo Excel.
 * Uma única página landscape com todas as peças do projeto.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ComponentType } from "../components/componentTypes";
import type { BoxModule } from "../types";
import type { RulesConfig } from "../rules/rulesConfig";
import { gerarModeloIndustrial } from "../manufacturing/boxManufacturing";
import { safeGetItem } from "../../utils/storage";
import { COMPONENT_TYPES_DEFAULT } from "../components/componentTypes";
import { MATERIAIS_INDUSTRIAIS, MATERIAIS_PBR_OPCOES, getMaterial, type MaterialIndustrial } from "../manufacturing/materials";

const MARGIN = 12;
const HEADER_COLOR: [number, number, number] = [15, 23, 42];

/** Formato REF PEÇA: tipo → nome em maiúsculas para tabela */
const TIPO_TO_REF_NAME: Record<string, string> = {
  cima: "CIMA",
  fundo: "FUNDO",
  lateral_esquerda: "LATERAL_ESQ",
  lateral_direita: "LATERAL_DIR",
  COSTA: "COSTA",
  prateleira: "PRATELEIRA",
  porta_dupla: "PORTA_DUPLA",
  porta_simples: "PORTA_SIMPLES",
  porta_correr: "PORTA_CORRER",
  gaveta_frente: "GAVETA_FRENTE",
};

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
};

interface LinhaPeca {
  refPeca: string;
  boxIndex: number;
  material: string;
  qtd: number;
  comp: number;
  larg: number;
  esp: number;
  nesting: string;
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
  observacoes: string;
  nQr: number;
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
  const mat = materials.find((m) => m.nome === materialNome) ?? getMaterial(materialNome);
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

function construirLinhas(
  boxes: BoxModule[],
  rules: RulesConfig,
  componentTypes: ComponentType[],
  materials: MaterialIndustrial[]
): LinhaPeca[] {
  const ctById = Object.fromEntries(componentTypes.map((c) => [c.id, c]));
  let nQr = 1;

  const pecasCompletas: Array<{
    box: BoxModule;
    boxIndex: number;
    tipo: string;
    refPeca: string;
    larg: number;
    comp: number;
    esp: number;
    material: string;
    qtd: number;
  }> = [];

  for (let boxIdx = 0; boxIdx < boxes.length; boxIdx++) {
    const box = boxes[boxIdx];
    const modelo = gerarModeloIndustrial(box, rules);
    const material = box.material ?? "MDF Branco";
    const boxNum = boxIdx + 1;
    let prateleiraCount = 0;
    let gavetaCount = 0;

    for (const p of modelo.paineis) {
      let nomePeca = TIPO_TO_REF_NAME[p.tipo] ?? p.tipo.toUpperCase().replace(/\s/g, "_");
      if (p.tipo === "prateleira") {
        prateleiraCount++;
        nomePeca = `PRATELEIRA_${String(prateleiraCount).padStart(2, "0")}`;
      } else if (p.tipo === "gaveta_frente") {
        gavetaCount++;
        nomePeca = `GAVETA_FRENTE_${String(gavetaCount).padStart(2, "0")}`;
      }
      pecasCompletas.push({
        box,
        boxIndex: boxNum,
        tipo: p.tipo,
        refPeca: `Caixa ${boxNum} – ${nomePeca}`,
        larg: p.largura_mm,
        comp: p.altura_mm,
        esp: p.espessura_mm,
        material,
        qtd: p.quantidade,
      });
    }
  }

  // Ordenar: por caixa, depois por espessura, depois por nome
  pecasCompletas.sort((a, b) => {
    const boxCmp = (a.box.nome || a.box.id).localeCompare(b.box.nome || b.box.id);
    if (boxCmp !== 0) return boxCmp;
    const espCmp = a.esp - b.esp;
    if (espCmp !== 0) return espCmp;
    return a.refPeca.localeCompare(b.refPeca);
  });

  const agrupado = new Map<string, LinhaPeca>();

  for (const p of pecasCompletas) {
    const componentId = TIPO_TO_COMPONENT_ID[p.tipo] ?? p.tipo;
    const ct = ctById[componentId];
    const recebeFuros = ct?.recebe_furos ?? false;
    const ladosFuro = ct ? getFurosLados(ct) : new Set<string>();

    const materialStr = formatMaterial(p.material, p.esp, materials);
    const temFuros = recebeFuros || ladosFuro.size > 0;
    const key = `${p.refPeca}|${p.larg}|${p.comp}|${p.esp}|${materialStr}|${p.box.id}`;

    const exist = agrupado.get(key);
    if (exist) {
      exist.qtd += p.qtd;
    } else {
      agrupado.set(key, {
        refPeca: p.refPeca,
        material: materialStr,
        qtd: p.qtd,
        comp: p.comp,
        larg: p.larg,
        esp: p.esp,
        nesting: "X",
        cnc: temFuros ? "X" : "",
        drill: temFuros ? "X" : "",
        o2: "",
        o3: "",
        o4: "",
        o5: "",
        f2: ladosFuro.has("topo") ? "X" : "",
        f3: ladosFuro.has("fundo") ? "X" : "",
        f4: ladosFuro.has("esquerda") ? "X" : "",
        f5: ladosFuro.has("direita") ? "X" : "",
        observacoes: "",
        nQr: nQr++,
        boxNome: p.box.nome || p.box.id,
        boxIndex: p.boxIndex,
        espessura_mm: p.esp,
        tipo: p.tipo,
      });
    }
  }

  const resultado = Array.from(agrupado.values());
  resultado.sort((a, b) => {
    const boxCmp = a.boxIndex - b.boxIndex;
    if (boxCmp !== 0) return boxCmp;
    const espCmp = a.espessura_mm - b.espessura_mm;
    if (espCmp !== 0) return espCmp;
    return a.refPeca.localeCompare(b.refPeca);
  });

  // Renumerar N QR
  resultado.forEach((r, i) => {
    r.nQr = i + 1;
  });

  return resultado;
}

/**
 * Gera a Página 2 do PDF com preços (futura implementação).
 * Preparado para: resumo financeiro, custos por caixa.
 */
function gerarPdfPrecos(doc: jsPDF, boxes: BoxModule[], rules: RulesConfig): void {
  // TODO: doc.addPage("a4", "landscape"); adicionarResumoFinanceiro(doc, dados); adicionarCustosPorCaixa(doc, boxes, rules);
  adicionarResumoFinanceiro(doc, null);
  adicionarCustosPorCaixa(doc, boxes, rules);
}

/**
 * Adiciona secção de resumo financeiro ao PDF (futura implementação).
 */
function adicionarResumoFinanceiro(doc: jsPDF, dados: unknown): void {
  void doc;
  void dados;
}

/**
 * Adiciona custos por caixa ao PDF (futura implementação).
 */
function adicionarCustosPorCaixa(doc: jsPDF, boxes: BoxModule[], rules: RulesConfig): void {
  void doc;
  void boxes;
  void rules;
}

function getAcabamentosUnicos(boxes: BoxModule[], materials: MaterialIndustrial[]): string[] {
  const seen = new Set<string>();
  const acc: string[] = [];
  for (const box of boxes) {
    const mat = box.material ?? "MDF Branco";
    const esp = box.espessura > 0 ? box.espessura : 18;
    const matInfo = materials.find((m) => m.nome === mat) ?? getMaterial(mat);
    const acabamento = matInfo.materialPbrId
      ? MATERIAIS_PBR_OPCOES.find((p) => p.id === matInfo.materialPbrId)?.label ?? matInfo.materialPbrId
      : matInfo.cor ?? "";
    const s = `${mat}${acabamento ? " " + acabamento : ""} ${esp}mm`;
    if (!seen.has(s)) {
      seen.add(s);
      acc.push(s);
    }
  }
  return acc;
}

/**
 * Gera PDF técnico industrial em tabela única (landscape).
 * @param opcoes.incluirPaginaPrecos — quando true (futuro), adiciona Página 2 com preços
 */
export function gerarPdfTecnicoCompleto(
  boxes: BoxModule[],
  rules: RulesConfig,
  projectName: string,
  opcoes?: { incluirPaginaPrecos?: boolean }
): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const componentTypes = loadComponentTypesFromStorage();
  const materials = loadMaterialsFromStorage();

  let y = MARGIN;

  // ——— Cabeçalho ———
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("PIMO Studio", MARGIN, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`PROJETO / MÓVEL: ${projectName || "Projeto"}`, MARGIN, y);
  y += 6;

  const acabamentos = getAcabamentosUnicos(boxes, materials);
  doc.text(`Acabamento: ${acabamentos.length > 0 ? acabamentos.join(" | ") : "—"}`, MARGIN, y);
  y += 12;

  // ——— Tabela industrial ———
  const linhas = construirLinhas(boxes, rules, componentTypes, materials);

  const head = [
    "REF PEÇA",
    "MATERIAL",
    "QTD",
    "COMP",
    "LARG",
    "ESP",
    "NESTING",
    "CNC",
    "Drill",
    "O2",
    "O3",
    "O4",
    "O5",
    "F2",
    "F3",
    "F4",
    "F5",
    "OBSERVAÇÕES",
    "N QR",
  ];

  // Construir body com linhas de separação entre caixas
  const bodyRows: string[][] = [];
  const separatorRowIndices = new Set<number>();
  let prevBoxIndex = 0;

  if (linhas.length === 0) {
    bodyRows.push(["Nenhuma peça", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—"]);
  } else {
    for (const r of linhas) {
      if (prevBoxIndex > 0 && prevBoxIndex !== r.boxIndex) {
        separatorRowIndices.add(bodyRows.length);
        bodyRows.push(["—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—"]);
      }
      prevBoxIndex = r.boxIndex;
      bodyRows.push([
        r.refPeca,
        r.material,
        String(r.qtd),
        String(r.comp),
        String(r.larg),
        String(r.esp),
        r.nesting,
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
        r.observacoes,
        String(r.nQr),
      ]);
    }
  }

  const isSeparatorRow = (rowIndex: number) => separatorRowIndices.has(rowIndex);

  autoTable(doc, {
    head: [head],
    body: bodyRows,
    didParseCell: (data) => {
      if (data.section === "body" && isSeparatorRow(data.row.index)) {
        data.cell.styles.fillColor = [235, 238, 242];
        data.cell.styles.minCellHeight = 6;
      }
    },
    startY: y,
    styles: { fontSize: 7 },
    headStyles: { fillColor: HEADER_COLOR },
    margin: { left: MARGIN, right: MARGIN },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 45 },
      2: { cellWidth: 12 },
      3: { cellWidth: 18 },
      4: { cellWidth: 18 },
      5: { cellWidth: 12 },
      6: { cellWidth: 14 },
      7: { cellWidth: 10 },
      8: { cellWidth: 10 },
      9: { cellWidth: 8 },
      10: { cellWidth: 8 },
      11: { cellWidth: 8 },
      12: { cellWidth: 8 },
      13: { cellWidth: 8 },
      14: { cellWidth: 8 },
      15: { cellWidth: 8 },
      16: { cellWidth: 8 },
      17: { cellWidth: 25 },
      18: { cellWidth: 12 },
    },
  });

  const lastY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  y = lastY + 8;

  // Rodapé
  doc.setFontSize(9);
  doc.setTextColor(128, 128, 128);
  doc.text(
    `${new Date().toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" })}  |  ${linhas.length} peça(s)`,
    MARGIN,
    200
  );
  doc.setTextColor(0, 0, 0);

  // Futura Página 2 (preços) — preparado para gerarPdfPrecos, adicionarResumoFinanceiro, adicionarCustosPorCaixa
  if (opcoes?.incluirPaginaPrecos) {
    gerarPdfPrecos(doc, boxes, rules);
  }

  return doc;
}
