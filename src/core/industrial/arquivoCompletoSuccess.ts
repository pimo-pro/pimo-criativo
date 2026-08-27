/**
 * Cauda de sucesso de «Gerar arquivo completo».
 * Toast ZIP primeiro; buildRelease (Unificado F4) só depois de yield — não atrasa o toast.
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
  /** Default: setTimeout(0). Injectável nos testes. */
  yieldToMain?: () => Promise<void>;
};

export type ConcludeArquivoCompletoSuccessInput = {
  /** true = a.click() do ZIP já correu neste ciclo */
  zipDelivered: boolean;
  redirectPath: string | null;
  projectId: string | null;
  /** Release já construído (testes / legado). */
  release?: ProductionRelease | null;
  /**
   * Se `release` for null/omitido: corre DEPOIS do toast + yield.
   * Evita ~300ms de Unificado antes do feedback visual do ZIP.
   */
  buildRelease?: () => ProductionRelease | null;
  /** Nome / slug / ids extras para o outbox casar com a leitura no Relatório. */
  aliasKeys?: readonly string[];
};

export async function concludeArquivoCompletoSuccess(
  input: ConcludeArquivoCompletoSuccessInput,
  deps: ArquivoCompletoSuccessDeps
): Promise<void> {
  deps.showToast("Arquivo completo (ZIP) gerado.", "info");

  let release = input.release ?? null;
  if (!release && input.buildRelease) {
    const yieldFn =
      deps.yieldToMain ??
      (() => new Promise<void>((r) => setTimeout(r, 0)));
    await yieldFn();
    release = input.buildRelease();
  }

  if (release && input.projectId) {
    await persistProductionReleaseBeforeRedirect(input.projectId, release, {
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
