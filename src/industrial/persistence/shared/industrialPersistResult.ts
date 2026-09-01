/** Resultado tipado de writes industriais (evita misturar throw / null no mesmo fluxo). */
export type IndustrialPersistResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; reason: "blocked" }
  | { ok: false; reason: "rejected"; message?: string };

export function industrialPersistBlocked(): IndustrialPersistResult<never> {
  return { ok: false, reason: "blocked" };
}

export function industrialPersistRejected(
  message?: string,
): IndustrialPersistResult<never> {
  return { ok: false, reason: "rejected", message };
}

export function isIndustrialPersistBlocked(
  result: IndustrialPersistResult<unknown>,
): boolean {
  return !result.ok && result.reason === "blocked";
}
