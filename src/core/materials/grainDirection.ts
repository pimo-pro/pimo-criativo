import type { RemateProductType, RematePieceTipo, RemateMountSlot } from "../remate/rematePieceTypes";
import type { IndustrialGrainCode } from "../types";

export type { IndustrialGrainCode };

export type IndustrialGrainInput = {
  tipo: string;
  remateProductType?: RemateProductType;
  remateTipo?: RematePieceTipo;
  remateMountSlot?: RemateMountSlot;
};

const PORTA_TIPOS = new Set([
  "porta_simples",
  "porta_dupla",
  "porta_correr",
  "porta_inferior",
  "porta_superior",
  "frente_fixa",
]);

function isRemateCompletoLateral(input: IndustrialGrainInput): boolean {
  if (input.tipo !== "remate") return false;
  if (input.remateProductType === "AVISTA") return false;
  if (input.remateProductType === "RODAPE" || input.remateProductType === "RODAPE_L") return false;
  if (input.remateProductType === "TAMPO_COZINHA") return false;
  const lateral =
    input.remateTipo === "DIR" ||
    input.remateTipo === "ESQ" ||
    (input.remateTipo === "L" &&
      input.remateProductType === "L" &&
      (input.remateMountSlot === "DIR" || input.remateMountSlot === "ESQ"));
  if (!lateral) return false;
  if (input.remateProductType === "COMPLETO" || input.remateProductType === "L") return true;
  if (input.remateProductType == null) return true;
  return false;
}

/** Resolve YY/XX conforme regras industriais aprovadas. */
export function resolveIndustrialGrainCode(input: IndustrialGrainInput): IndustrialGrainCode {
  if (PORTA_TIPOS.has(input.tipo)) return "YY";
  if (input.tipo === "gaveta_frente" || input.tipo === "gaveta_frente_ext" || input.tipo === "gaveta_frente_int") {
    return "YY";
  }
  if (isRemateCompletoLateral(input)) return "YY";
  if (input.tipo === "remate") return "XX";
  return "XX";
}

export function isGrainRotationLocked(code: IndustrialGrainCode | undefined): boolean {
  return code === "YY";
}

/**
 * Eixo de veio fixo no layout de corte (só quando YY).
 * length = fibra ao longo da largura da peça; width = ao longo da altura.
 */
export function industrialGrainToLayoutAxis(
  code: IndustrialGrainCode,
  tipo: string
): "length" | "width" | undefined {
  if (code !== "YY") return undefined;
  if (tipo === "gaveta_frente") return "length";
  return "width";
}
