/**
 * P3.5/P3.6 — Financeiro Unificado (SSOT).
 * Total = materiais + ADM + montagem + portes + IVA(materiais).
 * Sem margem comercial.
 */

import type { ProjectState } from "../../context/projectTypes";
import type { BoxModule, CutListItemComPreco } from "../types";
import type { MaterialIndustrial } from "../manufacturing/materials";
import {
  CHAPA_PADRAO_ALTURA,
  CHAPA_PADRAO_LARGURA,
  DENSIDADE_PADRAO,
} from "../manufacturing/materials";
import { buildCutlistItemsForIndustrialExport } from "../fabrication/buildCutlistItemsForIndustrialExport";
import { computeChapasReal, hasChapasSheets, isChapasRealOficial } from "../industrial/computeChapasReal";
import { deriveCustoChapaReal } from "./deriveCustoChapaReal";
import { priceChapasSheetsEur } from "./priceChapasSheetsEur";
import { getSettings } from "../settings/settingsService";
import { isDrawerPieceTipo } from "../../services/drawerCutlistAdapter";
import { isIndustrialDoorPanelTipo } from "../doors/industrialDoorPanels";
import type { IndustrialPieceEditsStore } from "../industrial/industrialPieceEditsTypes";
import { getCentralPricingCached } from "../pricing/centralPricingConfig";
import {
  computeFinanceiroAdminCustos,
  defaultFinanceiroAdminSettings,
  loadGlobalFinanceiroAdminSettings,
  normalizeFinanceiroAdminSettings,
  type FinanceiroAdminSettings,
} from "./financeiroAdminRules";
import { compareFerragensAvsB } from "./priceFerragensFromCatalog";
import { computeFerragensUnificadoSsot } from "./ferragensUnificadoLines";
import { computeOperacoesFinanceiras } from "./computeOperacoesFinanceiras";
import {
  computeDesperdicioSerragemFinanceiras,
  estimateSerragemM2,
} from "./computeDesperdicioSerragemFinanceiras";
import { computeCustosAvancadosFinanceiras } from "./computeCustosAvancadosFinanceiras";
import { computeOperacoesIndustriaisAvancadas } from "./computeOperacoesIndustriaisAvancadas";
import { computeMontagemGavetasEur } from "./drawerAssemblyCost";
import {
  isFallbackCarcassWoodTipo,
} from "./industrialWoodFinanceRules";
import {
  computeOrlaFerragem,
  syncOrlaPiecesForProject,
} from "../orla/orlaCalculator";
import { normalizeOrlaPresets, DEFAULT_ORLA_PRESETS } from "../orla/orlaPresets";
import type { CutListItem } from "../types";
import {
  FINANCEIRO_CUSTO_MATERIAL_KEYS,
  FINANCEIRO_IVA_DEFAULT_PCT,
  FINANCEIRO_PIECE_MATERIAL_KEYS,
  normalizeFinanceiroOverrides,
  type FinanceiroCustoKey,
  type FinanceiroOverrides,
  type FinanceiroUnificadoSnapshot,
} from "./financeiroUnificadoTypes";
import { financeiroChapasMetricLabel } from "./financeiroChapasModeLabels";

