/**
 * P3.7/P3.8 — Builder SSOT — Financeiro pecas.
 * Linhas por peca: cutlist + indicadores + breakdown de preco.
 * Nao altera CNC/TCN, IVA, ADM, montagem nem portes.
 */

import type { ProjectState } from "../../context/projectTypes";
import type { CutListItemComPreco } from "../types";
import type { MaterialIndustrial } from "../manufacturing/materials";
import { DENSIDADE_PADRAO } from "../manufacturing/materials";
import { buildCutlistItemsForIndustrialExport } from "../fabrication/buildCutlistItemsForIndustrialExport";
import { panelIdFromCutListItem } from "../observacoes/ObservacoesService";
import { computeOrlaFerragem, lookupPieceOrlaConfig } from "../orla/orlaCalculator";
import { DEFAULT_ORLA_PRESETS } from "../orla/orlaPresets";
import { ORLA_SIDES, type PieceOrlaConfig } from "../orla/orlaTypes";
import { COMPONENT_TYPES_DEFAULT, type ComponentType } from "../components/componentTypes";
import { FERRAGENS_DEFAULT, type Ferragem } from "../ferragens/ferragens";
import { safeGetItem } from "../../utils/storage";
import { getSettings } from "../settings/settingsService";
import {
  buildIndustrialListPiecesPerSheet,
  resolveIndustrialListNqr,
} from "../pdf/industrialListQr";
import { formatEtqForPdf } from "../pdf/pdfIndustrialListShell";
import { classifyFinanceiroCustoKey } from "./financeiroUnificado";
import { isBundledSheetWoodTipo } from "./industrialWoodFinanceRules";
import {
  computeFinanceiroUnificado,
  type FinanceiroUnificadoProjectSlice,
} from "./financeiroUnificado";
import type { FinanceiroCustoMaterialKey } from "./financeiroUnificadoTypes";
import { FINANCEIRO_CUSTO_MATERIAL_KEYS } from "./financeiroUnificadoTypes";
import {
  loadComponentTypesForPricing,
  loadFerragensCatalogForPricing,
  priceFerragensFromCatalog,
} from "./priceFerragensFromCatalog";
import {
  computeOperacoesFinanceiras,
  pieceHasCncOperacao,
} from "./computeOperacoesFinanceiras";
import { computeDesperdicioSerragemFinanceiras } from "./computeDesperdicioSerragemFinanceiras";
import { computeCustosAvancadosFinanceiras } from "./computeCustosAvancadosFinanceiras";
import { computeOperacoesIndustriaisAvancadas } from "./computeOperacoesIndustriaisAvancadas";
import { computeChapasReal, hasChapasSheets, isChapasRealOficial } from "../industrial/computeChapasReal";
import { deriveCustoChapaReal } from "./deriveCustoChapaReal";
import { priceChapasSheetsEur } from "./priceChapasSheetsEur";
import { FINANCEIRO_PIECE_MATERIAL_KEYS } from "./financeiroUnificadoTypes";

/** @deprecated P3.9 F3a — tarifas passam a Orçamentos (defaults 0). Mantido para compat. */
export const FINANCEIRO_PECAS_CNC_EUR_POR_UNIDADE = 0;
export const FINANCEIRO_PECAS_DRILL_EUR_POR_FURO = 0;

const CHECK = "\u2714";
const EM_DASH = "\u2014";
const MULTIPLY = "\u00d7";

export type FinanceiroPecaRow = {
  pieceId: string;
  caixa: string;
  tipo: string;
  material: string;
  qtd: number;
  dimensoes: string;
  pesoKg: number;
  hasOrla: boolean;
  hasCnc: boolean;
  hasDrill: boolean;
  ferragensQty: number;
  etq: string;
  /** Material (chapa), com escala de override de categoria. */
  precoMaterial: number;
  /** Orla atribuida a esta peca (linhas ferragemOrla / computeOrlaFerragem). */
  precoOrla: number;
  /** Ferragens do tipo da peca (catalogo x qtd). */
  precoFerragens: number;
  /** CNC + Drill (+ especiais futuros). */
  precoOperacoes: number;
  /** P3.9 F3b — quota desperdicio (rateio area). */
  precoDesperdicio: number;
  /** P3.9 F3b — quota serragem (rateio area). */
  precoSerragem: number;
  /** P3.9 F3c — quota chapas reais (0 se por_peca). */
  precoChapasShare: number;
  /** P3.9 F3c — quota mao de obra. */
  precoMaoDeObra: number;
  /** P3.9 F3c — quota logistica (peso/area). */
  precoLogistica: number;
  /** P3.9 F4 — ops industriais avançadas (foros/grupos/rasgo/corte/quadrilha). */
  precoOperacoesAvancadas: number;
  precoForos: number;
  precoGrupos: number;
  precoRasgo: number;
  precoCorteManual: number;
  precoQuadrilha: number;
  /** Soma: material + orla + ferragens + operacoes + desp + serragem + F3c + F4. */
  precoFinalDaPeca: number;
  /** Alias de precoFinalDaPeca (compat UI/PDF). */
  preco: number;
  custoKey: FinanceiroCustoMaterialKey;
};

