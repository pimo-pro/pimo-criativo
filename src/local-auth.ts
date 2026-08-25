/**
 * Local development authentication (K/K).
 *
 * SEPARADO da autenticação real (JWT PHP).
 * - Frontend: só em runtime local-dev (Vite DEV).
 * - Backend: Vite middleware local OU PHP com PIMO_APP_ENV=local|development.
 * - Fail-closed: se o backend local rejeitar / falhar, K/K não cria sessão.
 * - Full development access = propriedade do AMBIENTE local-dev, não do username "K".
 *
 * Removível no futuro sem tocar no fluxo JWT real.
 */

import { getLocalDevelopmentPermissions } from "./core/environment/localDevAccess";
import { isLocalDevAuthUiAllowed } from "./core/environment/pimoEnvironment";

export const LOCAL_DEV_AUTH_TOKEN = "local-dev-token";

const SESSION_KEY = "pimo_session";

export type LocalAuthSession = {
  token: string;
  user: { id: string; name: string; role: string };
  local: true;
  fullLocalDevAccess: true;
  permissions: string[];
};

/** UI / client gate — nunca suficiente sozinho; backend confirma. */
export function isFrontendLocalDevAuthAllowed(): boolean {
  return isLocalDevAuthUiAllowed();
}

/**
 * Confirma K/K no backend local (Vite middleware / PHP local).
 * Usa path relativo para não ir ao Hostinger via VITE_API_URL absoluto.
 */
async function confirmLocalDevAuthWithBackend(
  email: string,
  password: string
): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/dev-local", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) return false;
    const data = (await response.json().catch(() => null)) as {
      status?: string;
      localDev?: boolean;
      token?: string;
    } | null;
    return (
      data?.status === "ok" &&
      data.localDev === true &&
      data.token === LOCAL_DEV_AUTH_TOKEN
    );
  } catch {
    return false;
  }
}

/**
 * Tenta login local K/K. Devolve true só se frontend DEV + backend local autorizar.
 */
export async function tryLocalAuth(email: string, password: string): Promise<boolean> {
  if (!isFrontendLocalDevAuthAllowed()) {
    return false;
  }
  if (email !== "K" || password !== "K") {
    return false;
  }
  const backendOk = await confirmLocalDevAuthWithBackend(email, password);
  if (!backendOk) {
    return false;
  }

  const permissions = getLocalDevelopmentPermissions();
  const fakeSession: LocalAuthSession = {
    token: LOCAL_DEV_AUTH_TOKEN,
    user: {
      id: "local-user",
      name: "Khaled Local",
      role: "local-dev",
    },
    local: true,
    fullLocalDevAccess: true,
    permissions,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(fakeSession));
  return true;
}

export function readLocalAuthSession(): LocalAuthSession | null {
  if (!isFrontendLocalDevAuthAllowed()) {
    return null;
  }
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as {
      token?: string;
      user?: { id?: string; name?: string; role?: string };
      local?: boolean;
      permissions?: unknown;
    };
    if (
      !data?.local ||
      data.token !== LOCAL_DEV_AUTH_TOKEN ||
      !data.user?.id ||
      !data.user?.name ||
      !data.user?.role
    ) {
      return null;
    }
    const permissions = Array.isArray(data.permissions)
      ? (data.permissions as string[]).filter((p) => typeof p === "string")
      : getLocalDevelopmentPermissions();
    return {
      token: LOCAL_DEV_AUTH_TOKEN,
      user: {
        id: data.user.id,
        name: data.user.name,
        role: data.user.role,
      },
      local: true,
      fullLocalDevAccess: true,
      permissions,
    };
  } catch {
    return null;
  }
}

export function clearLocalAuthSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function isLocalAuthSession(): boolean {
  return readLocalAuthSession() !== null;
}
