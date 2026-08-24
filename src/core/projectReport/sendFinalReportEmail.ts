const FINAL_REPORT_EMAIL_URL = "https://pimo-mail-service.onrender.com/send-final-report";
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
 * Envia o Relatório Final para o pimo-mail-service (mesmo padrão vivo do orçamento:
 * POST directo + header x-internal-secret via VITE_INTERNAL_API_SECRET).
 * Lança erro apenas se o pedido não chegar a completar (rede/timeout).
 */
export async function sendFinalReportEmail(
  payload: FinalReportEmailPayload
): Promise<FinalReportEmailResult> {
  const secret = import.meta.env.VITE_INTERNAL_API_SECRET as string | undefined;

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
    const response = await fetch(FINAL_REPORT_EMAIL_URL, {
      method: "POST",
      headers: secret ? { "x-internal-secret": secret } : undefined,
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
