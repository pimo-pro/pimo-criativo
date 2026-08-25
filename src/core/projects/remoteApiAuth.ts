/**
 * Auth HTTP para Projects API / industrial orders.
 * - JWT real → Authorization Bearer
 * - local-dev-token / ausente → sem sync remoto (offline)
 */

const AUTH_TOKEN_KEY = "pimo_auth_token";

export function getRemoteApiBearerToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  const token = (localStorage.getItem(AUTH_TOKEN_KEY) || "").trim();
  if (!token || token === "local-dev-token") return null;
  return token;
}

/** false = não tentar sync remoto (guest / K/K / sem sessão). */
export function canUseRemoteProjectsApi(): boolean {
  return getRemoteApiBearerToken() !== null;
}

export function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra ?? {}) };
  const token = getRemoteApiBearerToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}
