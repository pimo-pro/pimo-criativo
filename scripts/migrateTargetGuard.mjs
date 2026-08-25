/**
 * Target guard único para migrations / SQL remoto industrial.
 * Fail-closed: sem target inequívoco + allowlist canónica → STOP.
 *
 * Environment ≠ Role ≠ Plan
 * LOCAL / STAGING / PRODUCTION
 */

export const MIGRATE_TARGETS = ["local", "staging", "production"];

/** Allowlist canónica — NÃO inferir a partir de URLs arbitrárias. */
export const CANONICAL_PROJECT_REFS = Object.freeze({
  staging: "rszpnvmscehqapflaklv",
  production: "ritmrjwrmcsofyugviil",
});

export const CANONICAL_SUPABASE_URLS = Object.freeze({
  staging: "https://rszpnvmscehqapflaklv.supabase.co",
  production: "https://ritmrjwrmcsofyugviil.supabase.co",
});

export function normalizeMigrateTarget(raw) {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (MIGRATE_TARGETS.includes(v)) return v;
  return null;
}

export function projectRefFromSupabaseUrl(url) {
  const match = String(url ?? "").match(
    /https:\/\/([a-z0-9]+)\.supabase\.co/i,
  );
  return match?.[1] ?? "";
}

/**
 * Extrai project ref de DATABASE_URL (db.<ref>.supabase.co ou postgres.<ref>@pooler).
 */
export function projectRefFromDatabaseUrl(url) {
  const s = String(url ?? "");
  const direct = s.match(/@db\.([a-z0-9]+)\.supabase\.co(?::|\/|\?|$)/i);
  if (direct?.[1]) return direct[1];
  const hostDirect = s.match(/(?:^|[/@])db\.([a-z0-9]+)\.supabase\.co(?::|\/|\?|$)/i);
  if (hostDirect?.[1]) return hostDirect[1];
  const pooler = s.match(/postgres\.([a-z0-9]+)(?::|@)/i);
  if (pooler?.[1]) return pooler[1];
  return "";
}

/** Remove password / query de URLs para logging seguro. */
export function redactConnectionString(url) {
  const s = String(url ?? "");
  if (!s) return "";
  try {
    if (s.includes("://")) {
      const u = new URL(s.replace(/^postgres(ql)?:/i, "https:"));
      if (u.password) u.password = "***";
      u.search = "";
      return u.toString().replace(/^https:/, "postgresql:");
    }
  } catch {
    /* fall through */
  }
  return s.replace(/:([^:@/]+)@/, ":***@").replace(/\?.*$/, "");
}

/**
 * Expected ref para o target.
 * Staging/Production: allowlist canónica no código (env só pode confirmar, não substituir).
 * Local: PIMO_SUPABASE_PROJECT_REF_LOCAL (obrigatório); não pode ser staging/prod canónicos.
 */
export function resolveExpectedProjectRef(target, env) {
  const e = env ?? {};
  if (target === "staging") {
    return CANONICAL_PROJECT_REFS.staging;
  }
  if (target === "production") {
    return CANONICAL_PROJECT_REFS.production;
  }
  return String(e.PIMO_SUPABASE_PROJECT_REF_LOCAL ?? "").trim();
}

/**
 * Recolhe candidatos de identidade e exige consenso.
 * @returns {{ ok: true, ref: string } | { ok: false, code: string, message: string, refs: string[] }}
 */
export function resolveActualProjectRefDetailed(env) {
  const e = env ?? {};
  const found = [];
  const push = (ref, source) => {
    const r = String(ref ?? "").trim();
    if (r) found.push({ ref: r, source });
  };

  push(e.SUPABASE_PROJECT_REF, "SUPABASE_PROJECT_REF");
  push(projectRefFromSupabaseUrl(e.VITE_SUPABASE_URL), "VITE_SUPABASE_URL");
  push(projectRefFromSupabaseUrl(e.SUPABASE_URL), "SUPABASE_URL");
  push(projectRefFromDatabaseUrl(e.DATABASE_URL), "DATABASE_URL");

  if (found.length === 0) {
    return {
      ok: false,
      code: "MISSING_ACTUAL_REF",
      message:
        "Não foi possível determinar o project ref actual " +
        "(SUPABASE_PROJECT_REF, VITE_SUPABASE_URL, SUPABASE_URL ou DATABASE_URL).",
      refs: [],
    };
  }

  const unique = [...new Set(found.map((f) => f.ref))];
  if (unique.length > 1) {
    return {
      ok: false,
      code: "INCONSISTENT_IDENTITY",
      message:
        "Project refs inconsistentes entre variáveis: " +
        found.map((f) => `${f.source}=${f.ref}`).join(", "),
      refs: unique,
    };
  }

  return { ok: true, ref: unique[0], refs: unique };
}

/** Compat: devolve string ref ou "". */
export function resolveActualProjectRef(env) {
  const r = resolveActualProjectRefDetailed(env);
  return r.ok ? r.ref : "";
}