export type FinanceiroPecasBuildInput = FinanceiroUnificadoProjectSlice &
  Pick<ProjectState, "orlaPieces" | "orlaPresets" | "rules"> &
  Partial<Pick<ProjectState, "orlaJuntoPairs" | "ferragemOrla">> & {
    industrialPieceEdits?: ProjectState["industrialPieceEdits"];
  };

const TIPO_TO_COMPONENT_ID: Record<string, string> = {
  cima: "cima",
  fundo: "fundo",
  lateral_esquerda: "lateral_esquerda",
  lateral_direita: "lateral_direita",
  COSTA: "costa",
  costa: "costa",
  prateleira: "prateleira",
  porta_dupla: "porta",
  porta_simples: "porta",
  porta_correr: "porta",
  gaveta_frente: "gaveta_frente",
  gaveta_frente_ext: "gaveta_frente",
  gaveta_lat_esq: "gaveta_lat_esq",
  gaveta_lat_dir: "gaveta_lat_dir",
  gaveta_fundo: "gaveta_fundo",
  gaveta_traseira: "gaveta_traseira",
};

const JOINT_FERRAGEM_IDS = new Set(["parafuso_4x50"]);
const JOINT_COUNT_PIECE_TIPOS = new Set(["cima", "fundo"]);

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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

