/**
 * FASE 3 — Materials System
 * Tipos e interfaces principais (placeholders).
 */

/** Categoria de material (ex.: MDF, melamina, sólido). */
export type MaterialCategoryId = string;

/** Preset de material por categoria. */
export interface MaterialPreset {
  id: string;
  categoryId: MaterialCategoryId;
  label: string;
  /** Placeholder para propriedades futuras. */
  metadata?: Record<string, unknown>;
}

/** Atribuição de material a uma parte do modelo. */
export interface MaterialAssignment {
  partId: string;
  presetId: string;
  categoryId?: MaterialCategoryId;
}

/** Estado do sistema de materiais (para hooks/contexto). */
export interface MaterialsSystemState {
  assignments: MaterialAssignment[];
  activeCategoryId: MaterialCategoryId | null;
  /** Placeholder para overrides por categoria. */
  categoryOverrides?: Record<MaterialCategoryId, string>;
}

/** Opções ao aplicar material. */
export interface ApplyMaterialOptions {
  boxId?: string;
  modelInstanceId?: string;
  partId?: string;
}

/**
 * Registo de material para listagem e formulário (Admin / CRUD).
 * Alinhado com o plano de integração.
 */
export interface MaterialRecord {
  id: string;
  label: string;
  categoryId?: MaterialCategoryId;
  /** Cor em hex (ex.: #ffffff). */
  color?: string;
  /** URL ou id da textura (placeholder). */
  textureUrl?: string;
  espessura?: number;
  precoPorM2?: number;
  /** Id do material industrial (ligação). */
  industrialMaterialId?: string;
  /** Id do preset visual (ligação). */
  visualPresetId?: string;
}

/** Dados para criar material (id gerado pelo serviço). */
export type CreateMaterialData = Omit<MaterialRecord, "id">;

/** Dados parciais para atualizar material. */
export type UpdateMaterialData = Partial<Omit<MaterialRecord, "id">>;

/** Resultado de validação do material. */
export interface MaterialValidationResult {
  valid: boolean;
  error?: string;
}

/** Informação de material para PDF/Cutlist (label, espessura, preço, categoria). */
export interface MaterialDisplayInfo {
  label: string;
  espessura: number;
  precoPorM2: number;
  categoryId?: string;
  /** Id do material (CRUD) para referência. */
  materialId?: string;
}
