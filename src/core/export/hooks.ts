/**
 * FASE 3 — Export Engine
 * Hooks React relacionados ao módulo (skeleton).
 */

import { useCallback, useState } from "react";
import type { ExportFormat, ExportResult, ExportPayload } from "./types";
import { runExport } from "./service";

/**
 * Hook para executar exportação com estado de loading/erro.
 * @placeholder Retorno estático.
 */
export function useExport(): {
  exportResult: ExportResult | null;
  isExporting: boolean;
  exportRun: (_payload: ExportPayload) => Promise<void>;
  resetResult: () => void;
} {
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const exportRun = useCallback(async (_payload: ExportPayload) => {
    setIsExporting(true);
    setExportResult(null);
    try {
      const result = await runExport(_payload);
      setExportResult(result);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const resetResult = useCallback(() => setExportResult(null), []);

  return { exportResult, isExporting, exportRun, resetResult };
}

/**
 * Hook para formatos de exportação disponíveis.
 * @placeholder Retorno vazio.
 */
export function useAvailableExportFormats(): ExportFormat[] {
  return [];
}
