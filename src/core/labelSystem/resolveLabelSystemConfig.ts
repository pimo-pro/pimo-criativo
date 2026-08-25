/**
 * resolveLabelSystemConfig — resolver canónico do LabelSystemV5.
 *
 * É a ÚNICA fonte de configuração para: UEE, cutlist, technical, drill, admin preview.
 * Substitui `resolveUnifiedLabelConfig` e a lógica QR dispersa por S1/S3/S4.
 *
 * Fase F1 — resolver pronto; consumidores migram nas fases seguintes.
 */

import {
  buildDefaultLabelSystemV5,
  LABEL_SYSTEM_V5_SCHEMA_VERSION,
  type LabelSystemV5,
  type QrPolicy,
} from "./LabelSystemV5";
import type { LabelConfig, LabelDimensions, PaletteGroup, ProductionStep } from "../labelConfig/labelConfig";
import type { RulesConfig } from "../rules/rulesConfig";
import type { SettingsSchema } from "../settings/settingsSchema";

// ─── Runtime resolvido ────────────────────────────────────────────────────────

/**
 * Configuração completamente resolvida — pronta a usar pelos motores de PDF/QR.
 * Todos os valores são concretos (sem undefined/null).
 */
export interface ResolvedLabelRuntime {
  /** Versão do schema de origem. */
  schemaVersion: number;

  /** LabelConfig compatível com a API existente do UEE / pdfEtiquetas. */
  labelConfig: LabelConfig;

  /** Política QR activa. */
  qrPolicy: QrPolicy;

  /**
   * Data URL do logo do QR (string vazia = sem logo).
   * Já resolvido a partir de LabelSystemV5.qrLogo + settings.etiquetasQr.
   */
  qrLogoDataUrl: string;

  /** Percentagem de tamanho do logo no QR (0–100). */
  qrLogoSizePercent: number;

  /** Linhas de observação fixas. */
  observations: string[];

  /** Peças manuais incluídas. */
  manualPieces: boolean;

  /** Layout do designer (undefined = não configurado). */
  designerLayout: LabelSystemV5["designerLayout"];
}

// ─── Resolver principal ───────────────────────────────────────────────────────

/**
 * Resolve a configuração completa de etiquetas a partir de:
 *   1. `rules.labelSystemV5` (ou override explícito no 3.º argumento)
 *   2. Defaults de `buildDefaultLabelSystemV5()` quando ausente
 *   3. `settings.etiquetasQr` — apenas fallback de logo QR (`qrLogoDataUrl`)
 */
export function resolveLabelSystemConfig(
  rules: RulesConfig,
  settings?: Pick<SettingsSchema, "etiquetasQr"> | null,
  labelSystemV5?: LabelSystemV5 | null
): ResolvedLabelRuntime {
  const explicit = labelSystemV5 ?? rules.labelSystemV5 ?? null;
  const schema = explicit
    ? migrateLabelSystemV5(explicit)
    : buildDefaultLabelSystemV5();

  const labelConfig = toLabelConfig(schema);

  const qrLogoDataUrl = resolveQrLogo(schema, settings);
  const qrLogoSizePercent = settings?.etiquetasQr?.logoTamanhoPorcento ?? 20;

  return {
    schemaVersion: schema.schemaVersion,
    labelConfig,
    qrPolicy: schema.qrPolicy,
    qrLogoDataUrl,
    qrLogoSizePercent,
    observations: [...schema.observations],
    manualPieces: schema.manualPieces,
    designerLayout: schema.designerLayout,
  };
}

// ─── Compatibilidade legada ───────────────────────────────────────────────────

/**
 * Constrói LabelSystemV5 a partir de regras legadas — **apenas** para
 * `normalizeLabelSystemV5` (Admin / migração de perfil). Não usar no runtime de produção.
 */
export function buildLabelSystemV5FromLegacyRules(rules: RulesConfig): LabelSystemV5 {
  const defaults = buildDefaultLabelSystemV5();
  const v5 = rules.labelV5;

  return {
    ...defaults,
    sections: {
      bottomStrip_mm: v5?.bottomStrip_mm ?? defaults.sections.bottomStrip_mm,
      materialHeight_mm: v5?.materialHeight_mm ?? defaults.sections.materialHeight_mm,
      medidasHeight_mm: v5?.medidasHeight_mm ?? defaults.sections.medidasHeight_mm,
      productionHeight_mm: v5?.productionHeight_mm ?? defaults.sections.productionHeight_mm,
      observationHeight_mm: v5?.observationHeight_mm ?? defaults.sections.observationHeight_mm,
    },
    sequence: {
      productionSteps:
        v5?.productionSteps && v5.productionSteps.length > 0
          ? v5.productionSteps
              .slice()
              .sort((a, b) => a.defaultOrder - b.defaultOrder)
              .map((s) => ({ id: s.id, label: s.label, defaultOrder: s.defaultOrder }))
          : defaults.sequence.productionSteps,
      manualPieceNames:
        v5?.manualPieceNames && v5.manualPieceNames.length > 0
          ? [...v5.manualPieceNames]
          : defaults.sequence.manualPieceNames,
      noOrlarThickness_mm: v5?.noOrlarThickness_mm ?? defaults.sequence.noOrlarThickness_mm,
    },
    palette: {
      groups:
        v5?.paletteGroups && v5.paletteGroups.length > 0
          ? v5.paletteGroups.map((g) => ({ code: g.code }))
          : defaults.palette.groups,
    },
    dimensions: {
      ...defaults.dimensions,
      qrSizeMm: rules.etiqueta?.tamanhoQr ?? defaults.dimensions.qrSizeMm,
    },
  };
}

