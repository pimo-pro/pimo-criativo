/**
 * Provenance do Financeiro do Relatório (Fase 0–2).
 * Classificação/merge; live só quando `features.reportFinanceiroProvenance`.
 */

import type { FinanceiroCustoKey } from "../financeiro/financeiroUnificadoTypes";
import type {
  ProjectReportFinanceiro,
  ReportDetalheProvenance,
  ReportFerragensOverridesMap,
  ReportFinanceiroDetalhe,
} from "./types";

export const FINANCEIRO_PROVENANCE_VERSION = 1;
export const PROVENANCE_MONEY_EPS = 0.01;

export type DetalheClassifyKind =
  | "match_ssot_identical"
  | "match_ssot_with_diff"
  | "orphan";

export type ClassifiedDetalheItem = {
  kind: DetalheClassifyKind;
  legacy: ReportFinanceiroDetalhe;
  ssot?: ReportFinanceiroDetalhe;
};

export type DetalheMatchKeyFn = (
  d: Pick<ReportFinanceiroDetalhe, "id" | "tipo" | "ferragemId" | "espessuraMm">
) => string;

export type ClassifyDetalheOptions = {
  matchKey?: DetalheMatchKeyFn;
};

export type MergeDetalheOptions = {
  matchKey?: DetalheMatchKeyFn;
  /**
   * 1ª migração: diff sem provenance → descarta a favor do SSOT
   * (não promove a manual_edit).
   */
  firstMigration?: boolean;
};

/**
 * Conservador: só `redundant_eq_ssot` tem keep=false (seguro remover).
 * Eco sticky → keep=true + suspeito (badge nas fases UI; nunca apagar sozinho).
 */
export type LineOverrideClassifyKind =
  | "redundant_eq_ssot"
  | "suspected_sticky_echo"
  | "keep_explicit";

export type LineOverrideClassification = {
  key: FinanceiroCustoKey;
  value: number;
  kind: LineOverrideClassifyKind;
  keep: boolean;
  suspectedStickyEcho: boolean;
};

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function moneyEq(
  a: number,
  b: number,
  eps: number = PROVENANCE_MONEY_EPS
): boolean {
  return Math.abs(round2(a) - round2(b)) < eps;
}

export function needsFinanceiroProvenanceMigration(
  fin: ProjectReportFinanceiro | null | undefined
): boolean {
  const v = fin?.provenanceVersion;
  return v == null || v < FINANCEIRO_PROVENANCE_VERSION;
}

/** Normaliza material/tipo para matching estável (Painéis). */
export function normalizeMaterialName(raw: string): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function slugMaterialForId(raw: string): string {
  const n = normalizeMaterialName(raw)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return n || "chapa";
}

/**
 * Matching estável Painéis: espessura + material (tipo), nunca id regenerado.
 */
export function paineisStableMatchKey(
  d: Pick<ReportFinanceiroDetalhe, "id" | "tipo" | "ferragemId" | "espessuraMm">
): string {
  const esp =
    d.espessuraMm != null && Number.isFinite(d.espessuraMm)
      ? String(Math.round(Number(d.espessuraMm)))
      : "";
  return `e:${esp}|m:${normalizeMaterialName(String(d.tipo || ""))}`;
}

export function softMatchKey(
  d: Pick<ReportFinanceiroDetalhe, "id" | "tipo" | "ferragemId" | "espessuraMm">
): string {
  const id = String(d.id || "").trim();
  if (id) return `id:${id}`;
  const ferr = String(d.ferragemId || "").trim();
  if (ferr) return `ferr:${ferr}`;
  const tipo = String(d.tipo || "").trim().toLowerCase();
  const esp =
    d.espessuraMm != null && Number.isFinite(d.espessuraMm)
      ? String(d.espessuraMm)
      : "";
  return `t:${tipo}|e:${esp}`;
}

export function matchKeyForFinanceiroKey(key: FinanceiroCustoKey): DetalheMatchKeyFn {
  if (key === "paineis" || key === "chapasReais") return paineisStableMatchKey;
  return softMatchKey;
}

export function detalheValuesEqual(
  a: ReportFinanceiroDetalhe,
  b: ReportFinanceiroDetalhe,
  eps: number = PROVENANCE_MONEY_EPS
): boolean {
  return (
    String(a.tipo || "").trim() === String(b.tipo || "").trim() &&
    moneyEq(a.quantidade, b.quantidade, eps) &&
    moneyEq(a.precoUnitario, b.precoUnitario, eps) &&
    moneyEq(a.total, b.total, eps)
  );
}

export function sumDetalheTotals(detalhe: ReportFinanceiroDetalhe[]): number {
  return round2(detalhe.reduce((s, d) => s + (Number(d.total) || 0), 0));
}

function hasManualProvenance(d: ReportFinanceiroDetalhe): boolean {
  return d.provenance === "manual_edit" || d.provenance === "manual_added";
}

/**
 * A/B/C: idêntico ao SSOT → descartável; diff no mesmo slot → edição;
 * órfão → manual_added.
 */
