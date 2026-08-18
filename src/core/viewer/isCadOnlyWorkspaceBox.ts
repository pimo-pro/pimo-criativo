import { isPiBaseCabinetId } from "../../data/moveisUnificados/pi/models";

/** Campos mínimos para o heurístico `cadOnly` (GLB / modelos externos, sem carcaça PI). */
export type CadOnlyWorkspaceBoxInput = {
  baseCabinetId?: string | null;
  models?: readonly unknown[] | null;
  prateleiras?: number;
  gavetas?: number;
};

/**
 * Mesma regra que `useCalculadoraSync` usa ao passar `cadOnly` ao Viewer:
 * não é Base PI, tem pelo menos um modelo GLB, e não tem prateleiras nem gavetas.
 */
export function isCadOnlyWorkspaceBox(box: CadOnlyWorkspaceBoxInput): boolean {
  return (
    !isPiBaseCabinetId(box.baseCabinetId) &&
    (box.models?.length ?? 0) > 0 &&
    box.prateleiras === 0 &&
    box.gavetas === 0
  );
}
