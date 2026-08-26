/**
 * Publica snapshot oficial a partir de bundles PRO já calculados.
 * Não corre nesting — só mapeia + grava no store.
 */

import type { CutlistItemForPieces } from "../cutlayout/cutLayoutEngine";
import {
  buildChapasSummaryFromProBundles,
  type ProLayoutBundleForChapas,
} from "./chapasSummaryFromProBundles";
import { buildChapasOficiaisFingerprint } from "./cutlistFingerprint";
import { publishChapasOficiaisPro } from "./chapasOficiaisProStore";

export function publishChapasOficiaisFromProBundles(input: {
  projectId: string;
  projectName: string;
  /** Cutlist industrial (mesmo universo do Unificado) — NÃO o pós-prepareItemsForCnc. */
  items: ReadonlyArray<CutlistItemForPieces>;
  bundles: ReadonlyArray<ProLayoutBundleForChapas>;
  boxes: Array<{ id: string; nome?: string }>;
  /** false = abort→fast / forceFast — no-op no store. */
  isProMode: boolean;
}): boolean {
  if (!input.isProMode) return false;
  const fingerprint = buildChapasOficiaisFingerprint(input.items);
  const summary = buildChapasSummaryFromProBundles({
    bundles: input.bundles,
    projectName: input.projectName,
    boxes: input.boxes,
  });
  return publishChapasOficiaisPro({
    projectId: input.projectId,
    fingerprint,
    summary,
    isProMode: true,
  });
}
