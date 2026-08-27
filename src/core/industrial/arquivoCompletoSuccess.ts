/**
 * Cauda de sucesso de «Gerar arquivo completo».
 * O caller já fez a.click() do ZIP.
 * Espera um orçamento curto pela gravação do snapshot antes do redirect
 * (não bloqueia o nesting/CNC — só a cauda pós-ZIP).
 */

import {
  persistProductionReleaseBeforeRedirect,
  type PersistToast,
} from "./productionReleasePersist";
import { buildProductionRelease, type ProductionRelease } from "./productionRelease";
import type { BuildProductionReleaseInput } from "./productionRelease";

export type ArquivoCompletoSuccessDeps = {
  showToast: PersistToast;
  saveRelease: (
    _projectId: string,
    _release: ProductionRelease
  ) => Promise<void>;
  assignLocation: (_path: string) => void;
};

export type ConcludeArquivoCompletoSuccessInput = {
  /** true = a.click() do ZIP já correu neste ciclo */
  zipDelivered: boolean;
  redirectPath: string | null;
  projectId: string | null;
  release: ProductionRelease | null;
  /** Nome / slug / ids extras para o outbox casar com a leitura no Relatório. */
  aliasKeys?: readonly string[];
};

export async function concludeArquivoCompletoSuccess(
  input: ConcludeArquivoCompletoSuccessInput,
  deps: ArquivoCompletoSuccessDeps
): Promise<void> {
  deps.showToast("Arquivo completo (ZIP) gerado.", "info");

  if (input.release && input.projectId) {
    await persistProductionReleaseBeforeRedirect(input.projectId, input.release, {
      saveRelease: deps.saveRelease,
      showToast: deps.showToast,
      aliasKeys: input.aliasKeys,
    });
  } else {
    deps.showToast(
      "ZIP gerado, mas não havia nesting PRO para gravar o snapshot da geração.",
      "warning"
    );
  }

  if (input.redirectPath) {
    deps.assignLocation(input.redirectPath);
  }
}

export function buildReleaseForArquivoCompleto(
  input: BuildProductionReleaseInput
): ProductionRelease | null {
  return buildProductionRelease(input);
}
