import axios from "axios";

import { apiClient } from "./apiClient";

export type LoginResponse = {
  status: "ok";
  token: string;
  user: {
    id: string;
    username: string;
    role: string;
  };
};

export type MeResponse = {
  status: "ok";
  user: {
    id: string;
    username: string;
    role: string;
    permissions: string[];
  };
};

/** Payload bruto do PHP: `permissions` no root; `user` sem permissões aninhadas. */
type MeApiPayload = {
  status?: string;
  user?: {
    id?: string;
    username?: string;
    role?: string;
    permissions?: unknown;
  };
  permissions?: unknown;
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function parseApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)?.message;
    if (message) return message;
    if (error.response?.status === 401) return "Não autenticado";
    if (error.response?.status === 400) return "Dados inválidos";
    if (error.response?.status === 409) return "Conflito (email ou username duplicado)";
  }
  return "Erro inesperado";
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  try {
    const { data } = await apiClient.post<LoginResponse>("/auth/login", { email, password });
    return data;
  } catch (error) {
    throw new Error(parseApiError(error));
  }
}

export type PublicRegisterRole = "visitor" | "pro";

export type RegisterAccountPayload = {
  username: string;
  email: string;
  password: string;
  /** Apenas visitor ou pro; o servidor rejeita qualquer outro (força visitor). */
  role: PublicRegisterRole;
  /** Categoria de negócio (independente da role). */
  accountCategory: "visitor" | "designer_arquiteto" | "lojista" | "fabricante";
};

/** Resposta POST /auth/register (público, sem JWT). */
export type RegisterAccountResponse = {
  status: "ok";
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    accountCategory?: string;
  };
};

/**
 * Registo público — role só `visitor` ou `pro` (validado no servidor); user-settings vazio.
 * Após sucesso, o cliente deve chamar `login()` para sessão + `/me` + pipeline de settings.
 */
export async function createAccountRemote(payload: RegisterAccountPayload): Promise<RegisterAccountResponse> {
  try {
    const { data } = await apiClient.post<RegisterAccountResponse>("/auth/register", {
      username: payload.username.trim(),
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
      role: payload.role,
      accountCategory: payload.accountCategory,
    });
    if (!data || data.status !== "ok" || !data.user?.id) {
      throw new Error("Resposta inválida do servidor");
    }
    return data;
  } catch (error) {
    throw new Error(parseApiError(error));
  }
}

/**
 * Alinha o contrato PHP (`permissions` no root) com o modelo do cliente (`user.permissions`).
 * Prioridade: root `permissions` (oficial no backend), depois `user.permissions` se algum proxy aninhar.
 */
function normalizeMeResponse(data: MeApiPayload | undefined | null): MeResponse {
  const u = data?.user;
  const fromRoot = toStringArray(data?.permissions);
  const fromUser = toStringArray(u?.permissions);
  const permissions = fromRoot.length > 0 ? fromRoot : fromUser;
  return {
    status: "ok",
    user: {
      id: typeof u?.id === "string" ? u.id : "",
      username: typeof u?.username === "string" ? u.username : "",
      role: typeof u?.role === "string" ? u.role : "",
      permissions,
    },
  };
}

export async function getMe(): Promise<MeResponse> {
  try {
    const { data } = await apiClient.get<MeApiPayload>("/me");
    return normalizeMeResponse(data);
  } catch (error) {
    throw new Error(parseApiError(error));
  }
}
