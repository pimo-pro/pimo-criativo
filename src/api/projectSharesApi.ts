import axios from "axios";

import { apiClient } from "./apiClient";

export type ProjectShareRecord = {
  id: string;
  projectId: string;
  userId: string;
  grantedBy: string;
  access: string;
  createdAt: string;
};

function parseError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)?.message;
    if (message) return message;
    if (error.response?.status === 403) return "Sem permissão (requer admin.full_access)";
  }
  return "Erro ao comunicar com project-shares";
}

export async function getProjectSharesRemote(filters?: {
  userId?: string;
  projectId?: string;
}): Promise<ProjectShareRecord[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.userId) params.set("userId", filters.userId);
    if (filters?.projectId) params.set("projectId", filters.projectId);
    const qs = params.toString();
    const { data } = await apiClient.get<{ status: string; shares?: ProjectShareRecord[] }>(
      `/project-shares${qs ? `?${qs}` : ""}`
    );
    if (!data || data.status !== "ok" || !Array.isArray(data.shares)) {
      throw new Error("Resposta inválida");
    }
    return data.shares;
  } catch (error) {
    throw new Error(parseError(error));
  }
}

export async function createProjectShareRemote(payload: {
  projectId: string;
  userId: string;
}): Promise<ProjectShareRecord> {
  try {
    const { data } = await apiClient.post<{ status: string; share?: ProjectShareRecord; message?: string }>(
      "/project-shares",
      payload
    );
    if (!data || data.status !== "ok" || !data.share) {
      throw new Error(data?.message ?? "Falha ao criar partilha");
    }
    return data.share;
  } catch (error) {
    throw new Error(parseError(error));
  }
}

export async function deleteProjectShareRemote(id: string): Promise<void> {
  try {
    const { data } = await apiClient.delete<{ status: string; message?: string }>(
      `/project-shares?id=${encodeURIComponent(id)}`
    );
    if (!data || data.status !== "ok") {
      throw new Error(data?.message ?? "Falha ao remover partilha");
    }
  } catch (error) {
    throw new Error(parseError(error));
  }
}
