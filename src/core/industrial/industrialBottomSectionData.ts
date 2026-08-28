import {
  CHAPA_PADRAO_LARGURA,
  CHAPA_PADRAO_ALTURA,
  DENSIDADE_PADRAO,
} from "../manufacturing/materials";
import { buildCutlistItemsForIndustrialExport } from "../fabrication/buildCutlistItemsForIndustrialExport";
import { buildIndustrialFerragensForProject } from "../industriais/buildIndustrialFerragensForProject";
import { computeChapasReal } from "./computeChapasReal";
import { getSheetDefinitionFromSettings } from "../cnc/cncPipeline";
import type { BoxModule, CutListItemComPreco } from "../types";
import type { ComponentType } from "../components/componentTypes";
import type { Ferragem } from "../ferragens/ferragens";
import type { MaterialIndustrial } from "../manufacturing/materials";
import type { ProjectState } from "../../context/projectTypes";
import { formatCurrency } from "../../utils/formatting";
import { formatObservacoesForPdf, resolveObservacoesForCutListItem } from "../observacoes/ObservacoesService";
import type { PieceObservacoesStore } from "../observacoes/observacoesTypes";
import type { IndustrialPieceEditsStore } from "./industrialPieceEditsTypes";
import { isIndustrialPieceEdited, computeIndustrialPieceMetrics } from "./IndustrialPieceEditsService";
import {
  listPesPlasticoPorCaixa,
  listParafuso3x30PorCaixa,
  loadPesPlasticoConfig,
  PARAFUSO_3X30_NOME,
  PE_PLASTICO_NOME,
} from "../ferragens/pesPlasticoConfig";
import {
  listParafuso4x35PorCaixa,
  listParafuso5x50PorCaixa,
  listPuxa8mmPorCaixa,
  PARAFUSO_4X35_NOME,
  PARAFUSO_5X50_NOME,
  PUXA_8MM_NOME,
} from "../ferragens/freeagemParafusos";
import {
  countPortasFrenteFixa,
  loadCalcoConfig,
  CALCO_MATERIAL,
} from "../ferragens/calcoConfig";
import {
  countDobradicasPorCaixaForPdf,
  DOBRADICA_REF,
} from "../pdf/pdfFerragensTotaisNormalize";
import {
  aggregateFerragensByCommercialName,
  boxHasCornerFixedFront,
  DOBRADICA_W90_NOME,
  resolveCanonicalFerragemId,
  resolveFerragemCommercialName,
} from "../ferragens/ferragensCountRules";
import { buildFerragensTotaisNormalized } from "../ferragens/ferragensTotaisSsot";
import {
  computeFinanceiroUnificado,
  financeiroCustoRows,
  financeiroMetricRows,
} from "../financeiro/financeiroUnificado";

export type PecasTotaisRow = {
  categoria: string;
  caixa: string;
  tipo: string;
  dimensoes: string;
  material: string;
  pesoKg: number;
  qtd: number;
};

function pieceWeightKg(
  item: { dimensoes: { largura: number; altura: number; profundidade?: number }; espessura?: number; quantidade: number; material?: string },
  materials: MaterialIndustrial[]
): number {
  const largura = item.dimensoes.largura ?? 0;
  const altura = item.dimensoes.altura ?? 0;
  const espessura = item.espessura ?? item.dimensoes.profundidade ?? 18;
  const qty = item.quantidade ?? 1;
  const mat = materials.find((m) => m.nome === item.material);
  const densidade = mat?.densidade ?? DENSIDADE_PADRAO;
  const volumeM3 = (largura * altura * espessura * qty) / 1_000_000_000;
  return volumeM3 * densidade;
}

