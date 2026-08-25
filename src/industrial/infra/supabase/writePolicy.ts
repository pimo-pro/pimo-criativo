/**
 * Phase 1 — política de writes diretos Supabase (anon key no browser).
 *
 * Por omissão:
 * - DEV: writes permitidos (até aplicar migration 015 / BFF)
 * - PROD: writes desligados salvo VITE_INDUSTRIAL_SUPABASE_DIRECT_WRITES=true
 *
 * Quando desligado, callers devem soft-fail (não crashar a UI).
 * O proxy em `client.ts` intercepta insert/update/upsert/delete.
 */

export function isIndustrialSupabaseDirectWriteEnabled(): boolean {
  if (import.meta.env.VITE_INDUSTRIAL_SUPABASE_DIRECT_WRITES === "true") {
    return true;
  }
  if (import.meta.env.VITE_INDUSTRIAL_SUPABASE_DIRECT_WRITES === "false") {
    return false;
  }
  return Boolean(import.meta.env.DEV);
}

export function warnIndustrialDirectWriteBlocked(op: string): void {
  console.warn(
    `[industrial] Write directo Supabase bloqueado (${op}). ` +
      "Use BFF/service role ou VITE_INDUSTRIAL_SUPABASE_DIRECT_WRITES=true apenas em ambiente controlado."
  );
}

/** true = pode escrever; false = soft-fail (já emitiu warn). */
export function allowIndustrialDirectWrite(op: string): boolean {
  if (isIndustrialSupabaseDirectWriteEnabled()) return true;
  warnIndustrialDirectWriteBlocked(op);
  return false;
}

/** Resposta estilo PostgREST para builders bloqueados (thenable). */
export function blockedIndustrialWriteResult(op: string): {
  data: null;
  error: { message: string; code: string };
} {
  return {
    data: null,
    error: {
      message: `Write directo Supabase bloqueado (${op})`,
      code: "PIMO_WRITE_BLOCKED",
    },
  };
}