function loadFerragensCatalog(): Ferragem[] {
  const raw = safeGetItem("pimo_ferragens");
  if (!raw) return FERRAGENS_DEFAULT;
  try {
    const parsed = JSON.parse(raw) as Ferragem[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : FERRAGENS_DEFAULT;
  } catch {
    return FERRAGENS_DEFAULT;
  }
}

function pieceWeightKg(item: CutListItemComPreco, materials: MaterialIndustrial[]): number {
  const largura = item.dimensoes?.largura ?? 0;
  const altura = item.dimensoes?.altura ?? 0;
  const espessura = item.espessura ?? item.dimensoes?.profundidade ?? 18;
  const qty = item.quantidade ?? 1;
  const mat = materials.find(
    (m) => m.nome === item.material || m.id === item.material || m.id === item.materialId
  );
  const densidade = mat?.densidade ?? DENSIDADE_PADRAO;
  return ((largura * altura * espessura * qty) / 1_000_000_000) * densidade;
}

function pieceHasOrla(
  item: CutListItemComPreco,
  orlaPieces: Record<string, PieceOrlaConfig> | undefined
): boolean {
  const metaOrla = item.metadata?.orla as PieceOrlaConfig["sides"] | undefined;
  if (metaOrla && typeof metaOrla === "object") {
    for (const side of ORLA_SIDES) {
      if (metaOrla[side]?.enabled) return true;
    }
  }
  const key = panelIdFromCutListItem(item);
  const cfg = lookupPieceOrlaConfig(key, orlaPieces ?? {});
  if (!cfg) return false;
  return ORLA_SIDES.some((side) => cfg.sides[side]?.enabled);
}

function pieceHasDrill(item: CutListItemComPreco): boolean {
  return (item.drillHoles?.length ?? 0) > 0;
}

function iterFerragemDefs(
  item: CutListItemComPreco,
  ctById: Record<string, ComponentType>,
  onDef: (_ferragemId: string, _qtd: number) => void
): void {
  const componentId = TIPO_TO_COMPONENT_ID[item.tipo] ?? item.tipo;
  const ct = ctById[componentId];
  const defs = ct?.ferragens_default ?? [];
  if (defs.length === 0) return;

  const pieceTipo = String(item.tipo ?? "");
  const qtyMult = Math.max(1, item.quantidade ?? 1);
  for (const def of defs) {
    if (JOINT_FERRAGEM_IDS.has(def.ferragem_id) && !JOINT_COUNT_PIECE_TIPOS.has(pieceTipo)) {
      continue;
    }
    const qtdBase =
      def.quantidade_fixa ??
      (def.quantidade_por_lado != null
        ? def.quantidade_por_lado * Math.max(1, def.aplicar_em?.length ?? 1)
        : 1);
    onDef(def.ferragem_id, qtdBase * qtyMult);
  }
}

function countFerragensForPiece(
  item: CutListItemComPreco,
  ctById: Record<string, ComponentType>
): number {
  let total = 0;
  iterFerragemDefs(item, ctById, (_id, qtd) => {
    total += qtd;
  });
  return total;
}

function priceFerragensForPiece(
  item: CutListItemComPreco,
  ctById: Record<string, ComponentType>,
  ferragemById: Map<string, Ferragem>
): number {
  let total = 0;
  iterFerragemDefs(item, ctById, (ferragemId, qtd) => {
    const unit = ferragemById.get(ferragemId)?.precoUnitario ?? 0;
    total += unit * qtd;
  });
  return round2(total);
}

function buildOrlaCustoByPieceId(
  project: FinanceiroPecasBuildInput
): Map<string, number> {
  const map = new Map<string, number>();
  const existing = project.ferragemOrla?.linhas;
  const linhas =
    existing && existing.length > 0
      ? existing
      : computeOrlaFerragem({
          boxes: project.boxes ?? [],
          orlaPresets:
            project.orlaPresets && project.orlaPresets.length > 0
              ? project.orlaPresets
              : DEFAULT_ORLA_PRESETS,
          orlaPieces: project.orlaPieces ?? {},
          orlaJuntoPairs: project.orlaJuntoPairs ?? [],
        }).linhas;

  for (const linha of linhas) {
    const pid = String(linha.pieceId ?? "").trim();
    if (!pid) continue;
    map.set(pid, round2((map.get(pid) ?? 0) + (Number(linha.custo) || 0)));
  }
  return map;
}

function resolveEtq(
  item: CutListItemComPreco,
  projectName: string,
  boxes: ProjectState["boxes"],
  rules: ProjectState["rules"],
  piecesPerSheet: Map<string, number>,
  index0: number
): string {
  const nqr = resolveIndustrialListNqr(
    item,
    { projectName, boxes: boxes ?? [], rules },
    piecesPerSheet,
    index0
  );
  return formatEtqForPdf(nqr) || String(item.pieceNumber ?? EM_DASH);
}

/**
 * Constroi as linhas da tabela Financeiro pecas (SSOT P3.8).
 * Overrides de categoria escalam apenas o material (nao orla/ferragens/ops).
 */
export function buildFinanceiroPecasRows(
  project: FinanceiroPecasBuildInput,
  materials: MaterialIndustrial[] = []
): FinanceiroPecaRow[] {
  const boxes = project.boxes ?? [];
  const projectName = project.projectName?.trim() || "Projeto";
  const cutlist = buildCutlistItemsForIndustrialExport({
    boxes,
    rules: project.rules,
    materialId: project.materialId,
    projectName,
    remates: project.remates ?? [],
    rodapes: project.rodapes ?? [],
    extractedPartsByBoxId: project.extractedPartsByBoxId,
    industrialPieceEdits: project.industrialPieceEdits,
  });
  const snap = computeFinanceiroUnificado(project, materials);

  const scales = {} as Record<FinanceiroCustoMaterialKey, number>;
  for (const key of FINANCEIRO_CUSTO_MATERIAL_KEYS) {
    const computed = snap.custosComputed[key];
    const effective = snap.custosEffective[key];
    scales[key] = computed > 0 ? effective / computed : 1;
  }

  const ctById = Object.fromEntries(loadComponentTypes().map((ct) => [ct.id, ct]));
  const ferragemById = new Map(loadFerragensCatalog().map((f) => [f.id, f]));
  const enableUnificacao =
    getSettings().orcamentos?.ferragens?.enableUnificacao === true;
  const pricedUnified = enableUnificacao
    ? priceFerragensFromCatalog({
        cutlist,
        componentTypes: loadComponentTypesForPricing(),
        catalog: loadFerragensCatalogForPricing(),
      })
    : null;
  const boxNomeById = Object.fromEntries(boxes.map((b) => [b.id, b.nome?.trim() || b.id]));
  const piecesPerSheet = buildIndustrialListPiecesPerSheet(cutlist);
  const orlaPieces = project.orlaPieces ?? {};
  const orlaByPiece = buildOrlaCustoByPieceId(project);
  const opsFinanceiras = computeOperacoesFinanceiras(cutlist);
  const chapasReal = computeChapasReal(cutlist, projectName, boxes, {
    projectId: projectName,
  });
  const isOficial = isChapasRealOficial(chapasReal.mode) && hasChapasSheets(chapasReal);
  const hasSheets = hasChapasSheets(chapasReal);
  const wasteM2 = hasSheets ? chapasReal.totalWasteMm2 / 1_000_000 : 0;
  const despSerr = computeDesperdicioSerragemFinanceiras({
    cutlist,
    wasteM2,
  });
  const pesoByPieceId = new Map<string, number>();
  let pesoTotalKg = 0;
  for (const item of cutlist) {
    const id = String(item.id ?? "");
    const w = pieceWeightKg(item, materials);
    if (id) pesoByPieceId.set(id, w);
    pesoTotalKg += w;
  }
  const derivedChapa = deriveCustoChapaReal({ cutlist });
  const pricedSheets = hasSheets
    ? priceChapasSheetsEur(chapasReal.sheets)
    : { totalEur: 0, sheetCount: 0 };
  const nChapasParaCusto =
    chapasReal.totalSheets > 0 ? chapasReal.totalSheets : 0;
  const avancados = computeCustosAvancadosFinanceiras({
    cutlist,
    chapasCount: nChapasParaCusto,
    chapasModeReal: isOficial,
    pesoTotalKg,
    pesoByPieceId,
    custoChapaRealDerived: derivedChapa.custoChapaReal,
    precoChapasSheetsEur: hasSheets ? pricedSheets.totalEur : undefined,
  });
  const opsAvancadas = computeOperacoesIndustriaisAvancadas(cutlist);
  const pieceMaterialKeySet = new Set<string>(FINANCEIRO_PIECE_MATERIAL_KEYS);
  let industrialChapasMode = false;
  try {
    industrialChapasMode =
      getSettings().orcamentos?.custosIndustriais?.materialCostMode === "por_chapas_reais";
  } catch {
    industrialChapasMode = false;
  }

  return cutlist.map((item, index0) => {
    const custoKeyRaw = classifyFinanceiroCustoKey(String(item.tipo ?? ""));
    const custoKey: FinanceiroCustoMaterialKey =
      custoKeyRaw === "adm" ||
      custoKeyRaw === "montagem" ||
      custoKeyRaw === "portes" ||
      custoKeyRaw === "operacoes" ||
      custoKeyRaw === "desperdicio" ||
      custoKeyRaw === "serragem" ||
      custoKeyRaw === "chapasReais" ||
      custoKeyRaw === "maoDeObra" ||
      custoKeyRaw === "logistica" ||
      custoKeyRaw === "operacoesAvancadas"
        ? "paineis"
        : (custoKeyRaw as FinanceiroCustoMaterialKey);

    // Modo chapas: madeira de porta/gaveta/remate = 0; suppress zera Painéis/portas/remates.
    const suppressWood =
      (avancados.suppressPieceMaterial && pieceMaterialKeySet.has(custoKey)) ||
      (industrialChapasMode && isBundledSheetWoodTipo(String(item.tipo ?? "")));
    const baseMaterial = suppressWood ? 0 : Number(item.precoTotal) || 0;
    const precoMaterial = round2(baseMaterial * (scales[custoKey] ?? 1));
    const pieceKey = panelIdFromCutListItem(item);
    const precoOrla = orlaByPiece.get(pieceKey) ?? orlaByPiece.get(item.id) ?? 0;
    const precoFerragens = pricedUnified
      ? pricedUnified.eurByPieceId.get(item.id) ?? 0
      : priceFerragensForPiece(item, ctById, ferragemById);
    const hasCnc = pieceHasCncOperacao(item);
    const hasDrill = pieceHasDrill(item);
    const precoOperacoes = opsFinanceiras.eurByPieceId.get(item.id) ?? 0;
    const precoDesperdicio = despSerr.desperdicioByPieceId.get(item.id) ?? 0;
    const precoSerragem = despSerr.serragemByPieceId.get(item.id) ?? 0;
    const precoChapasShare = avancados.chapasByPieceId.get(item.id) ?? 0;
    const precoMaoDeObra = avancados.maoDeObraByPieceId.get(item.id) ?? 0;
    const precoLogistica = avancados.logisticaByPieceId.get(item.id) ?? 0;
    const precoForos = opsAvancadas.forosByPieceId.get(item.id) ?? 0;
    const precoGrupos = opsAvancadas.gruposByPieceId.get(item.id) ?? 0;
    const precoRasgo = opsAvancadas.rasgoByPieceId.get(item.id) ?? 0;
    const precoCorteManual = opsAvancadas.corteByPieceId.get(item.id) ?? 0;
    const precoQuadrilha = opsAvancadas.quadrilhaByPieceId.get(item.id) ?? 0;
    const precoOperacoesAvancadas = opsAvancadas.eurByPieceId.get(item.id) ?? 0;
    const precoFinalDaPeca = round2(
      precoMaterial +
        precoOrla +
        precoFerragens +
        precoOperacoes +
        precoDesperdicio +
        precoSerragem +
        precoChapasShare +
        precoMaoDeObra +
        precoLogistica +
        precoOperacoesAvancadas
    );

    const L = item.dimensoes?.largura ?? 0;
    const A = item.dimensoes?.altura ?? 0;
    const E = item.espessura ?? item.dimensoes?.profundidade ?? 0;

    return {
      pieceId: item.id,
      caixa: boxNomeById[item.boxId ?? ""] ?? item.boxId ?? EM_DASH,
      tipo: String(item.tipo ?? item.nome ?? EM_DASH),
      material: String(item.material ?? item.materialId ?? EM_DASH),
      qtd: item.quantidade ?? 1,
      dimensoes: `${L}${MULTIPLY}${A}${MULTIPLY}${E}`,
      pesoKg: pieceWeightKg(item, materials),
      hasOrla: pieceHasOrla(item, orlaPieces),
      hasCnc,
      hasDrill,
      ferragensQty: pricedUnified
        ? pricedUnified.qtyByPieceId.get(item.id) ?? 0
        : countFerragensForPiece(item, ctById),
      etq: resolveEtq(item, projectName, boxes, project.rules, piecesPerSheet, index0),
      precoMaterial,
      precoOrla,
      precoFerragens,
      precoOperacoes,
      precoDesperdicio,
      precoSerragem,
      precoChapasShare,
      precoMaoDeObra,
      precoLogistica,
      precoOperacoesAvancadas,
      precoForos,
      precoGrupos,
      precoRasgo,
      precoCorteManual,
      precoQuadrilha,
      precoFinalDaPeca,
      preco: precoFinalDaPeca,
      custoKey,
    };
  });
}

/** Linhas prontas para PDF (strings). */
export function buildFinanceiroPecasPdfRows(
  project: FinanceiroPecasBuildInput,
  materials: MaterialIndustrial[],
  showPrices: boolean
): string[][] {
  const rows = buildFinanceiroPecasRows(project, materials);
  return rows.map((r) => {
    const base = [
      r.caixa,
      r.tipo,
      r.material,
      String(r.qtd),
      r.dimensoes,
      r.pesoKg.toFixed(2),
      r.hasOrla ? CHECK : "",
      r.hasCnc ? CHECK : "",
      r.hasDrill ? CHECK : "",
      r.ferragensQty > 0 ? String(r.ferragensQty) : "",
      r.etq,
    ];
    if (showPrices) base.push(r.precoFinalDaPeca.toFixed(2));
    return base;
  });
}

export function financeiroPecasPdfHead(showPrices: boolean): string[] {
  const head = [
    "Caixa",
    "Tipo",
    "Material",
    "Qtd",
    `L${MULTIPLY}A${MULTIPLY}E`,
    "Peso",
    "Orla",
    "CNC",
    "Drill",
    "Ferr.",
    "N\u00ba ETQ",
  ];
  if (showPrices) head.push("Pre\u00e7o (\u20ac)");
  return head;
}
