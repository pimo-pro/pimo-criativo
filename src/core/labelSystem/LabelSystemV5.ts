/**
 * LabelSystemV5 — esquema unificado (SSOT) para toda a configuração de etiquetas e QR.
 * Substitui: rules.labelV5, rules.etiqueta, rules.qrcode, settings.etiquetasQr,
 *            designer localStorage, DEFAULT_LABEL_CONFIG e legados S1/S3/S4.
 *
 * Fase F0 — apenas tipos e schema; sem lógica de resolução.
 */

import type { LabelDesignerConfig, LabelDesignerTemplate } from "../labelDesigner/labelDesignerTypes";
import type { PaletteGroup, ProductionStep } from "../labelConfig/labelConfig";
import type { IndustrialNamingRules } from "../naming/industrialNaming";
import { buildDefaultIndustrialNamingRules } from "../naming/industrialNaming";

// ─── Versão do schema ─────────────────────────────────────────────────────────

/** Versão corrente do schema.  Incrementar a cada migração não-compatível. */
export const LABEL_SYSTEM_V5_SCHEMA_VERSION = 2;

// ─── Dimensões ────────────────────────────────────────────────────────────────

export interface LabelSystemDimensions {
  /** Largura total da etiqueta (mm). */
  widthMm: number;
  /** Altura total da etiqueta (mm). */
  heightMm: number;
  /** Tamanho do QR na etiqueta (mm). */
  qrSizeMm: number;
}

// ─── Secções ──────────────────────────────────────────────────────────────────

/** Alturas das secções internas da etiqueta v5 (mm). */
export interface LabelSystemSections {
  bottomStrip_mm: number;
  materialHeight_mm: number;
  medidasHeight_mm: number;
  productionHeight_mm: number;
  observationHeight_mm: number;
}

// ─── Sequência de produção ───────────────────────────────────────────────────

export interface LabelSystemProductionStepConfig {
  id: ProductionStep["id"];
  label: string;
  defaultOrder: number;
}

export interface LabelSystemSequence {
  productionSteps: LabelSystemProductionStepConfig[];
  /** Nomes de peças tratadas como produção manual. */
  manualPieceNames: string[];
  /** Espessura (mm) abaixo da qual não se orla. */
  noOrlarThickness_mm: number;
}

// ─── Paleta ───────────────────────────────────────────────────────────────────

export interface LabelSystemPalette {
  groups: PaletteGroup[];
}

// ─── QR Policy ────────────────────────────────────────────────────────────────

/**
 * Política de geração de QR:
 * - "v5"    → código completo v5 (padrão)
 * - "short" → código curto (shortCode derivado)
 * - "dual"  → ambos (QR v5 + shortCode impresso)
 */
export type QrPolicy = "v5" | "short" | "dual";

// ─── Template / Preset ───────────────────────────────────────────────────────

export interface TemplateConfig {
  id: string;
  name: string;
  designer: LabelDesignerConfig;
}

export interface PresetConfig {
  id: string;
  name: string;
  /** Subset parcial das configurações do LabelSystemV5 a aplicar. */
  overrides: Partial<Omit<LabelSystemV5, "schemaVersion" | "templates" | "presets">>;
}

// ─── Schema principal ─────────────────────────────────────────────────────────

/**
 * LabelSystemV5 — única fonte de verdade para toda a configuração de etiquetas.
 * Persiste no perfil de regras; lido exclusivamente via `resolveLabelSystemConfig`.
 */
export interface LabelSystemV5 {
  /** Versão do schema — usada para migrações automáticas. */
  schemaVersion: number;

  /** Dimensões físicas da etiqueta (largura, altura, tamanho QR). */
  dimensions: LabelSystemDimensions;

  /** Alturas das secções internas. */
  sections: LabelSystemSections;

  /** Sequência de produção, peças manuais e threshold de orla. */
  sequence: LabelSystemSequence;

  /** Grupos de paleta activos. */
  palette: LabelSystemPalette;

  /** Política de geração de QR. */
  qrPolicy: QrPolicy;

  /**
   * Referência ao logo do QR.
   * null  → sem logo
   * ""    → herdar de settings.etiquetasQr.logoDataUrl
   * data: → inline data URL
   */
  qrLogo: string | null;

  /** Linhas de observação fixas impressas na etiqueta. */
  observations: string[];

  /** Se true, inclui peças manuais (fora de CNC) na listagem. */
  manualPieces: boolean;

  /**
   * Regras de naming industrial (tipo→token, etc.).
   * Editável no perfil de regras; defaults em `buildDefaultIndustrialNamingRules`.
   */
  naming: IndustrialNamingRules;

  /** Layout do designer visual (opcional; migrado de localStorage). */
  designerLayout?: LabelDesignerConfig;

  /** Templates de designer disponíveis neste perfil. */
  templates?: TemplateConfig[];

  /** Presets de configuração rápida. */
  presets?: PresetConfig[];
}

// ─── Valor por defeito ────────────────────────────────────────────────────────

import { DEFAULT_LABEL_CONFIG } from "../labelConfig/labelConfig";
import { buildDefaultLabelV5RulesConfig } from "../rules/rulesConfig";

export function buildDefaultLabelSystemV5(): LabelSystemV5 {
  const base = DEFAULT_LABEL_CONFIG;
  const v5defaults = buildDefaultLabelV5RulesConfig();

  return {
    schemaVersion: LABEL_SYSTEM_V5_SCHEMA_VERSION,
    dimensions: {
      widthMm: base.dimensions.totalWidth_mm,
      heightMm: base.dimensions.totalHeight_mm,
      qrSizeMm: base.dimensions.qrSize_mm,
    },
    sections: {
      bottomStrip_mm: v5defaults.bottomStrip_mm,
      materialHeight_mm: v5defaults.materialHeight_mm,
      medidasHeight_mm: v5defaults.medidasHeight_mm,
      productionHeight_mm: v5defaults.productionHeight_mm,
      observationHeight_mm: v5defaults.observationHeight_mm,
    },
    sequence: {
      productionSteps: v5defaults.productionSteps.map((s) => ({ ...s })),
      manualPieceNames: [...v5defaults.manualPieceNames],
      noOrlarThickness_mm: v5defaults.noOrlarThickness_mm,
    },
    palette: {
      groups: base.paletteGroups.map((g) => ({ ...g })),
    },
    qrPolicy: "v5",
    qrLogo: "",
    observations: [],
    manualPieces: false,
    naming: buildDefaultIndustrialNamingRules(),
  };
}

// ─── Tipos auxiliares exportados ──────────────────────────────────────────────

/** Template do designer (re-exportado de labelDesignerTypes para conveniência). */
export type { LabelDesignerConfig, LabelDesignerTemplate };
