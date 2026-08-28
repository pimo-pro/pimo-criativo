import axios from "axios";

import { apiClient } from "./apiClient";
import type {
  InviteAssignableRole,
  InviteCodeRecord,
  InviteUsageMode,
} from "../core/auth/inviteCodeRules";

function parseError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)?.message;
    if (message) return message;
    if (error.response?.status === 403) return "Sem permissão (requer admin.full_access)";
  }
  return "Erro ao comunicar com invite-codes";
}

export async function getInviteCodesRemote(): Promise<InviteCodeRecord[]> {
  try {
    const { data } = await apiClient.get<{ status: string; inviteCodes?: InviteCodeRecord[] }>(
      "/invite-codes"
    );
    if (!data || data.status !== "ok" || !Array.isArray(data.inviteCodes)) {
      throw new Error("Resposta inválida");
    }
    return data.inviteCodes;
  } catch (error) {
    throw new Error(parseError(error));
  }
}

export async function createInviteCodeRemote(payload: {
  code: string;
  role: InviteAssignableRole;
  usageMode: InviteUsageMode;
}): Promise<InviteCodeRecord> {
  try {
    const { data } = await apiClient.post<{
      status: string;
      inviteCode?: InviteCodeRecord;
      message?: string;
    }>("/invite-codes", payload);
    if (!data || data.status !== "ok" || !data.inviteCode) {
      throw new Error(data?.message ?? "Falha ao criar código");
    }
    return data.inviteCode;
  } catch (error) {
    throw new Error(parseError(error));
  }
}

export async function setInviteCodeActiveRemote(
  id: string,
  active: boolean
): Promise<InviteCodeRecord> {
  try {
    const { data } = await apiClient.patch<{
      status: string;
      inviteCode?: InviteCodeRecord;
      message?: string;
    }>(`/invite-codes?id=${encodeURIComponent(id)}`, { active });
    if (!data || data.status !== "ok" || !data.inviteCode) {
      throw new Error(data?.message ?? "Falha ao actualizar código");
    }
    return data.inviteCode;
  } catch (error) {
    throw new Error(parseError(error));
  }
}

export async function deleteInviteCodeRemote(id: string): Promise<void> {
  try {
    const { data } = await apiClient.delete<{ status: string; message?: string }>(
      `/invite-codes?id=${encodeURIComponent(id)}`
    );
    if (!data || data.status !== "ok") {
      throw new Error(data?.message ?? "Falha ao remover código");
    }
  } catch (error) {
    throw new Error(parseError(error));
  }
}