export function buildPecasTotaisRows(
  project: Pick<
    ProjectState,
    | "boxes"
    | "rules"
    | "materialId"
    | "projectName"
    | "remates"
    | "rodapes"
    | "extractedPartsByBoxId"
  > & { industrialPieceEdits?: import("./industrialPieceEditsTypes").IndustrialPieceEditsStore },
  materials: MaterialIndustrial[]
): PecasTotaisRow[] {
  const boxes = project.boxes ?? [];
  const items = buildCutlistItemsForIndustrialExport({
    boxes,
    rules: project.rules,
    materialId: project.materialId,
    projectName: project.projectName,
    remates: project.remates ?? [],
    rodapes: project.rodapes ?? [],
    extractedPartsByBoxId: project.extractedPartsByBoxId,
    industrialPieceEdits: project.industrialPieceEdits,
  });
  const boxNomeById = Object.fromEntries(boxes.map((b) => [b.id, b.nome?.trim() || b.id]));
  const rows: PecasTotaisRow[] = [];

  for (const item of items) {
    const cat = item.tipo.includes("porta")
      ? "Porta"
      : item.tipo.includes("gaveta")
        ? "Gaveta"
        : item.tipo.includes("remate") || item.tipo.includes("orla")
          ? "Remate/Orla"
          : "Painel";
    rows.push({
      categoria: cat,
      caixa: boxNomeById[item.boxId ?? ""] ?? item.boxId ?? "—",
      tipo: item.tipo,
      dimensoes: `${item.dimensoes.largura}×${item.dimensoes.altura}×${item.dimensoes.profundidade ?? item.espessura} mm`,
      material: String(item.material ?? item.materialId ?? "—"),
      pesoKg: pieceWeightKg(item, materials),
      qtd: item.quantidade,
    });
  }
  return rows;
}

type IndustrialBottomProjectSlice = Pick<
  ProjectState,
  | "boxes"
  | "rules"
  | "materialId"
  | "projectName"
  | "remates"
  | "rodapes"
  | "extractedPartsByBoxId"
  | "ferragemOrla"
  | "financeiroOverrides"
  | "financeiroAdminSettings"
> & {
  industrialPieceEdits?: IndustrialPieceEditsStore;
  workspaceBoxes?: ProjectState["workspaceBoxes"];
};

/** P3.5 — summary SSOT; pecas mantidas para vista online (lista). */
export function buildResumoFinanceiroPdfRows(
  project: IndustrialBottomProjectSlice,
  materials: MaterialIndustrial[],
  showPrices: boolean
): { summary: string[][]; pecas: string[][] } {
  const boxes = project.boxes ?? [];
  const snap = computeFinanceiroUnificado(project, materials);
  const summary: string[][] = financeiroMetricRows(snap).map(([k, v]) => [k, v]);

  if (showPrices) {
    for (const row of financeiroCustoRows(snap)) {
      const valor =
        row.emBreve || row.valor == null
          ? "em breve"
          : formatCurrency(row.valor, { placement: "prefix", empty: "—" });
      summary.push([row.label, valor]);
    }
  }

  const cutlist = buildCutlistItemsForIndustrialExport({
    boxes,
    rules: project.rules,
    materialId: project.materialId,
    projectName: project.projectName,
    remates: project.remates ?? [],
    rodapes: project.rodapes ?? [],
    extractedPartsByBoxId: project.extractedPartsByBoxId,
    industrialPieceEdits: project.industrialPieceEdits,
  });

  const pecas: string[][] = cutlist.map((item) => [
    boxes.find((b) => b.id === item.boxId)?.nome ?? item.boxId ?? "—",
    item.tipo,
    `${item.dimensoes.largura}×${item.dimensoes.altura}×${item.espessura} mm`,
    String(item.quantidade),
    String(item.material ?? "—"),
  ]);

  return { summary, pecas };
}

export type FerragensTotaisArmazemRow = {
  material: string;
  ref: string;
  medida: string;
  quantidade: number;
  /** Preço unitário (€) — opcional, usado na apresentação do PDF ferragens_totais. */
  preco?: number;
};

import type { FerragensTotaisProjectSlice } from "../ferragens/ferragensTotaisSsot";

/**
 * Totais agregados para o PDF ferragens_totais (armazém):
 * chapas por material/espessura + ferragens somadas (sem caixa/peça).
 */
