import type { EnviarParaFabricaPayload } from "./IndustrialPieceEditsService";
import { authHeaders, canUseRemoteProjectsApi } from "../projects/remoteApiAuth";

export type IndustrialOrderSubmitResult = {
  ok: boolean;
  orderId?: string;
  createdAt?: string;
  pecasCount?: number;
  error?: string;
};

export type IndustrialOrderPayload = EnviarParaFabricaPayload & {
  ownerId?: string;
  ownerName?: string;
};

/**
 * Envia ordem industrial para PIMO TRAK via POST /api/industrial/orders.
 * Phase 1: requer JWT (não local-dev-token).
 */
export async function submitIndustrialOrder(
  payload: IndustrialOrderPayload
): Promise<IndustrialOrderSubmitResult> {
  if (!canUseRemoteProjectsApi()) {
    return {
      ok: false,
      error: "Sessão remota necessária para enviar à fábrica",
    };
  }
  try {
    const res = await fetch("/api/industrial/orders", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      orderId?: string;
      createdAt?: string;
      pecasCount?: number;
      error?: string;
    };
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        error: data.error ?? `HTTP ${res.status}`,
      };
    }
    return {
      ok: true,
      orderId: data.orderId,
      createdAt: data.createdAt,
      pecasCount: data.pecasCount,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
