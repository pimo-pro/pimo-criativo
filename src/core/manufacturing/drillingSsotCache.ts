import { DRILLING_SSOT_VERSION } from "../../modules/drilling/drillingAdapter";
import { clearHingeDrillingTraceLog } from "../../modules/drilling/hingeDrillingTrace";
import { clearAllCutlistCache } from "./cutlistFromBoxes";

const LS_KEY = "pimo-industrial-drilling-ssot";

let ssotFreshChecked = false;

/**
 * Invalida cache de cutlist quando a versão SSOT de furação muda (deploy novo).
 * Chamado no arranque do pipeline industrial e na primeira cutlist do projeto.
 */
export function ensureIndustrialDrillingSsotFresh(): void {
  if (ssotFreshChecked) return;
  ssotFreshChecked = true;

  let prev: string | null = null;
  try {
    if (typeof localStorage !== "undefined") {
      prev = localStorage.getItem(LS_KEY);
    }
  } catch {
    /* SSR / privacy mode */
  }

  if (prev === DRILLING_SSOT_VERSION) {
    logDrillingSsotVersion();
    return;
  }

  clearAllCutlistCache();
  clearHingeDrillingTraceLog();

  console.info(
    `[PIMO industrial] DRILLING_SSOT_VERSION ${prev ?? "(none)"} → ${DRILLING_SSOT_VERSION}; caches cutlist/hinge invalidados.`
  );

  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LS_KEY, DRILLING_SSOT_VERSION);
    }
  } catch {
    /* ignore */
  }

  logDrillingSsotVersion();
}

export function logDrillingSsotVersion(): void {
  console.info(`[PIMO industrial] DRILLING_SSOT_VERSION=${DRILLING_SSOT_VERSION}`);
}

/** Testes: permite revalidar SSOT entre casos. */
export function resetDrillingSsotFreshCheckForTests(): void {
  ssotFreshChecked = false;
}
