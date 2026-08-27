export type {
  ProjectReport,
  RelatorioPainelContagensPersistidas,
  ReportFerragemItemOverride,
  ReportFerragensOverridesMap,
  ReportStyle,
  ReportOperador,
  ReportCaixa,
  ReportPeca,
  ReportMaterialLinha,
  ReportFinanceiroLinha,
  ReportFinanceiroDetalhe,
  ReportDetalheProvenance,
  ReportTextoItem,
  ProjectReportGerais,
  ProjectReportMetricas,
  ProjectReportDesign,
  ProjectReportProducao,
  ProjectReportMontagem,
  ProjectReportFinanceiro,
  ReportHistoryEntry,
  ReportNota,
  ProjectReportQualidade,
} from "./types";

export {
  PROJECT_REPORT_STORAGE_KEY,
  PROJECT_REPORT_IVA_DEFAULT,
  PROJECT_REPORT_VERSION,
  FINANCEIRO_REPORT_LABELS,
  HISTORY_MAX_ENTRIES,
  makeReportId,
  emptyGerais,
  emptyMetricas,
  emptyDesign,
  emptyProducao,
  emptyMontagem,
  emptyFinanceiro,
  emptyQualidade,
} from "./types";

export {
  loadProjectReport,
  saveProjectReport,
  extractProjectReportFromPimoData,
  markManualPath,
  isManualPath,
  setReportStyle,
  ensureReportExtras,
} from "./projectReportStore";

export {
  recalcFinanceiro,
  recalcLinha,
  updateFinanceiroLinha,
  ensureFinanceiroShape,
  lineTotalFromQtyPrice,
  isOfficialTotalLockedKey,
  OFFICIAL_TOTAL_LOCKED_KEYS,
} from "./financeReportCalc";

export { seedOrMergeProjectReport } from "./seedProjectReport";
export {
  reportNeedsFinanceiroProvenanceMigration,
} from "./migrateReport";
export {
  FINANCEIRO_PROVENANCE_VERSION,
  PROVENANCE_MONEY_EPS,
  needsFinanceiroProvenanceMigration,
  classifyLegacyDetalhe,
  mergeSsotWithManual,
  classifyLegacyLineOverrides,
  filterFerragensOverridesToKeep,
  previewFinanceiroProvenanceMigration,
  applyDetalheProvenanceForKey,
  buildLineOverrideMeta,
  paineisStableMatchKey,
  normalizeMaterialName,
  matchKeyForFinanceiroKey,
  moneyEq,
  softMatchKey,
  sumDetalheTotals,
  withProvenance,
} from "./financeiroDetalheProvenance";
export type {
  DetalheClassifyKind,
  ClassifiedDetalheItem,
  LineOverrideClassifyKind,
  LineOverrideClassification,
  ClassifyDetalheOptions,
  MergeDetalheOptions,
} from "./financeiroDetalheProvenance";
export {
  features,
  isFeatureEnabled,
  isReportFinanceiroProvenanceEnabled,
} from "../features";
export type { AppFeatureKey } from "../features";
export { loadReportProjectContext, pickFresherReportContext } from "./loadReportProjectContext";
export type { ReportProjectContext } from "./loadReportProjectContext";
export { createReportSaveQueue } from "./reportSaveQueue";
export type { ReportSaveQueue, ReportSaveResult } from "./reportSaveQueue";
export {
  snapshotToReportFinanceiro,
  buildLiveReportFinanceiro,
  loadMaterialsForFinanceiro,
  withLiveFinanceiro,
  officialLineTotal,
} from "./financeiroFromUnificado";
export type { BuildLiveReportFinanceiroOptions } from "./financeiroFromUnificado";
export {
  buildFinanceiroFromProductionRelease,
  withProductionReleaseFinanceiro,
  pricePaineisFromReleaseChapas,
  detalhePaineisFromRelease,
  detalheFerragensFromRelease,
  releaseFerragensAsUnificadoLines,
} from "./financeiroFromProductionRelease";
/** P3.22 — fluxo original da página Financeiro (custos dinâmicos). */
export { financeiroAdapter, adapterModelToFinanceiroShape } from "./financeiroAdapter";
export type { FinanceiroAdapterModel } from "./financeiroAdapter";
export {
  financeiroIndustrialRules,
  seedChapasDetalhe,
  seedOrlaDetalhe,
  applyIndustrialReportLinhas,
} from "./financeiroIndustrialRules";
export type { FinanceiroIndustrialRulesInput } from "./financeiroIndustrialRules";
export { financeiroTotals, alignOfficialTotalsToUnificado } from "./financeiroTotals";
export { buildFinanceiroPageFromState } from "./buildFinanceiroPage";
export type { BuildFinanceiroPageOptions } from "./buildFinanceiroPage";
export {
  applyReportLineOverrides,
  setReportLineOverride,
  normalizeReportLineOverrides,
  officialPaineisTotal,
  resolvePaineisOrigem,
  PAINEIS_ORIGEM_LABEL,
} from "./financeiroOverrides";
export type {
  ReportLineOverrides,
  PaineisOrigemBadge,
} from "./financeiroOverrides";

export {
  finalizeReportFinanceiro,
  setReportMargemGanho,
  calcReportTotals,
  effectiveMargemPercentagem,
  hasActiveMargem,
  sumBasePreIva,
  sumSubtotalMateriais,
} from "./financeiroMargemGanho";
export type { CalcReportTotalsResult } from "./financeiroMargemGanho";
export type { ReportMargemGanhoConfig, ReportMargemGanhoMode } from "./types";
export { MARGEM_GANHO_LABEL } from "./types";

