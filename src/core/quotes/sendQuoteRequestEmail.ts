import { formatCurrency } from "../../utils/formatting";
import { buildApiUrl } from "../../config/api";

/** Proxy PHP no mesmo host — secret fica só no servidor (PIMO_INTERNAL_API_SECRET). */
const QUOTE_EMAIL_PROXY_PATH = "/api/quotes/index.php";
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
  error?: string;
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
 * Envia o pedido de orçamento via proxy server-side (sem secret no bundle).
 * Lança erro apenas se o pedido não chegar a completar (rede/timeout); uma
 * resposta HTTP válida com success:false é devolvida normalmente, não lançada,
 * para o chamador poder distinguir "projeto guardado, email falhou" de
 * "pedido nem chegou a sair".
 */
export async function sendQuoteRequestEmail(payload: QuoteRequestPayload): Promise<QuoteRequestEmailResult> {
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
    const response = await fetch(buildApiUrl(QUOTE_EMAIL_PROXY_PATH), {
      method: "POST",
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
