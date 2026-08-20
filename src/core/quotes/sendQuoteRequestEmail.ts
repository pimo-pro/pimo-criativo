import { formatCurrency } from "../../utils/formatting";

const QUOTE_EMAIL_URL = "https://pimo-mail-service.onrender.com/send-quote-email";
// Cobre o "cold start" do plano free do Render (~50s observados) + margem.
const REQUEST_TIMEOUT_MS = 60_000;

export type QuoteRequestPayload = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  projectName: string;
  designer: string;
  materials: string;
  notes: string;
  pricingSummary: string;
  attachment?: Blob | null;
};

export type QuoteRequestEmailResults = Record<string, { success: boolean; error?: string }>;

export type QuoteRequestEmailResult = {
  success: boolean;
  results?: QuoteRequestEmailResults;
};

export function buildPricingSummary(pricing: {
  precoTotalPecas: number | null;
  precoTotalAcessorios: number | null;
  precoTotalProjeto: number | null;
}): string {
  return [
    `Peças: ${formatCurrency(pricing.precoTotalPecas)}`,
    `Ferragens: ${formatCurrency(pricing.precoTotalAcessorios)}`,
    `Total estimado: ${formatCurrency(pricing.precoTotalProjeto)}`,
  ].join("\n");
}

/**
 * Envia o pedido de orçamento para o pimo-mail-service.
 * Lança erro apenas se o pedido não chegar a completar (rede/timeout); uma
 * resposta HTTP válida com success:false é devolvida normalmente, não lançada,
 * para o chamador poder distinguir "projeto guardado, email falhou" de
 * "pedido nem chegou a sair".
 */
export async function sendQuoteRequestEmail(payload: QuoteRequestPayload): Promise<QuoteRequestEmailResult> {
  const secret = import.meta.env.VITE_INTERNAL_API_SECRET as string | undefined;

  const formData = new FormData();
  formData.append("customerName", payload.customerName);
  formData.append("customerEmail", payload.customerEmail);
  formData.append("customerPhone", payload.customerPhone);
  formData.append("projectName", payload.projectName);
  formData.append("designer", payload.designer);
  formData.append("materials", payload.materials);
  formData.append("notes", payload.notes);
  formData.append("pricingSummary", payload.pricingSummary);
  if (payload.attachment) {
    formData.append("attachment", payload.attachment, "orcamento.jpg");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(QUOTE_EMAIL_URL, {
      method: "POST",
      headers: secret ? { "x-internal-secret": secret } : undefined,
      body: formData,
      signal: controller.signal,
    });

    const data = (await response.json().catch(() => null)) as QuoteRequestEmailResult | null;
    if (!data) {
      return { success: false };
    }
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}
