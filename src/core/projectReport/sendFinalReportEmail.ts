import { buildApiUrl } from "../../config/api";

/** Proxy PHP no mesmo host — secret fica só no servidor (PIMO_INTERNAL_API_SECRET). */
const FINAL_REPORT_EMAIL_PROXY_PATH = "/api/final-report/index.php";
// Cobre o "cold start" do plano free do Render (~50s observados) + margem.
const REQUEST_TIMEOUT_MS = 60_000;

export type FinalReportEmailPayload = {
  recipientEmail: string;
  projectName: string;
  designer: string;
  boxCount: number;
  pecasCount: number;
  qualityRating: number;
  subtotal: number;
  ivaPct: number;
  ivaValor: number;
  totalProjeto: number;
  attachment: Blob;
  attachmentFileName?: string;
};

export type FinalReportEmailResult = {
  success: boolean;
  error?: string;
};

/**
 * Envia o Relatório Final via proxy server-side (sem secret no bundle).
 * Lança erro apenas se o pedido não chegar a completar (rede/timeout).
 */
export async function sendFinalReportEmail(
  payload: FinalReportEmailPayload
): Promise<FinalReportEmailResult> {
  const formData = new FormData();
  formData.append("recipientEmail", payload.recipientEmail);
  formData.append("projectName", payload.projectName);
  formData.append("designer", payload.designer);
  formData.append("boxCount", String(payload.boxCount));
  formData.append("pecasCount", String(payload.pecasCount));
  formData.append("qualityRating", String(payload.qualityRating));
  formData.append("subtotal", String(payload.subtotal));
  formData.append("ivaPct", String(payload.ivaPct));
  formData.append("ivaValor", String(payload.ivaValor));
  formData.append("totalProjeto", String(payload.totalProjeto));
  formData.append(
    "attachment",
    payload.attachment,
    payload.attachmentFileName ?? "Relatorio_Final.pdf"
  );

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(buildApiUrl(FINAL_REPORT_EMAIL_PROXY_PATH), {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    const data = (await response.json().catch(() => null)) as FinalReportEmailResult | null;
    if (!data) {
      return { success: false };
    }
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}