export {
  calcArea,
  calcChapa,
  applyOverride,
  syncWithUnificado,
  rebuildChapaDetalhe,
  rebuildItemDetalhe,
  rebuildLinhaVisual,
  emitTotalFinal,
  setLinhaDetalheVisual,
  sumDetalheVisual,
  createEmptyChapaDetalhe,
  createManualChapaDetalhe,
  createEmptyItemDetalhe,
  DYNAMIC_DETALHE_KEYS,
} from "./financeiroDynamicEngine";
export type {
  ChapaFieldPatch,
  OfficialTotalsMap,
  EmitTotalFinalResult,
} from "./financeiroDynamicEngine";
export {
  sanitizeFinanceiroDetalhe,
  isInvalidFinanceiroDetalheTipo,
  isPregoParaCostaTipo,
  isPecaCaixaTipo,
} from "./financeiroDetalheSanitize";
export {
  financeiroCustoLinhasDisplay,
  financeiroTotaisDisplay,
  formatEurDisplay,
} from "./financeiroDisplay";
export {
  buildRelatorioPainelContagens,
  countGavetasModulo,
  countPainelFromBoxes,
  countPortasModulo,
} from "./relatorioPainelContagens";
export type { RelatorioPainelContagens } from "./relatorioPainelContagens";
export { buildChartMetrics, buildCircleChartMetrics } from "./chartMetrics";
export type { ChartMetricItem } from "./chartMetrics";

export {
  deriveMetricas,
  withDerivedMetricas,
  deriveTempoTrabalhoHoras,
  deriveColaboradores,
  deriveErrosCount,
  deriveErrosCorrigidosCount,
  deriveMelhoriasCount,
} from "./deriveMetricas";

export { migrateProjectReport, stringToTextoItems, joinTextoItems } from "./migrateReport";

export {
  applyFerragensDetalhe,
  ensureFerragensFromMateriais,
  getFerragensDetalhe,
  materiaisFromFerragensDetalhe,
} from "./materiaisSync";

export {
  applyOverride as applyFerragemOverride,
  applyFerragemCatalogOpt,
  buildFerragensVisual,
  calcTotal as calcFerragemTotal,
  collectUnificadoFerragens,
  createEmptyFerragemDetalhe,
  findFerragemInCatalog,
  patchFerragemNome,
  detalheToOverrides,
  emitFerragensTotalVisual,
  getFerragensOverrides,
  listCatalogoFerragens,
  origemPrecoLabel,
  persistFerragensVisual,
  rebuildFerragemDetalhe,
  resolveOrigemPrecoLinha,
  visualFerragemId,
  visualToDetalhe,
  withFerragensDetalhe,
} from "./financeiroFerragensEngine";
export type {
  FerragemOrigemPreco,
  FerragemUnificadoLine,
  FerragemVisualItem,
} from "./financeiroFerragensEngine";

export { buildOrlaDetalheFromState, recalcOrlaDetalhe } from "./orlaReport";

export {
  AREA_CHAPA_PADRAO_M2,
  aggregateChapasByEspessura,
  aggregateChapasByEspessuraEMaterial,
  listCatalogoChapas,
  findChapaCatalogOption,
  detalheFromCatalogoChapa,
  recalcChapaDetalhe,
  applyPrecoChapaEdit,
  applyPrecoPorMetroEdit,
  applyPrecoPorM2Edit,
  formatMedidaMm,
  parseMedidaMm,
  resolveDimensoesMm,
  areaM2FromMedida,
  resolveAreaChapaM2,
  precoM2FromChapa,
  precoChapaFromArea,
  precoPorMetroFromM2,
} from "./chapasReport";
export type { CatalogoChapaOption } from "./chapasReport";

export {
  buildPaineisChapasDetalhe,
  cutlistItemsFromProjectState,
  withPaineisChapasDetalhe,
  getPaineisDetalhe,
  madeiraTotalFromFinanceiro,
  totalChapasDetalhe,
  addChapaToPaineisFinanceiro,
  setPaineisChapasDetalhe,
} from "./paineisChapasDetalhe";

export {
  collectPaineisSugestoesProjeto,
  collectPaineisSugestoesFromRelease,
  collectSugestoesFromRemates,
  collectSugestoesFromCutlistTipos,
  labelFromRemateProductType,
  isCutlistNomeSugestaoSegura,
} from "./paineisSugestoesProjeto";

export {
  appendHistoryEntry,
  withHistoryForPath,
  createHistoryEntry,
  sortHistoryChronological,
  serializeHistoryValue,
  getValueAtPath,
  resolveHistoryUser,
} from "./history";

export {
  exportProjectReportPdf,
  exportProjectReportPdfBytes,
} from "./exportPdf";
export type { ExportProjectReportPdfOptions } from "./exportPdf";
export { sendFinalReportEmail } from "./sendFinalReportEmail";
export type { FinalReportEmailPayload, FinalReportEmailResult } from "./sendFinalReportEmail";
export { getReportCoverImage, resolveReportCoverImage, setReportCoverImage } from "./reportCoverImageCache";

export {
  importTrakSnapshot,
  applyTrakToReportParts,
} from "./trakImport";
export type { TrakImportSnapshot } from "./trakImport";