/** Recalcula orla industrial (nunca confiar em ferragemOrla stale). */
function computeOrlaFinanceirasLive(
  boxes: BoxModule[],
  cutlist: CutListItemComPreco[],
  orlaPresetsRaw?: unknown
): { metros: number; custo: number } {
  if (boxes.length === 0) return { metros: 0, custo: 0 };
  const orlaPresets = normalizeOrlaPresets(
    Array.isArray(orlaPresetsRaw) ? (orlaPresetsRaw as never) : DEFAULT_ORLA_PRESETS
  );
  const defaultOrlaId = orlaPresets[0]?.id ?? null;
  const extrasByBoxId: Record<string, CutListItem[]> = {};
  for (const item of cutlist) {
    const bid = String(item.boxId ?? "");
    if (!bid) continue;
    (extrasByBoxId[bid] ??= []).push(item as CutListItem);
  }
  // Usar cutList da caixa se existir; senão injetar extras do cutlist SSOT.
  const boxesForOrla = boxes.map((box) => {
    const fromCutlist = cutlist.filter((i) => i.boxId === box.id) as CutListItem[];
    if ((box.cutList?.length ?? 0) > 0) return box;
    return { ...box, cutList: fromCutlist };
  });
  const orlaPieces = syncOrlaPiecesForProject(
    boxesForOrla,
    {},
    defaultOrlaId,
    extrasByBoxId,
    orlaPresets
  );
  const ferragem = computeOrlaFerragem({
    boxes: boxesForOrla,
    orlaPresets,
    orlaPieces,
    orlaJuntoPairs: [],
    extraCutListItems: cutlist as Array<CutListItem & { boxId?: string; boxNome?: string }>,
  });
  return {
    metros: Number(ferragem.metrosTotal) || 0,
    custo: Number(ferragem.custoTotal) || 0,
  };
}

export type FinanceiroUnificadoProjectSlice = Pick<
  ProjectState,
  | "boxes"
  | "rules"
  | "materialId"
  | "projectName"
  | "remates"
  | "rodapes"
  | "extractedPartsByBoxId"
  | "ferragemOrla"
> & {
  orlaPresets?: ProjectState["orlaPresets"];
  industrialPieceEdits?: IndustrialPieceEditsStore;
  financeiroOverrides?: FinanceiroOverrides;
  financeiroAdminSettings?: FinanceiroAdminSettings;
  workspaceBoxes?: ProjectState["workspaceBoxes"];
};

function pieceWeightKg(
  item: CutListItemComPreco,
  materials: MaterialIndustrial[]
): number {
  const largura = item.dimensoes?.largura ?? 0;
  const altura = item.dimensoes?.altura ?? 0;
  const espessura = item.espessura ?? item.dimensoes?.profundidade ?? 18;
  const qty = item.quantidade ?? 1;
  const mat = materials.find(
    (m) => m.nome === item.material || m.id === item.material || m.id === item.materialId
  );
  const densidade = mat?.densidade ?? DENSIDADE_PADRAO;
  const volumeM3 = (largura * altura * espessura * qty) / 1_000_000_000;
  return volumeM3 * densidade;
}

export function classifyFinanceiroCustoKey(tipo: string): FinanceiroCustoKey {
  const t = String(tipo ?? "").toLowerCase();
  // Folhas de módulo (armário) = Painéis. Bucket «portas» reservado a portas de divisão (futuro).
  if (isIndustrialDoorPanelTipo(tipo) || isIndustrialDoorPanelTipo(t)) return "paineis";
  if (t.includes("porta")) return "portas";
  // Madeira de gaveta = Painéis. Bucket «gavetas» = só montagem N×15 € (fora do cutlist).
  if (isDrawerPieceTipo(tipo) || t.includes("gaveta")) return "paineis";
  // Remates/rodapés = madeira nas chapas/Painéis — sem linha de madeira própria (anti double-count).
  if (
    t.includes("remate") ||
    t.includes("rodape") ||
    t.includes("roda_pe") ||
    t.includes("roda-pe") ||
    t.includes("rodapé")
  ) {
    return "paineis";
  }
  return "paineis";
}

function boxVolumeMontadoM3(box: BoxModule): number {
  const d = box.dimensoes;
  const L = Number(d?.largura) || 0;
  const A = Number(d?.altura) || 0;
  const P = Number(box.profundidadeExterna ?? d?.profundidade) || 0;
  if (L <= 0 || A <= 0 || P <= 0) return 0;
  return (L * A * P) / 1_000_000_000;
}