export function classifyLegacyDetalhe(
  legacy: ReportFinanceiroDetalhe[] | null | undefined,
  ssot: ReportFinanceiroDetalhe[] | null | undefined,
  opts: ClassifyDetalheOptions = {}
): ClassifiedDetalheItem[] {
  const matchKey = opts.matchKey ?? softMatchKey;
  const ssotList = ssot ?? [];
  const usedSsot = new Set<number>();
  const bySoft = new Map<string, number[]>();
  ssotList.forEach((s, i) => {
    const k = matchKey(s);
    const arr = bySoft.get(k) ?? [];
    arr.push(i);
    bySoft.set(k, arr);
  });

  const out: ClassifiedDetalheItem[] = [];
  for (const leg of legacy ?? []) {
    const k = matchKey(leg);
    const pool = bySoft.get(k) ?? [];
    let matchIdx = -1;
    for (const idx of pool) {
      if (usedSsot.has(idx)) continue;
      matchIdx = idx;
      usedSsot.add(idx);
      break;
    }
    if (matchIdx < 0) {
      out.push({ kind: "orphan", legacy: leg });
      continue;
    }
    const match = ssotList[matchIdx]!;
    if (detalheValuesEqual(leg, match)) {
      out.push({ kind: "match_ssot_identical", legacy: leg, ssot: match });
    } else {
      out.push({ kind: "match_ssot_with_diff", legacy: leg, ssot: match });
    }
  }
  return out;
}

export function withProvenance(
  d: ReportFinanceiroDetalhe,
  provenance: ReportDetalheProvenance
): ReportFinanceiroDetalhe {
  return { ...d, provenance };
}

/**
 * Base = SSOT; aplica edits e órfãos; ignora idênticos.
 * firstMigration: with_diff sem provenance → SSOT (sticky descartado).
 */
export function mergeSsotWithManual(
  ssot: ReportFinanceiroDetalhe[] | null | undefined,
  classified: ClassifiedDetalheItem[],
  opts: MergeDetalheOptions = {}
): ReportFinanceiroDetalhe[] {
  const matchKey = opts.matchKey ?? softMatchKey;
  const firstMigration = Boolean(opts.firstMigration);
  const base = (ssot ?? []).map((d) => withProvenance(d, "ssot"));
  const bySoft = new Map<string, number[]>();
  base.forEach((d, i) => {
    const k = matchKey(d);
    const arr = bySoft.get(k) ?? [];
    arr.push(i);
    bySoft.set(k, arr);
  });

  const takeIndex = (key: string): number | undefined => {
    const arr = bySoft.get(key);
    if (!arr || arr.length === 0) return undefined;
    return arr.shift();
  };

  const out = [...base];
  for (const c of classified) {
    if (c.kind === "match_ssot_identical") continue;
    if (c.kind === "match_ssot_with_diff" && c.ssot) {
      if (firstMigration && !hasManualProvenance(c.legacy)) {
        continue;
      }
      const idx = takeIndex(matchKey(c.ssot));
      if (idx != null) {
        out[idx] = withProvenance(
          { ...c.legacy, id: c.ssot.id || c.legacy.id },
          "manual_edit"
        );
      } else {
        out.push(withProvenance(c.legacy, "manual_edit"));
      }
      continue;
    }
    if (c.kind === "orphan") {
      out.push(withProvenance(c.legacy, "manual_added"));
    }
  }
  return out;
}

/**
 * Merge por key: Painéis usa match estável; sem SSOT builder só mantém manuais marcados.
 */
export function applyDetalheProvenanceForKey(input: {
  key: FinanceiroCustoKey;
  legacy?: ReportFinanceiroDetalhe[] | null;
  ssot?: ReportFinanceiroDetalhe[] | null;
  firstMigration: boolean;
}): ReportFinanceiroDetalhe[] {
  const matchKey = matchKeyForFinanceiroKey(input.key);
  const ssot = input.ssot ?? [];
  const legacy = input.legacy ?? [];

  if (ssot.length === 0) {
    return legacy
      .filter((d) => hasManualProvenance(d))
      .map((d) => withProvenance(d, d.provenance!));
  }

  const classified = classifyLegacyDetalhe(legacy, ssot, { matchKey });
  return mergeSsotWithManual(ssot, classified, {
    matchKey,
    firstMigration: input.firstMigration,
  });
}

function detalheMostlyStickyIdentical(
  classified: ClassifiedDetalheItem[] | null | undefined
): boolean {
  const list = classified ?? [];
  if (list.length === 0) return true;
  return list.every((c) => c.kind === "match_ssot_identical");
}

