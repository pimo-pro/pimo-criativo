/**
 * Modelo de ambiente PIMO — WEB / futuro DESKTOP / MOBILE.
 *
 * Environment ≠ Role ≠ Plan ≠ Permission ≠ Local Development Access
 *
 * Runtime kinds (client):
 * - local-dev: Vite DEV (`npm run dev`) — full development access permitido
 * - staging-client: build com VITE_PIMO_APP_ENV=staging
 * - production-client: build produção / default fail-closed
 *
 * NÃO confundir com:
 * - Desktop local app (futuro)
 * - Offline mode (futuro)
 * - Production desktop/mobile
 */

export type PimoAppEnvName =
  | "local"
  | "development"
  | "staging"
  | "production"
  | "preview";

export type ClientRuntimeKind = "local-dev" | "staging-client" | "production-client";

const ALLOWED_ENVS: readonly PimoAppEnvName[] = [
  "local",
  "development",
  "staging",
  "production",
  "preview",
] as const;

export function normalizePimoAppEnv(raw: unknown): PimoAppEnvName {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  if ((ALLOWED_ENVS as readonly string[]).includes(v)) {
    return v as PimoAppEnvName;
  }
  // Fail-closed: desconhecido → production
  return "production";
}

/**
 * Ambiente declarado no build/cliente (VITE_PIMO_APP_ENV).
 * Em Vite DEV sem variável, trata-se como `local`.
 */
export function getDeclaredClientAppEnv(): PimoAppEnvName {
  const fromVite = import.meta.env.VITE_PIMO_APP_ENV;
  if (typeof fromVite === "string" && fromVite.trim() !== "") {
    return normalizePimoAppEnv(fromVite);
  }
  if (import.meta.env.DEV) {
    return "local";
  }
  return "production";
}

export function resolveClientRuntimeKind(): ClientRuntimeKind {
  // DEV do Vite = máquina de desenvolvimento. Nunca tratar PROD build como local-dev.
  if (import.meta.env.DEV) {
    return "local-dev";
  }
  const declared = getDeclaredClientAppEnv();
  if (declared === "staging") {
    return "staging-client";
  }
  return "production-client";
}

/** LOCAL DEVELOPMENT (web Vite) — não Desktop Production. */
export function isLocalDevelopmentRuntime(): boolean {
  return resolveClientRuntimeKind() === "local-dev";
}

/**
 * Full Local Development Access — propriedade do AMBIENTE local-dev,
 * não do username "K".
 */
export function isFullLocalDevelopmentAccessEnabled(): boolean {
  if (!isLocalDevelopmentRuntime()) return false;
  if (import.meta.env.VITE_ALLOW_FULL_LOCAL_DEV_ACCESS === "false") return false;
  return true;
}

/** K/K / sessão local só em local-dev (e não desligado por flag). */
export function isLocalDevAuthUiAllowed(): boolean {
  if (!isLocalDevelopmentRuntime()) return false;
  if (import.meta.env.VITE_ALLOW_LOCAL_DEV_AUTH === "false") return false;
  return true;
}