export function buildFerragensTotaisArmazemData(
  project: FerragensTotaisProjectSlice,
  _componentTypes: ComponentType[],
  catalogFerragens: Ferragem[],
  materials: MaterialIndustrial[]
): { materiaisChapas: FerragensTotaisArmazemRow[]; ferragens: FerragensTotaisArmazemRow[] } {
  const boxes = project.boxes ?? [];
  const projectName = project.projectName?.trim() || "Projeto";
  const items = buildCutlistItemsForIndustrialExport({
    boxes,
    rules: project.rules,
    materialId: project.materialId,
    projectName,
    remates: project.remates ?? [],
    rodapes: project.rodapes ?? [],
    extractedPartsByBoxId: project.extractedPartsByBoxId,
    industrialPieceEdits: undefined,
  });

  const chapas = computeChapasReal(items, projectName, boxes, { projectId: projectName });
  const sheetDef = getSheetDefinitionFromSettings();
  const defaultW = sheetDef.largura_mm || CHAPA_PADRAO_LARGURA;
  const defaultH = sheetDef.altura_mm || CHAPA_PADRAO_ALTURA;

  const chapasMap = new Map<
    string,
    { material: string; espessuraMm: number; qty: number; w: number; h: number }
  >();

  if (chapas.sheets.length > 0) {
    for (const s of chapas.sheets) {
      const key = `${s.material}||${s.espessuraMm}`;
      const prev = chapasMap.get(key);
      if (prev) {
        prev.qty += 1;
      } else {
        const mat = materials.find((m) => m.nome === s.material || m.id === s.material);
        chapasMap.set(key, {
          material: s.material,
          espessuraMm: s.espessuraMm,
          qty: 1,
          w: s.sheetLarguraMm || mat?.larguraChapa || defaultW,
          h: s.sheetAlturaMm || mat?.alturaChapa || defaultH,
        });
      }
    }
  } else if (chapas.totalSheets > 0) {
    const matName = sheetDef.materialName ?? "MDF";
    const esp = sheetDef.espessura_mm ?? 18;
    chapasMap.set(`${matName}||${esp}`, {
      material: matName,
      espessuraMm: esp,
      qty: chapas.totalSheets,
      w: defaultW,
      h: defaultH,
    });
  }

  const MULTIPLY = "\u00d7";
  const EM_DASH = "\u2014";
  const materiaisChapas: FerragensTotaisArmazemRow[] = [...chapasMap.values()]
    .sort((a, b) => a.material.localeCompare(b.material, "pt") || a.espessuraMm - b.espessuraMm)
    .map((r) => {
      const mat = materials.find((m) => m.nome === r.material || m.id === r.material);
      return {
        material: r.material,
        ref: mat?.id ?? EM_DASH,
        medida: `${r.w}${MULTIPLY}${r.h}${MULTIPLY}${r.espessuraMm} mm`,
        quantidade: r.qty,
      };
    });

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

  const byFerragem = new Map<string, { nome: string; ref: string; medida: string; qty: number }>();
  const catalogByNome = new Map(catalogFerragens.map((f) => [f.nome.trim().toLowerCase(), f]));
  const catalogById = new Map(catalogFerragens.map((f) => [f.id, f]));

  for (const row of industrial.rows) {
    const rawLabel = row.ferragem.trim() || EM_DASH;
    const cat =
      catalogById.get(rawLabel) ??
      catalogByNome.get(rawLabel.toLowerCase()) ??
      catalogFerragens.find((f) => f.nome.includes(rawLabel) || rawLabel.includes(f.nome));
    const key = resolveCanonicalFerragemId(cat?.id ?? rawLabel);
    const prev = byFerragem.get(key);
    const commercialName = resolveFerragemCommercialName(key, catalogById);
    if (prev) {
      prev.qty += row.qtd;
    } else {
      byFerragem.set(key, {
        nome: commercialName,
        ref: key,
        medida: cat?.medidas?.trim() || EM_DASH,
        qty: row.qtd,
      });
    }
  }

  const ferragens: FerragensTotaisArmazemRow[] = [...byFerragem.values()]
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt"))
    .map((r) => ({
      material: r.nome,
      ref: r.ref,
      medida: r.medida,
      quantidade: r.qty,
    }));

  return { materiaisChapas, ferragens };
}

function isDobradicaFerragemLabel(nome: string): boolean {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .includes("dobradica");
}