function emptyCustos(): Record<FinanceiroCustoKey, number> {
  return {
    paineis: 0,
    portas: 0,
    gavetas: 0,
    ferragens: 0,
    orla: 0,
    remates: 0,
    operacoes: 0,
    desperdicio: 0,
    serragem: 0,
    chapasReais: 0,
    maoDeObra: 0,
    logistica: 0,
    operacoesAvancadas: 0,
    adm: 0,
    montagem: 0,
    portes: 0,
  };
}

const NON_CUTLIST_CUSTO_KEYS = new Set<FinanceiroCustoKey>([
  "adm",
  "montagem",
  "portes",
  "operacoes",
  "desperdicio",
  "serragem",
  "chapasReais",
  "maoDeObra",
  "logistica",
  "operacoesAvancadas",
]);

function resolveAdminSettings(project: FinanceiroUnificadoProjectSlice): FinanceiroAdminSettings {
  let base: FinanceiroAdminSettings;
  if (project.financeiroAdminSettings) {
    base = normalizeFinanceiroAdminSettings(project.financeiroAdminSettings);
  } else {
    try {
      const fromSystem = getSettings().financeiroAdmin;
      if (fromSystem) base = normalizeFinanceiroAdminSettings(fromSystem);
      else base = loadGlobalFinanceiroAdminSettings();
    } catch {
      try {
        base = loadGlobalFinanceiroAdminSettings();
      } catch {
        base = defaultFinanceiroAdminSettings();
      }
    }
  }

  // SSOT pricing.json custosAdicionais.adm_percentual — ignora fallback antigo 10%.
  try {
    const fromPricing = getCentralPricingCached().financeiroAdmin?.adm as
      | { enabled?: boolean; mode?: string; valor?: number }
      | undefined;
    if (fromPricing && typeof fromPricing.valor === "number" && Number.isFinite(fromPricing.valor)) {
      return normalizeFinanceiroAdminSettings({
        ...base,
        adm: {
          ...base.adm,
          enabled: fromPricing.enabled !== false,
          mode: (fromPricing.mode as "percentagem" | "fixo") ?? "percentagem",
          valor: fromPricing.valor,
        },
      });
    }
  } catch {
    /* ignore */
  }
  return base;
}

/**
 * Calcula o snapshot financeiro unificado (SSOT).
 */
