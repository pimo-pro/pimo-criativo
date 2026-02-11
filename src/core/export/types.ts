/**
 * FASE 3 — Export Engine
 * Tipos e interfaces principais (placeholders).
 */

/** Formatos de exportação suportados. */
export type ExportFormat = "pdf" | "cnc" | "cutlist" | "image";

/** Opções comuns de exportação. */
export interface ExportOptions {
  format: ExportFormat;
  /** Nome do ficheiro (sem extensão). */
  filename?: string;
  /** Incluir metadados. */
  includeMetadata?: boolean;
}

/** Resultado de uma operação de exportação. */
export interface ExportResult {
  success: boolean;
  /** URL do blob ou path do ficheiro gerado. */
  outputUrl?: string;
  /** Mensagem de erro se success === false. */
  error?: string;
}

/** Configuração do motor de exportação. */
export interface ExportEngineConfig {
  defaultFormat: ExportFormat;
  /** Placeholder para opções por formato. */
  formatOptions?: Partial<Record<ExportFormat, Record<string, unknown>>>;
}

/** Payload mínimo para gerar exportação. */
export interface ExportPayload {
  /** IDs de caixas a incluir (vazio = todas). */
  boxIds?: string[];
  /** Opções por formato. */
  options?: ExportOptions;
}
