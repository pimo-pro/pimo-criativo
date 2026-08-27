export {
  FINANCEIRO_IVA_DEFAULT_PCT,
  FINANCEIRO_CUSTO_KEYS,
  FINANCEIRO_CUSTO_MATERIAL_KEYS,
  FINANCEIRO_PIECE_MATERIAL_KEYS,
  emptyFinanceiroOverrides,
  normalizeFinanceiroOverrides,
  defaultFinanceiroAdminSettings,
  normalizeFinanceiroAdminSettings,
} from "./financeiroUnificadoTypes";
export type {
  FinanceiroChapasMode,
  FinanceiroCustoKey,
  FinanceiroCustoMaterialKey,
  FinanceiroCustosOverrides,
  FinanceiroOverrides,
  FinanceiroUnificadoSnapshot,
  FinanceiroAdminSettings,
} from "./financeiroUnificadoTypes";

export {
  computeFinanceiroAdminCustos,
  loadGlobalFinanceiroAdminSettings,
  saveGlobalFinanceiroAdminSettings,
  FINANCEIRO_ADMIN_SETTINGS_STORAGE_KEY,
} from "./financeiroAdminRules";
export type {
  FinanceiroAdmSettings,
  FinanceiroMontagemSettings,
  FinanceiroPortesSettings,
  FinanceiroMontagemMode,
  FinanceiroValorMode,
} from "./financeiroAdminRules";

export {
  classifyFinanceiroCustoKey,
  computeFinanceiroUnificado,
  financeiroCustoRows,
  financeiroMetricRows,
} from "./financeiroUnificado";
export type { FinanceiroUnificadoProjectSlice } from "./financeiroUnificado";

export {
  aggregateFerragensCatalogLines,
  aggregateFerragensFromBoxes,
  computeFerragensUnificadoSsot,
} from "./ferragensUnificadoLines";
export type {
  FerragemUnificadoLineSsot,
  FerragensUnificadoSsotResult,
  FerragemOrigemPrecoSsot,
  FerragensUnificadoProjectSlice,
} from "./ferragensUnificadoLines";

export {
  CUSTO_MONTAGEM_POR_GAVETA_DEFAULT_EUR,
  computeMontagemGavetasEur,
  countGavetasInBoxes,
  resolveCustoMontagemPorGavetaEur,
} from "./drawerAssemblyCost";

export {
  buildFinanceiroPecasRows,
  buildFinanceiroPecasPdfRows,
  financeiroPecasPdfHead,
  FINANCEIRO_PECAS_CNC_EUR_POR_UNIDADE,
  FINANCEIRO_PECAS_DRILL_EUR_POR_FURO,
} from "./financeiroPecasBuilder";
export type { FinanceiroPecaRow, FinanceiroPecasBuildInput } from "./financeiroPecasBuilder";

export {
  priceFerragensFromCatalog,
  compareFerragensAvsB,
  resolveFallbackPrecoA,
  loadFerragensCatalogForPricing,
  loadComponentTypesForPricing,
} from "./priceFerragensFromCatalog";
export type {
  PriceFerragensFromCatalogResult,
  CompareFerragensAvsBResult,
  FerragensStrictWarning,
  FerragensFallbackUsage,
  FerragemCatalogLine,
} from "./priceFerragensFromCatalog";

export {
  computeOperacoesFinanceiras,
  resolveOperacoesTarifas,
  pieceHasCncOperacao,
  pieceDrillHoleCount,
} from "./computeOperacoesFinanceiras";
export type {
  OperacoesFinanceirasResult,
  OperacoesFinanceirasTarifas,
} from "./computeOperacoesFinanceiras";

export {
  computeDesperdicioSerragemFinanceiras,
  estimateSerragemM2,
  resolveDesperdicioSerragemTarifas,
} from "./computeDesperdicioSerragemFinanceiras";
export type {
  DesperdicioSerragemFinanceirasResult,
  DesperdicioSerragemTarifas,
} from "./computeDesperdicioSerragemFinanceiras";

export {
  computeCustosAvancadosFinanceiras,
  resolveCustosAvancadosTarifas,
  assertNoMaterialDoubleCount,
} from "./computeCustosAvancadosFinanceiras";
export type {
  CustosAvancadosFinanceirasResult,
  CustosAvancadosTarifas,
} from "./computeCustosAvancadosFinanceiras";

export { priceChapasSheetsEur } from "./priceChapasSheetsEur";
export type { ChapasSheetForPricing } from "./priceChapasSheetsEur";

export {
  computeOperacoesIndustriaisAvancadas,
  OPS_ADV_MAP,
} from "./computeOperacoesIndustriaisAvancadas";
export type {
  OperacoesAvancadasBreakdown,
  OperacoesAvancadasFinanceirasResult,
} from "./computeOperacoesIndustriaisAvancadas";