export function computeFinanceiroUnificado(
  project: FinanceiroUnificadoProjectSlice,
  materials: MaterialIndustrial[] = []
): FinanceiroUnificadoSnapshot {
  const boxes = project.boxes ?? [];
  const projectName = project.projectName?.trim() || "Projeto";
  const overrides = normalizeFinanceiroOverrides(project.financeiroOverrides);
  const adminSettings = resolveAdminSettings(project);

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

  const ferragensSsot = computeFerragensUnificadoSsot(project);
  const ferragensTotais = ferragensSsot.totalQty;
  const ferragensEur = ferragensSsot.totalEur;
  let ferragensUnificacao: FinanceiroUnificadoSnapshot["ferragensUnificacao"];

  if (ferragensSsot.enableUnificacao && ferragensSsot.unificacaoMeta) {
    let compare: ReturnType<typeof compareFerragensAvsB> | undefined;
    try {
      compare = compareFerragensAvsB(boxes, project.rules, cutlist);
    } catch {
      /* STRICT */
    }
    ferragensUnificacao = {
      enabled: true,
      warnings: ferragensSsot.unificacaoMeta.warnings,
      fallbacks: ferragensSsot.unificacaoMeta.fallbacks,
      compare,
    };
  }

  const pecasTotais = cutlist.reduce((s, i) => s + (i.quantidade ?? 0), 0);

  const areaTotalMm2 = cutlist.reduce(
    (s, i) => s + (i.dimensoes?.largura ?? 0) * (i.dimensoes?.altura ?? 0) * (i.quantidade ?? 0),
    0
  );
  const areaTotalM2 = areaTotalMm2 / 1_000_000;
  // Área de montagem = Σ (L×A) das caixas — não a soma das peças do cutlist.
  const areaCaixasM2 = boxes.reduce((s, b) => {
    const L = Number(b.dimensoes?.largura) || 0;
    const A = Number(b.dimensoes?.altura) || 0;
    if (L <= 0 || A <= 0) return s;
    return s + (L * A) / 1_000_000;
  }, 0);
  const pesoTotalKg = cutlist.reduce((s, i) => s + pieceWeightKg(i, materials), 0);
  const areaTotalMontadoM3 = boxes.reduce((s, b) => s + boxVolumeMontadoM3(b), 0);

  const orlaLive = computeOrlaFinanceirasLive(boxes, cutlist, project.orlaPresets);
  const orlaTotalM = orlaLive.metros;
  const custoOrla = orlaLive.custo;

  const custosComputed = emptyCustos();
  let materialCostModeEarly: "por_peca" | "por_chapas_reais" = "por_peca";
  try {
    materialCostModeEarly =
      getSettings().orcamentos?.custosIndustriais?.materialCostMode === "por_chapas_reais"
        ? "por_chapas_reais"
        : "por_peca";
  } catch {
    materialCostModeEarly = "por_peca";
  }
  const industrialChapasMode = materialCostModeEarly === "por_chapas_reais";

  for (const item of cutlist) {
    const tipo = String(item.tipo ?? "");
    const key = classifyFinanceiroCustoKey(tipo);
    if (NON_CUTLIST_CUSTO_KEYS.has(key)) continue;
    // Modo industrial: madeira de porta/gaveta/remate não entra em nenhum bucket de madeira
    // (fica nas chapas reais ou, em fallback, só carcaça em Painéis).
    if (industrialChapasMode) {
      if (key === "portas" || key === "remates") continue;
      if (key === "paineis" && !isFallbackCarcassWoodTipo(tipo)) continue;
    }
    custosComputed[key] += Number(item.precoTotal) || 0;
  }
  // Linhas industriais: Remates e Portas nunca somam madeira.
  custosComputed.remates = 0;
  custosComputed.portas = 0;
  custosComputed.ferragens = ferragensEur;
  custosComputed.orla = custoOrla;

  const opsFinanceiras = computeOperacoesFinanceiras(cutlist);
  // Mercado 50%: tarifas pricing.json (corte/furo/rasgo/drill) a metade
  // → equivalente a custosComputed.operacoes *= 0.5 vs baseline anterior.
  custosComputed.operacoes = opsFinanceiras.precoTotal;
  const operacoesBreakdown = {
    cnc: opsFinanceiras.precoCNC,
    drill: opsFinanceiras.precoDrill,
    total: opsFinanceiras.precoTotal,
  };

  // Chapas: SSOT oficial = snapshot PRO; senão estimado A1 (N visível, € chapas = 0)
  const chapasReal = computeChapasReal(cutlist, projectName, boxes, {
    projectId: projectName,
  });
  const isOficial = isChapasRealOficial(chapasReal.mode) && hasChapasSheets(chapasReal);
  const hasSheets = hasChapasSheets(chapasReal);
  const derivedChapa = deriveCustoChapaReal({ cutlist });
  const pricedSheets = isOficial
    ? priceChapasSheetsEur(chapasReal.sheets)
    : { totalEur: 0, sheetCount: 0 };
  const wasteM2 = hasSheets ? chapasReal.totalWasteMm2 / 1_000_000 : 0;
  const serragemM2 = estimateSerragemM2(cutlist);
  const despSerr = computeDesperdicioSerragemFinanceiras({
    cutlist,
    wasteM2,
    serragemM2,
    // 18% × material de chapas (Painéis inclui folhas de módulo; portas de divisão futuras em portas).
    // Base = paineis + portas para não excluir madeira se/quando bucket portas voltar a ter valor.
    custoPaineisEur: custosComputed.paineis + custosComputed.portas,
  });
  custosComputed.desperdicio = despSerr.precoDesperdicio;
  custosComputed.serragem = despSerr.precoSerragem;
  const desperdicioSerragemWarnings = despSerr.warnings;

  const pesoByPieceId = new Map<string, number>();
  for (const item of cutlist) {
    const id = String(item.id ?? "");
    if (!id) continue;
    pesoByPieceId.set(id, pieceWeightKg(item, materials));
  }
  const avancados = computeCustosAvancadosFinanceiras({
    cutlist,
    chapasCount: isOficial ? chapasReal.totalSheets : 0,
    chapasModeReal: isOficial,
    pesoTotalKg,
    pesoByPieceId,
    custoChapaRealDerived: derivedChapa.custoChapaReal,
    precoChapasSheetsEur: isOficial ? pricedSheets.totalEur : undefined,
  });
  if (avancados.suppressPieceMaterial) {
    for (const k of FINANCEIRO_PIECE_MATERIAL_KEYS) {
      custosComputed[k] = 0;
    }
  }
  // Fase 2: bucket Gavetas = N × montagem/gaveta (não madeira; não é zerado por chapas reais).
  custosComputed.gavetas = computeMontagemGavetasEur(boxes).total;
  custosComputed.chapasReais = avancados.precoChapasReais;
  custosComputed.maoDeObra = avancados.precoMaoDeObra;
  custosComputed.logistica = avancados.precoLogistica;

  const chapasNestingWarnings: string[] = [];
  if (!isOficial && chapasReal.mode === "estimado") {
    chapasNestingWarnings.push(
      hasSheets
        ? `chapasMode=estimado (N=${chapasReal.totalSheets} fast): chapasReais€=0 — aguarda TCN/PRO oficial`
        : `chapasMode=estimado (N≈${chapasReal.totalSheets}): chapasReais€=0 — nesting fast sem sheets[]`
    );
  }
  if (chapasReal.diagnostics.length > 0) {
    chapasNestingWarnings.push(...chapasReal.diagnostics.slice(0, 6));
  }
  const custosAvancadosWarnings = [
    ...chapasNestingWarnings,
    ...derivedChapa.warnings,
    ...avancados.warnings,
  ];

  const opsAvancadas = computeOperacoesIndustriaisAvancadas(cutlist);
  custosComputed.operacoesAvancadas = opsAvancadas.precoTotal;
  const operacoesAvancadasBreakdown = {
    foros: opsAvancadas.foros,
    grupos: opsAvancadas.grupos,
    rasgos: opsAvancadas.rasgos,
    cortes: opsAvancadas.cortes,
    quadrilha: opsAvancadas.quadrilha,
    total: opsAvancadas.precoTotal,
  };

  // Materiais efetivos (com overrides) — base para ADM/montagem/portes e IVA
  const custosEffective = emptyCustos();
  const custoKeysOverridden: FinanceiroCustoKey[] = [];
  for (const key of FINANCEIRO_CUSTO_MATERIAL_KEYS) {
    // Remates e Portas: madeira nas chapas — sem preço próprio (ignorar override fantasma).
    if (key === "remates" || key === "portas") {
      custosEffective[key] = 0;
      continue;
    }
    const ov = overrides.custos?.[key];
    if (typeof ov === "number" && Number.isFinite(ov) && ov >= 0) {
      custosEffective[key] = ov;
      custoKeysOverridden.push(key);
    } else {
      custosEffective[key] = custosComputed[key];
    }
  }

  const subtotal = FINANCEIRO_CUSTO_MATERIAL_KEYS.reduce((s, k) => s + custosEffective[k], 0);

  const distanciaKm =
    typeof overrides.distanciaKm === "number" && Number.isFinite(overrides.distanciaKm)
      ? overrides.distanciaKm
      : adminSettings.distanciaKmDefault;

  // Portes = 0 sem escolha explícita (incluirPortes ou override manual de custos.portes).
  const portesOverride = overrides.custos?.portes;
  const hasManualPortesOverride =
    typeof portesOverride === "number" && Number.isFinite(portesOverride) && portesOverride >= 0;
  const hasExplicitPortes = overrides.incluirPortes === true || hasManualPortesOverride;

  const adminSettingsForCalc: FinanceiroAdminSettings = hasExplicitPortes
    ? {
        ...adminSettings,
        // Com escolha explícita, aplicar tarifas mesmo se o default admin estiver off.
        portes: { ...adminSettings.portes, enabled: true },
      }
    : {
        ...adminSettings,
        portes: { ...adminSettings.portes, enabled: false },
      };

  const adminCalc = computeFinanceiroAdminCustos({
    subtotalMateriais: subtotal,
    caixas: boxes.length,
    areaTotalM2: areaCaixasM2,
    pesoTotalKg,
    volumeMontadoM3: areaTotalMontadoM3,
    distanciaKm,
    settings: adminSettingsForCalc,
  });

  custosComputed.adm = adminCalc.adm;
  custosComputed.montagem = adminCalc.montagem;
  custosComputed.portes = hasExplicitPortes ? adminCalc.portes : 0;

  for (const key of ["adm", "montagem", "portes"] as const) {
    const ov = overrides.custos?.[key];
    if (typeof ov === "number" && Number.isFinite(ov) && ov >= 0) {
      custosEffective[key] = ov;
      custoKeysOverridden.push(key);
    } else {
      custosEffective[key] = custosComputed[key];
    }
  }

  const ivaPct =
    typeof overrides.ivaPct === "number" && Number.isFinite(overrides.ivaPct)
      ? overrides.ivaPct
      : (() => {
          try {
            const fromSettings = getSettings().ivaPctDefault;
            if (typeof fromSettings === "number" && Number.isFinite(fromSettings)) return fromSettings;
          } catch {
            /* ignore */
          }
          return FINANCEIRO_IVA_DEFAULT_PCT;
        })();
  // IVA sobre subtotal de materiais (antes de ADM/montagem/portes) — P3.5 confirmado
  const ivaValor = subtotal * (ivaPct / 100);
  const subtotalComAdmin =
    subtotal + custosEffective.adm + custosEffective.montagem + custosEffective.portes;
  const totalProjeto = subtotalComAdmin + ivaValor;

  const areaChapaMm2 = CHAPA_PADRAO_LARGURA * CHAPA_PADRAO_ALTURA;
  const chapasEstimadas = areaTotalMm2 > 0 ? Math.ceil(areaTotalMm2 / areaChapaMm2) : 0;

  return {
    caixas: boxes.length,
    pecasTotais,
    areaTotalM2,
    pesoTotalKg,
    areaTotalMontadoM3,
    chapas: {
      count: hasSheets ? chapasReal.totalSheets : chapasEstimadas,
      mode: isOficial ? "oficial_pro" : "estimado",
      diagnostics: chapasReal.diagnostics.length > 0 ? chapasReal.diagnostics : undefined,
    },
    desperdicioTotalM2: wasteM2,
    serragemTotalM2: serragemM2,
    ferragensTotais,
    orlaTotalM,
    custosComputed,
    custosEffective,
    custoKeysOverridden,
    ivaPct,
    distanciaKm: adminCalc.distanciaKm,
    subtotal,
    subtotalComAdmin,
    ivaValor,
    totalProjeto,
    overrides,
    adminSettings,
    operacoesBreakdown,
    desperdicioSerragemWarnings,
    custosAvancadosWarnings,
    materialCostMode: avancados.materialCostMode,
    chapasReaisMeta: {
      countMonetizado: isOficial ? chapasReal.totalSheets : 0,
      // Média efectiva €/chapa (só meta UI); € oficial = pricedSheets.totalEur via avancados.
      custoChapaDerived:
        isOficial && pricedSheets.sheetCount > 0
          ? Math.round((pricedSheets.totalEur / pricedSheets.sheetCount) * 100) / 100
          : derivedChapa.custoChapaReal,
      nestingMode: isOficial ? "oficial_pro" : "estimado",
    },
    operacoesAvancadasBreakdown,
    ferragensUnificacao,
  };
}

