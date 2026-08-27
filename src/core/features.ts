/**
 * Feature flags de produto (não industriais).
 * `reportFinanceiroProvenance`: política SSOT+manual no Relatório §4.
 * Default false — comparar Antunes on/off antes de generalizar.
 *
 * Override local (dev/staging), sem rebuild:
 *   localStorage.setItem("pimo.features.reportFinanceiroProvenance", "1")
 *   localStorage.removeItem("pimo.features.reportFinanceiroProvenance")
 */
export const features: { readonly reportFinanceiroProvenance: boolean } = {
  reportFinanceiroProvenance: false,
};

export type AppFeatureKey = keyof typeof features;

const LS_PREFIX = "pimo.features.";

function readLocalOverride(key: AppFeatureKey): boolean | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}${key}`);
    if (raw == null) return null;
    if (raw === "1" || raw === "true") return true;
    if (raw === "0" || raw === "false") return false;
  } catch {
    /* ignore */
  }
  return null;
}

/** Efectivo: override localStorage, senão default em `features`. */
export function isFeatureEnabled(key: AppFeatureKey): boolean {
  const ov = readLocalOverride(key);
  if (ov != null) return ov;
  return features[key] === true;
}

export function isReportFinanceiroProvenanceEnabled(): boolean {
  return isFeatureEnabled("reportFinanceiroProvenance");
}
