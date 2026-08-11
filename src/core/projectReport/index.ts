export type {
  ProjectReport,
  ReportStyle,
  ReportOperador,
  ReportCaixa,
  ReportPeca,
  ReportMaterialLinha,
  ReportFinanceiroLinha,
  ReportFinanceiroDetalhe,
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
} from "./financeReportCalc";

export { seedOrMergeProjectReport } from "./seedProjectReport";
export {
  snapshotToReportFinanceiro,
  buildLiveReportFinanceiro,
  loadMaterialsForFinanceiro,
} from "./financeiroFromUnificado";
export {
  financeiroCustoLinhasDisplay,
  financeiroTotaisDisplay,
  formatEurDisplay,
} from "./financeiroDisplay";
export {
  buildRelatorioPainelContagens,
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

export { buildOrlaDetalheFromState, recalcOrlaDetalhe } from "./orlaReport";

export {
  AREA_CHAPA_PADRAO_M2,
  aggregateChapasByEspessura,
  listCatalogoChapas,
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
  withPaineisChapasDetalhe,
  getPaineisDetalhe,
  madeiraTotalFromFinanceiro,
  totalChapasDetalhe,
} from "./paineisChapasDetalhe";

export {
  appendHistoryEntry,
  withHistoryForPath,
  createHistoryEntry,
  sortHistoryChronological,
  serializeHistoryValue,
  getValueAtPath,
  resolveHistoryUser,
} from "./history";

export { exportProjectReportPdf } from "./exportPdf";

export {
  importTrakSnapshot,
  applyTrakToReportParts,
} from "./trakImport";
export type { TrakImportSnapshot } from "./trakImport";