/** Linhas PDF/UI de métricas (bloco A). */
export function financeiroMetricRows(snap: FinanceiroUnificadoSnapshot): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ["Caixas", String(snap.caixas)],
    ["Peças totais", String(snap.pecasTotais)],
    ["Área total", `${snap.areaTotalM2.toFixed(3)} m²`],
    ["Peso total", `${snap.pesoTotalKg.toFixed(2)} kg`],
    ["Área total montado", `${snap.areaTotalMontadoM3.toFixed(3)} m³`],
    [financeiroChapasMetricLabel(snap.chapas.mode), String(snap.chapas.count)],
    ["Desperdício total", `${snap.desperdicioTotalM2.toFixed(3)} m²`],
    ["Serragem total", `${snap.serragemTotalM2.toFixed(3)} m²`],
    ["Ferragens totais", String(snap.ferragensTotais)],
    ["Orla total", `${snap.orlaTotalM.toFixed(2)} m`],
    ["Distância (portes)", `${snap.distanciaKm.toFixed(1)} km`],
  ];
  if (snap.materialCostMode === "por_chapas_reais") {
    rows.push(["Modo material", "Por chapas reais (exclusivo)"]);
  }
  return rows;
}

function labelPaineis(_snap: FinanceiroUnificadoSnapshot): string {
  return "Painéis";
}

