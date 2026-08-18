/**
 * ============================================================================
 * CONTRATO BASE — Prontidão do Viewer (SSOT)
 * ============================================================================
 *
 * Este módulo é a única fonte de verdade para decidir se o ViewerCore ou a
 * API React (`PimoViewerApi`) estão prontos para chamadas reais.
 *
 * NÃO alterar sem revisão explícita do contrato de inicialização do Viewer.
 * Pipeline industrial (TCN, TXML, cutlist) não depende deste ficheiro.
 *
 * --------------------------------------------------------------------------
 * Regras obrigatórias (todas as camadas)
 * --------------------------------------------------------------------------
 *
 * 1. PimoViewerProvider expõe SEMPRE um `PimoViewerApi` válido (stub NOOP até
 *    o Workspace registar a API real). Nunca expor `null` no contexto.
 *
 * 2. `setActiveViewerCore` (e a ponte `window.viewerCore`) só podem ser atribuídos
 *    dentro do callback `ViewerCore.setOnViewerReady` — nunca antes da init completa.
 *
 * 3. `viewerReady === true` no ViewerCore só após `notifyViewerReady()`
 *    (queueMicrotask pós-construtor: eventos, loop, boxes).
 *
 * 4. NUNCA ler `viewerApi.viewerReady` ou `viewerCore.viewerReady` em objetos
 *    possivelmente null/undefined. Usar SEMPRE:
 *      - `isViewerApiReady(viewerApi)`  — camada React / hooks / UI
 *      - `isViewerCoreReady(viewerCore)` — camada runtime / usePimoViewer
 *
 * 5. Em arrays de dependências de `useEffect` / `useMemo`, extrair um booleano
 *    seguro (`const viewerReady = isViewerApiReady(viewerApi)`) — nunca
 *    `viewerApi.viewerReady` inline (crash se viewerApi for null legado).
 *
 * 6. Toolbar e efeitos industriais bloqueiam interação até readiness real.
 *
 * --------------------------------------------------------------------------
 * Release estável: tag `v6.0629.2314-stable-viewerReady`
 * --------------------------------------------------------------------------
 */

import type { PimoViewerApi } from "../../context/PimoViewerContextCore";

/** ViewerCore montado e com `viewerReady === true`. Aceita null/undefined. */
export function isViewerCoreReady(viewerCore: unknown): boolean {
  if (viewerCore == null || typeof viewerCore !== "object") return false;
  return (viewerCore as { viewerReady?: boolean }).viewerReady === true;
}

/** API React do viewer pronta para chamadas ao ViewerCore (industrial, sync, toolbar). */
export function isViewerApiReady(viewerApi: PimoViewerApi | null | undefined): boolean {
  if (viewerApi == null) return false;
  return viewerApi.viewerReady === true;
}