function envAllowlistConflict(target, env) {
  const e = env ?? {};
  if (target === "staging") {
    const declared = String(e.PIMO_SUPABASE_PROJECT_REF_STAGING ?? "").trim();
    if (declared && declared !== CANONICAL_PROJECT_REFS.staging) {
      return {
        ok: false,
        code: "ENV_ALLOWLIST_CONFLICT",
        message:
          `PIMO_SUPABASE_PROJECT_REF_STAGING=${declared} conflita com allowlist canónica ` +
          CANONICAL_PROJECT_REFS.staging,
      };
    }
    const shared = String(e.PIMO_MIGRATE_ALLOWED_REF ?? "").trim();
    if (shared && shared !== CANONICAL_PROJECT_REFS.staging) {
      return {
        ok: false,
        code: "ENV_ALLOWLIST_CONFLICT",
        message:
          `PIMO_MIGRATE_ALLOWED_REF=${shared} conflita com staging canónico ` +
          CANONICAL_PROJECT_REFS.staging,
      };
    }
  }
  if (target === "production") {
    const declared = String(e.PIMO_SUPABASE_PROJECT_REF_PRODUCTION ?? "").trim();
    if (declared && declared !== CANONICAL_PROJECT_REFS.production) {
      return {
        ok: false,
        code: "ENV_ALLOWLIST_CONFLICT",
        message:
          `PIMO_SUPABASE_PROJECT_REF_PRODUCTION=${declared} conflita com allowlist canónica ` +
          CANONICAL_PROJECT_REFS.production,
      };
    }
    const shared = String(e.PIMO_MIGRATE_ALLOWED_REF ?? "").trim();
    if (shared && shared !== CANONICAL_PROJECT_REFS.production) {
      return {
        ok: false,
        code: "ENV_ALLOWLIST_CONFLICT",
        message:
          `PIMO_MIGRATE_ALLOWED_REF=${shared} conflita com production canónico ` +
          CANONICAL_PROJECT_REFS.production,
      };
    }
  }
  return null;
}

function validateCanonicalUrl(target, env) {
  const e = env ?? {};
  const url = String(e.VITE_SUPABASE_URL || e.SUPABASE_URL || "").trim();
  if (!url) return null;
  const ref = projectRefFromSupabaseUrl(url);
  if (!ref) {
    return {
      ok: false,
      code: "INVALID_SUPABASE_URL",
      message: "Supabase URL presente mas sem project ref reconhecível (*.supabase.co).",
    };
  }
  if (target === "staging" || target === "production") {
    const expected = CANONICAL_PROJECT_REFS[target];
    if (ref !== expected) {
      return {
        ok: false,
        code: "URL_REF_MISMATCH",
        message:
          `Supabase URL project ref=${ref} incompatível com target=${target} ` +
          `(esperado ${expected}).`,
      };
    }
  }
  return null;
}

/**
 * Valida target + identidade do projecto.
 * @returns {{ ok: true, target: string, expectedRef: string, actualRef: string } | { ok: false, code: string, message: string }}
 */
export function validateMigrateTarget(env) {
  const e = env ?? {};
  const target = normalizeMigrateTarget(e.PIMO_MIGRATE_TARGET);
  if (!target) {
    return {
      ok: false,
      code: "MISSING_TARGET",
      message:
        "PIMO_MIGRATE_TARGET em falta ou inválido. Use: local | staging | production",
    };
  }

  const conflict = envAllowlistConflict(target, e);
  if (conflict) return conflict;

  const urlCheck = validateCanonicalUrl(target, e);
  if (urlCheck) return urlCheck;

  const expectedRef = resolveExpectedProjectRef(target, e);
  if (!expectedRef) {
    return {
      ok: false,
      code: "MISSING_ALLOWLIST",
      message:
        target === "local"
          ? "LOCAL requer PIMO_SUPABASE_PROJECT_REF_LOCAL (project ref explícito; não usar staging/production)."
          : `Allowlist em falta para target=${target}.`,
    };
  }

  if (target === "local") {
    if (
      expectedRef === CANONICAL_PROJECT_REFS.staging ||
      expectedRef === CANONICAL_PROJECT_REFS.production
    ) {
      return {
        ok: false,
        code: "LOCAL_FORBIDDEN_REMOTE_REF",
        message:
          "LOCAL não pode usar project refs canónicos de staging/production. " +
          "Use um projecto local dedicado.",
      };
    }
  }

  const actual = resolveActualProjectRefDetailed(e);
  if (!actual.ok) {
    return {
      ok: false,
      code: actual.code,
      message: actual.message,
    };
  }

  const actualRef = actual.ref;

  if (actualRef !== expectedRef) {
    return {
      ok: false,
      code: "REF_MISMATCH",
      message: `Project ref mismatch: actual=${actualRef} expected=${expectedRef} (target=${target})`,
    };
  }

  // Unknown refs never accepted for staging/production (belt: expected is canonical)
  if (target === "staging" || target === "production") {
    const known = Object.values(CANONICAL_PROJECT_REFS);
    if (!known.includes(actualRef)) {
      return {
        ok: false,
        code: "UNKNOWN_PROJECT_REF",
        message: `Project ref desconhecido para target remoto: ${actualRef}`,
      };
    }
  }

  if (target === "production") {
    const confirm = String(e.CONFIRM_PRODUCTION_MIGRATE ?? "").trim();
    if (confirm !== "I_UNDERSTAND") {
      return {
        ok: false,
        code: "PRODUCTION_CONFIRM_REQUIRED",
        message:
          "Production migrate requer CONFIRM_PRODUCTION_MIGRATE=I_UNDERSTAND",
      };
    }
  }

  return { ok: true, target, expectedRef, actualRef };
}

/** Log seguro + exit 1 se inválido. */
export function assertMigrateTargetOrExit(env, log = console) {
  const result = validateMigrateTarget(env);
  if (!result.ok) {
    log.error(`ERRO migration guard [${result.code}]: ${result.message}`);
    log.error(
      "Defina PIMO_MIGRATE_TARGET=local|staging|production e identidade canónica do projecto.",
    );
    process.exit(1);
  }
  log.log(
    `Migration target OK: ${result.target} (project ref ${result.actualRef})`,
  );
  return result;
}