/** Linhas de custos (bloco B) — valores efetivos. */
export function financeiroCustoRows(
  snap: FinanceiroUnificadoSnapshot
): Array<{ label: string; valor: number | null; emBreve?: boolean; total?: boolean }> {
  /** Painéis na UI = madeira (peça ou chapas reais) — sem duplicar chapasReais. */
  const paineisDisplay =
    (Number(snap.custosEffective.paineis) || 0) +
    (Number(snap.custosEffective.chapasReais) || 0);

  const rows: Array<{ label: string; valor: number | null; emBreve?: boolean; total?: boolean }> = [
    { label: labelPaineis(snap), valor: paineisDisplay },
    { label: "Portas", valor: snap.custosEffective.portas },
    {
      label: "Gavetas",
      valor: snap.custosEffective.gavetas,
    },
    { label: "Ferragens", valor: snap.custosEffective.ferragens },
    { label: "Orla", valor: snap.custosEffective.orla },
  ];
  // Remates só aparecem com valor > 0 (Unificado força 0 no modo industrial).
  if ((snap.custosEffective.remates ?? 0) > 0) {
    rows.push({ label: "Remates / Rodapés", valor: snap.custosEffective.remates });
  }
  rows.push(
    { label: "Operações (CNC/Drill)", valor: snap.custosEffective.operacoes },
    { label: "Desperdício", valor: snap.custosEffective.desperdicio },
    { label: "Serragem", valor: snap.custosEffective.serragem },
    // «Chapas reais» não aparece na UI — madeira/chapas ficam em Painéis.
    { label: "Mão de obra", valor: snap.custosEffective.maoDeObra },
    { label: "Logística", valor: snap.custosEffective.logistica },
    { label: "Ops avançadas", valor: snap.custosEffective.operacoesAvancadas },
    { label: "ADM", valor: snap.custosEffective.adm },
    { label: "Montagem", valor: snap.custosEffective.montagem },
    { label: "Portes", valor: snap.custosEffective.portes },
    { label: `IVA (${snap.ivaPct}%)`, valor: snap.ivaValor },
    { label: "Total projeto", valor: snap.totalProjeto, total: true }
  );
  return rows;
}
