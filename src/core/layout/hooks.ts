/**
 * FASE 3 — Layout Engine
 * Hooks React relacionados ao módulo (skeleton).
 */

import { useCallback, useMemo } from "react";
import type { LayoutBoxInput, LayoutResult, LayoutEngineOptions } from "./types";
import { computeLayout } from "./service";

/**
 * Hook para calcular layout a partir de lista de caixas.
 * @placeholder Retorno estático.
 */
export function useLayoutEngine(
  _boxes: LayoutBoxInput[],
  _options?: LayoutEngineOptions
): {
  result: LayoutResult;
  recompute: () => void;
} {
  const result = useMemo(() => computeLayout(_boxes, _options), [_boxes, _options]);
  const recompute = useCallback(() => {
    // FASE 3: implementar (invalidate cache / recalcular)
  }, []);
  return { result, recompute };
}

/**
 * Hook para estado de colisões do layout.
 * @placeholder Retorno vazio.
 */
export function useLayoutCollisions(_boxes: LayoutBoxInput[]): {
  collisions: Array<{ a: string; b: string }>;
} {
  return useMemo(() => ({ collisions: [] }), [_boxes]);
}