// ─── Migração de schema ───────────────────────────────────────────────────────

/**
 * Garante que o schema está na versão corrente (público para Admin/F3).
 * Retorna defaults se o input for nulo ou de versão desconhecida.
 * Também aplica migração de localStorage → profile quando `legacyLocalStorage` é fornecido.
 */
export function normalizeLabelSystemV5(
  input: LabelSystemV5 | null | undefined,
  rules?: RulesConfig,
  settings?: Pick<SettingsSchema, "etiquetasQr"> | null,
  legacyLocalStorage?: unknown
): LabelSystemV5 {
  // Se já existe um schema válido, migrar para versão corrente
  if (input && typeof input === "object" && "schemaVersion" in input) {
    const migrated = migrateLabelSystemV5(input);
    // Migrar designerLayout de localStorage se ainda não existe no schema
    if (!migrated.designerLayout && legacyLocalStorage && typeof legacyLocalStorage === "object") {
      return { ...migrated, designerLayout: legacyLocalStorage as LabelSystemV5["designerLayout"] };
    }
    return migrated;
  }
  // Sem schema — construir a partir de regras legadas
  if (rules) {
    const fromLegacy = buildLabelSystemV5FromLegacyRules(rules);
    const withLogo: LabelSystemV5 = {
      ...fromLegacy,
      qrLogo: settings?.etiquetasQr?.logoAtivado && settings.etiquetasQr.logoDataUrl
        ? settings.etiquetasQr.logoDataUrl
        : fromLegacy.qrLogo,
    };
    if (legacyLocalStorage && typeof legacyLocalStorage === "object") {
      return { ...withLogo, designerLayout: legacyLocalStorage as LabelSystemV5["designerLayout"] };
    }
    return withLogo;
  }
  return buildDefaultLabelSystemV5();
}

/**
 * @internal Garante que o schema está na versão corrente.
 */
function migrateLabelSystemV5(input: LabelSystemV5 | null): LabelSystemV5 {
  if (!input || typeof input !== "object") {
    return buildDefaultLabelSystemV5();
  }

  if (input.schemaVersion === LABEL_SYSTEM_V5_SCHEMA_VERSION) {
    const defaults = buildDefaultLabelSystemV5();
    return {
      ...defaults,
      ...input,
      naming: {
        pieceTypeTokens: {
          ...defaults.naming.pieceTypeTokens,
          ...(input.naming?.pieceTypeTokens ?? {}),
        },
      },
    };
  }

  // v1 → v2: corrigir dimensões legadas 98×60 → 100×50 mm + naming defaults
  if (input.schemaVersion === 1) {
    const defaults = buildDefaultLabelSystemV5();
    const migrated: LabelSystemV5 = {
      ...defaults,
      ...input,
      schemaVersion: LABEL_SYSTEM_V5_SCHEMA_VERSION,
      dimensions: { ...input.dimensions },
      naming: {
        pieceTypeTokens: {
          ...defaults.naming.pieceTypeTokens,
          ...(input.naming?.pieceTypeTokens ?? {}),
        },
      },
    };
    if (migrated.dimensions.widthMm === 98) migrated.dimensions.widthMm = 100;
    if (migrated.dimensions.heightMm === 60) migrated.dimensions.heightMm = 50;
    return migrated;
  }

  return buildDefaultLabelSystemV5();
}

// ─── Conversão para LabelConfig (API legada) ──────────────────────────────────

function toLabelConfig(schema: LabelSystemV5): LabelConfig {
  const dims = schema.dimensions;
  const sec = schema.sections;

  const dimensions: LabelDimensions = {
    totalWidth_mm: dims.widthMm,
    totalHeight_mm: dims.heightMm,
    bottomStrip_mm: sec.bottomStrip_mm,
    qrSize_mm: dims.qrSizeMm,
    qrColumnWidth_mm: dims.qrSizeMm + 2, // margem operacional padrão
    materialHeight_mm: sec.materialHeight_mm,
    medidasHeight_mm: sec.medidasHeight_mm,
    productionHeight_mm: sec.productionHeight_mm,
    observationHeight_mm: sec.observationHeight_mm,
  };

  const paletteGroups: PaletteGroup[] = schema.palette.groups.map((g) => ({ code: g.code }));

  const productionSteps: ProductionStep[] = schema.sequence.productionSteps.map((s) => ({ id: s.id }));

  return {
    dimensions,
    paletteGroups,
    productionSteps,
    manualPieceNames: [...schema.sequence.manualPieceNames],
    noOrlarThickness_mm: schema.sequence.noOrlarThickness_mm,
  };
}

// ─── Resolução do logo QR ─────────────────────────────────────────────────────

function resolveQrLogo(
  schema: LabelSystemV5,
  settings?: Pick<SettingsSchema, "etiquetasQr"> | null
): string {
  // null  → sem logo
  if (schema.qrLogo === null) return "";

  // data URL inline
  if (schema.qrLogo && schema.qrLogo.startsWith("data:")) return schema.qrLogo;

  // "" ou qualquer outra string vazia → herdar de settings
  if (!schema.qrLogo) {
    if (settings?.etiquetasQr?.logoAtivado && settings.etiquetasQr.logoDataUrl) {
      return settings.etiquetasQr.logoDataUrl;
    }
    return "";
  }

  return schema.qrLogo;
}