export function buildFerragensTotaisPdfData(
  project: FerragensTotaisProjectSlice,
  componentTypes: ComponentType[],
  catalogFerragens: Ferragem[]
): { detalhe: string[][]; porTipo: string[][]; totalQty: number } {
  const boxes = project.boxes ?? [];
  const normalized = buildFerragensTotaisNormalized(project, componentTypes, catalogFerragens, []);
  const cutlistItems = normalized.cutlistItems;

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

  const detalhe = industrial.rows
    .filter((r) => !isDobradicaFerragemLabel(r.ferragem))
    .map((r) => [r.caixa || r.peca, r.ferragem, String(r.qtd), r.material, r.nQr]);

  for (const box of boxes) {
    const qty =
      countDobradicasPorCaixaForPdf(cutlistItems, [box], project.rules)[0]?.quantidade ?? 0;
    if (qty <= 0) continue;
    const w90 = boxHasCornerFixedFront(box);
    detalhe.push([
      box.nome?.trim() || box.id,
      w90 ? DOBRADICA_W90_NOME : "Dobradi\u00e7a",
      String(qty),
      "35mm",
      w90 ? "W90" : DOBRADICA_REF,
    ]);
  }

  const calcoCfg = loadCalcoConfig();
  for (const box of boxes) {
    const n00 =
      boxHasCornerFixedFront(box)
        ? 0
        : countDobradicasPorCaixaForPdf(cutlistItems, [box], project.rules)[0]?.quantidade ?? 0;
    if (calcoCfg.refs["00"].ativo && n00 > 0) {
      detalhe.push([
        box.nome?.trim() || box.id,
        CALCO_MATERIAL,
        String(n00),
        "37mm",
        "00",
      ]);
    }
    const n03 = countPortasFrenteFixa(box);
    if (calcoCfg.refs["03"].ativo && n03 > 0) {
      detalhe.push([
        box.nome?.trim() || box.id,
        CALCO_MATERIAL,
        String(n03),
        "37mm",
        "03",
      ]);
    }
  }

  const peCfg = loadPesPlasticoConfig();
  for (const pe of listPesPlasticoPorCaixa(boxes, project.rules, peCfg)) {
    detalhe.push([pe.caixa, PE_PLASTICO_NOME, String(pe.quantidade), pe.medida, formatCurrency(pe.precoTotal)]);
  }
  for (const p of listParafuso3x30PorCaixa(boxes, project.rules, peCfg)) {
    detalhe.push([p.caixa, PARAFUSO_3X30_NOME, String(p.quantidade), p.medida, formatCurrency(p.precoTotal)]);
  }
  const pushFreeagemDetalhe = (
    rows: Array<{ caixa: string; quantidade: number; medida: string; precoTotal: number }>,
    nome: string
  ) => {
    for (const p of rows) {
      detalhe.push([p.caixa, nome, String(p.quantidade), p.medida, formatCurrency(p.precoTotal)]);
    }
  };
  pushFreeagemDetalhe(
    listParafuso4x35PorCaixa(boxes, project.remates, project.workspaceBoxes),
    PARAFUSO_4X35_NOME
  );
  pushFreeagemDetalhe(listParafuso5x50PorCaixa(boxes), PARAFUSO_5X50_NOME);
  pushFreeagemDetalhe(listPuxa8mmPorCaixa(boxes), PUXA_8MM_NOME);

  const aggregated = aggregateFerragensByCommercialName(normalized.ferragens);
  const porTipo = aggregated.map((row) => [row.material, String(row.quantidade)]);

  return { detalhe, porTipo, totalQty: normalized.totalQty };
}

/** P3.5 — alias do SSOT financeiro (totais = resumo detalhado). */
export function buildTotaisProjetoPdfRows(
  project: IndustrialBottomProjectSlice,
  materials: MaterialIndustrial[],
  showPrices: boolean,
  _extras?: {
    totalOrlaMetros?: number;
    custoTotalOrla?: number;
    custoTotalRemates?: number;
    custoTotalPaineis?: number;
    custoTotalPortas?: number;
    custoTotalGavetas?: number;
    custoTotalFerragens?: number;
    custoTotal?: number;
  }
): string[][] {
  const { summary } = buildResumoFinanceiroPdfRows(project, materials, showPrices);
  return summary;
}

export function buildResumoIndustriaisRows(
  items: CutListItemComPreco[],
  boxes: BoxModule[],
  pieceObservacoes?: PieceObservacoesStore,
  industrialPieceEdits?: IndustrialPieceEditsStore,
  materials: MaterialIndustrial[] = []
): Array<{
  caixa: string;
  peca: string;
  dimensoes: string;
  areaM2: number;
  pesoKg: number;
  consumoM2: number;
  observacoes: string;
  modified: boolean;
}> {
  const boxNomeById = Object.fromEntries(boxes.map((b) => [b.id, b.nome?.trim() || b.id]));
  return items.map((item) => {
    const obs = formatObservacoesForPdf(
      resolveObservacoesForCutListItem(item, { pieceObservacoes })
    );
    const edit = industrialPieceEdits?.[item.id];
    const metrics = computeIndustrialPieceMetrics(item, materials);
    return {
      caixa: boxNomeById[item.boxId ?? ""] ?? item.boxId ?? "—",
      peca: item.tipo,
      dimensoes: `${item.dimensoes.largura}×${item.dimensoes.altura}×${item.espessura} mm`,
      areaM2: metrics.consumoM2,
      pesoKg: metrics.pesoKg,
      consumoM2: metrics.consumoM2,
      observacoes: obs,
      modified: isIndustrialPieceEdited(edit) || (obs.length > 0 && obs !== "—"),
    };
  });
}