export function classifyLegacyLineOverrides(
  lineOverrides: Partial<Record<FinanceiroCustoKey, number>> | null | undefined,
  officialByKey: Partial<Record<FinanceiroCustoKey, number>> | null | undefined,
  opts?: {
    legacyDetalheByKey?: Partial<
      Record<FinanceiroCustoKey, ReportFinanceiroDetalhe[]>
    >;
    classifiedDetalheByKey?: Partial<
      Record<FinanceiroCustoKey, ClassifiedDetalheItem[]>
    >;
  }
): LineOverrideClassification[] {
  const ov = lineOverrides ?? {};
  const official = officialByKey ?? {};
  const out: LineOverrideClassification[] = [];

  for (const key of Object.keys(ov) as FinanceiroCustoKey[]) {
    const value = Number(ov[key]);
    if (!Number.isFinite(value)) continue;
    const ssotVal = Number(official[key] ?? NaN);
    if (Number.isFinite(ssotVal) && moneyEq(value, ssotVal)) {
      out.push({
        key,
        value: round2(value),
        kind: "redundant_eq_ssot",
        keep: false,
        suspectedStickyEcho: false,
      });
      continue;
    }

    const legacyDet = opts?.legacyDetalheByKey?.[key] ?? [];
    const classified = opts?.classifiedDetalheByKey?.[key];
    const sumLegacy = sumDetalheTotals(legacyDet);
    const echo =
      legacyDet.length > 0 &&
      moneyEq(value, sumLegacy) &&
      detalheMostlyStickyIdentical(classified);

    out.push({
      key,
      value: round2(value),
      kind: echo ? "suspected_sticky_echo" : "keep_explicit",
      keep: true,
      suspectedStickyEcho: echo,
    });
  }
  return out;
}

export function filterFerragensOverridesToKeep(
  ov: ReportFerragensOverridesMap | null | undefined
): ReportFerragensOverridesMap {
  const out: ReportFerragensOverridesMap = {};
  if (!ov) return out;
  for (const [id, item] of Object.entries(ov)) {
    if (!item) continue;
    const hasEdit =
      item.added === true ||
      item.removed === true ||
      item.tipo !== undefined ||
      item.quantidade !== undefined ||
      item.precoUnitario !== undefined ||
      item.total !== undefined ||
      item.observacoes !== undefined;
    if (hasEdit) out[id] = { ...item };
  }
  return out;
}

/**
 * Anexa meta de lineOverrides para UI (Fase 3).
 * Inclui todas as classificações — não filtra para apagar overrides.
 */
export function buildLineOverrideMeta(
  classifications: LineOverrideClassification[]
): NonNullable<ProjectReportFinanceiro["lineOverrideMeta"]> {
  const out: NonNullable<ProjectReportFinanceiro["lineOverrideMeta"]> = {};
  for (const c of classifications) {
    out[c.key] = {
      kind: c.kind,
      suspectedStickyEcho: c.suspectedStickyEcho,
    };
  }
  return out;
}

export function previewFinanceiroProvenanceMigration(input: {
  legacyDetalheByKey: Partial<
    Record<FinanceiroCustoKey, ReportFinanceiroDetalhe[]>
  >;
  ssotDetalheByKey: Partial<
    Record<FinanceiroCustoKey, ReportFinanceiroDetalhe[]>
  >;
  lineOverrides?: Partial<Record<FinanceiroCustoKey, number>> | null;
  officialByKey?: Partial<Record<FinanceiroCustoKey, number>> | null;
  financeiro?: ProjectReportFinanceiro | null;
}): {
  needsMigration: boolean;
  detalheByKey: Partial<Record<FinanceiroCustoKey, ClassifiedDetalheItem[]>>;
  mergedDetalheByKey: Partial<
    Record<FinanceiroCustoKey, ReportFinanceiroDetalhe[]>
  >;
  lineOverrides: LineOverrideClassification[];
} {
  const keys = new Set<FinanceiroCustoKey>([
    ...(Object.keys(input.legacyDetalheByKey) as FinanceiroCustoKey[]),
    ...(Object.keys(input.ssotDetalheByKey) as FinanceiroCustoKey[]),
  ]);
  const firstMigration = needsFinanceiroProvenanceMigration(input.financeiro);
  const detalheByKey: Partial<
    Record<FinanceiroCustoKey, ClassifiedDetalheItem[]>
  > = {};
  const mergedDetalheByKey: Partial<
    Record<FinanceiroCustoKey, ReportFinanceiroDetalhe[]>
  > = {};

  for (const key of keys) {
    const matchKey = matchKeyForFinanceiroKey(key);
    const classified = classifyLegacyDetalhe(
      input.legacyDetalheByKey[key],
      input.ssotDetalheByKey[key],
      { matchKey }
    );
    detalheByKey[key] = classified;
    mergedDetalheByKey[key] = applyDetalheProvenanceForKey({
      key,
      legacy: input.legacyDetalheByKey[key],
      ssot: input.ssotDetalheByKey[key],
      firstMigration,
    });
  }

  return {
    needsMigration: firstMigration,
    detalheByKey,
    mergedDetalheByKey,
    lineOverrides: classifyLegacyLineOverrides(
      input.lineOverrides,
      input.officialByKey,
      {
        legacyDetalheByKey: input.legacyDetalheByKey,
        classifiedDetalheByKey: detalheByKey,
      }
    ),
  };
}
