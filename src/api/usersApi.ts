import axios from "axios";

import { apiClient } from "./apiClient";
import type { AuthUserAccountFields } from "../core/auth/accountEffectiveRole";

export type RemoteUserPublic = AuthUserAccountFields & {
  id: string;
  email: string;
  username: string;
  role: string;
  createdAt: string;
};

export type CreateUserPayload = {
  username: string;
  email: string;
  password: string;
  role: string;
};

export type UpdateUserPayload = {
  username?: string;
  email?: string;
  password?: string;
  role?: string;
  accountStatus?: "approved";
};

export type ApproveUserPayload = {
  accountStatus: "approved";
  role: "pro" | "ultra" | "ultra+";
};

export type RejectUserPayload = {
  accountStatus: "approved";
  role: "visitor";
};

function parseUsersError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)?.message;
    if (message) return message;
    if (error.response?.status === 401) return "Não autenticado";
    if (error.response?.status === 403) return "Sem permissão (requer admin.full_access)";
  }
  return "Erro ao comunicar com o servidor";
}

export async function getUsersRemote(): Promise<RemoteUserPublic[]> {
  try {
    const { data } = await apiClient.get<{ status: string; users?: RemoteUserPublic[] }>("/users");
    if (!data || data.status !== "ok" || !Array.isArray(data.users)) {
      throw new Error("Resposta inválida");
    }
    return data.users;
  } catch (error) {
    throw new Error(parseUsersError(error));
  }
}

export async function createUserRemote(payload: CreateUserPayload): Promise<RemoteUserPublic> {
  try {
    const { data } = await apiClient.post<{ status: string; user?: RemoteUserPublic; message?: string }>(
      "/users",
      payload
    );
    if (!data || data.status !== "ok" || !data.user) {
      throw new Error(data?.message ?? "Falha ao criar utilizador");
    }
    return data.user;
  } catch (error) {
    throw new Error(parseUsersError(error));
  }
}

export async function updateUserRemote(id: string, payload: UpdateUserPayload): Promise<RemoteUserPublic> {
  try {
    const { data } = await apiClient.put<{ status: string; user?: RemoteUserPublic; message?: string }>(
      `/users?id=${encodeURIComponent(id)}`,
      payload
    );
    if (!data || data.status !== "ok" || !data.user) {
      throw new Error(data?.message ?? "Falha ao atualizar");
    }
    return data.user;
  } catch (error) {
    throw new Error(parseUsersError(error));
  }
}

export async function approveUserRemote(
  id: string,
  role: ApproveUserPayload["role"]
): Promise<RemoteUserPublic> {
  return updateUserRemote(id, { accountStatus: "approved", role });
}

export async function rejectUserRemote(id: string): Promise<RemoteUserPublic> {
  return updateUserRemote(id, { accountStatus: "approved", role: "visitor" });
}

export async function deleteUserRemote(id: string): Promise<void> {
  try {
    const { data } = await apiClient.delete<{ status: string; message?: string }>(
      `/users?id=${encodeURIComponent(id)}`
    );
    if (!data || data.status !== "ok") {
      throw new Error(data?.message ?? "Falha ao remover");
    }
  } catch (error) {
    throw new Error(parseUsersError(error));
  }
}
