/* eslint-disable no-unused-vars -- declaração de tipos; nomes de parâmetros são apenas documentação */
/**
 * Ponte de compatibilidade para `window.viewerCore` (Z-01.2.6).
 *
 * A superfície pública canónica é `PimoViewerApi`.
 * O global existe só enquanto o Workspace o atribui em `setOnViewerReady` (HMR / dispose).
 * Consumidores de produto devem usar o contexto React ou `getActiveViewerCore()`.
 */
import type { PimoViewerApi } from "../../context/PimoViewerContextCore";

declare global {
  interface Window {
    viewerCore?: PimoViewerApi;
    setOnViewerReady?: (_callback: (() => void) | null) => void;
  }
}

export {};
