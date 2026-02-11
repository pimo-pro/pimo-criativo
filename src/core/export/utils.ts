/**
 * FASE 3 — Export Engine
 * Funções auxiliares (skeleton).
 */

import type { ExportFormat } from "./types";

/**
 * Gera nome de ficheiro seguro a partir de string.
 * @placeholder Sem lógica real.
 */
export function sanitizeExportFilename(_name: string): string {
  return _name.replace(/[^\p{L}\p{N}\s_-]/gu, "").trim() || "export";
}

/**
 * MIME type associado ao formato.
 * @placeholder Sem lógica real.
 */
export function getMimeTypeForFormat(_format: ExportFormat): string {
  return "application/octet-stream";
}

/**
 * Verifica se o ambiente suporta geração do formato.
 * @placeholder Sem lógica real.
 */
export function canExportFormat(_format: ExportFormat): boolean {
  return false;
}
