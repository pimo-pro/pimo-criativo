import axios from "axios";

import { apiClient } from "./apiClient";
import type { AccountStatus } from "../core/auth/accountEffectiveRole";

export type AuthUserPayload = {
  id: string;
  username: string;
  role: string;
  effectiveRole?: string;
  accountStatus?: AccountStatus;
  requestedRole?: string | null;
  accountCategory?: string | null;
  permissions?: string[];
};

export type LoginResponse = {
  status: "ok";
  token: string;
  user: AuthUserPayload;
};

export type MeResponse = {
  status: "ok";
  user: AuthUserPayload & { permissions: string[] };
};

type MeApiPayload = {
  status?: string;
  user?: AuthUserPayload & { permissions?: unknown };
  permissions?: unknown;
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export const EMAIL_NOT_VERIFIED_MESSAGE =
  "Confirme o seu e-mail antes de continuar — verifique a sua caixa de entrada.";

function parseApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as { message?: string; code?: string } | undefined;
    if (payload?.code === "email_not_verified") {
      return EMAIL_NOT_VERIFIED_MESSAGE;
    }
    const message = payload?.message;
    if (message) return message;
    if (error.response?.status === 401) return "Não autenticado";
    if (error.response?.status === 403) return "Acesso negado";
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
  role: PublicRegisterRole;
  accountCategory: "visitor" | "designer_arquiteto" | "lojista" | "fabricante";
};

export type RegisterAccountResponse = {
  status: "ok";
  user: AuthUserPayload;
  requiresEmailVerification?: boolean;
};

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
    return {
      status: "ok",
      user: data.user,
      requiresEmailVerification: data.requiresEmailVerification === true,
    };
  } catch (error) {
    throw new Error(parseApiError(error));
  }
}

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
      effectiveRole: typeof u?.effectiveRole === "string" ? u.effectiveRole : u?.role,
      accountStatus: u?.accountStatus === "pending" ? "pending" : "approved",
      requestedRole: u?.requestedRole ?? null,
      accountCategory: u?.accountCategory ?? null,
      permissions,
    },
  };
}

export function mapAuthUserFromApi(user: AuthUserPayload & { permissions?: string[] }) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    effectiveRole: user.effectiveRole ?? user.role,
    accountStatus: user.accountStatus === "pending" ? ("pending" as const) : ("approved" as const),
    requestedRole: user.requestedRole ?? null,
    accountCategory: user.accountCategory ?? null,
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

export type VerifyEmailResponse = {
  status: "ok";
  message: string;
};

export async function verifyEmailRemote(token: string): Promise<VerifyEmailResponse> {
  try {
    const { data } = await apiClient.get<VerifyEmailResponse>("/auth/verify-email", {
      params: { token },
    });
    if (!data || data.status !== "ok") {
      throw new Error("Resposta inválida do servidor");
    }
    return data;
  } catch (error) {
    throw new Error(parseApiError(error));
  }
}
