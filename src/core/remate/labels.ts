import type { RematePiece, RematePieceTipo } from "./rematePieceTypes";
import { remateLIndustrialSuffix } from "./remateLGeometry";
import { inferProductTypeFromLegacy } from "./remateProductRules";

/** Suffix industrial do remate (ex.: DIR, L_ext, CIMA) — chave para naming unificado. */
export function resolveRemateIndustrialSuffix(remate: RematePiece): string {
  const productType = remate.productType ?? inferProductTypeFromLegacy(remate);

  if (productType === "L" || remate.tipo === "L") {
    return remateLIndustrialSuffix(remate.partIndex);
  }

  if (productType === "TAMPO_COZINHA" || remate.tipo === "TAMPO") {
    return "TAMPO";
  }

  if (productType === "RODAPE_L" || remate.tipo === "RODAPE_L") {
    return remate.partIndex === 2 ? "RODAPE_L_B" : "RODAPE_L_A";
  }

  if (remate.partRole === "TOP" || remate.tipo === "CIMA") return "CIMA";
  if (remate.partRole === "BOTTOM" || remate.tipo === "BAIXO") return "BAIXO";

  const tipo = remate.tipo;
  if (isRemateTipoSuffix(tipo)) return tipo;

  if (productType === "AVISTA") return "AVISTA";
  if (productType === "RODAPE") return "RODAPE";

  const slot = remate.mountSlot;
  if (slot === "FUNDO") return "BAIXO";
  if (slot === "CIMA") return "CIMA";
  if (slot === "FRENTE" || slot === "TRAS") return "FRENTE";
  if (slot === "DIR" || slot === "ESQ") return slot;

  return "FRENTE";
}

function isRemateTipoSuffix(
  tipo: RematePieceTipo
): tipo is Exclude<RematePieceTipo, "L" | "RODAPE_L"> {
  return (
    tipo === "FRENTE" ||
    tipo === "DIR" ||
    tipo === "ESQ" ||
    tipo === "CIMA" ||
    tipo === "BAIXO" ||
    tipo === "RODAPE" ||
    tipo === "TAMPO"
  );
}

/** Nome exibido na UI/cutlist: personalizado ou rótulo curto por suffix. */
export function resolveRematePieceDisplayName(
  remate: RematePiece,
  autoDisplayLabel: string
): string {
  const custom = remate.nomePersonalizado?.trim();
  if (custom) return custom;
  return autoDisplayLabel;
}

export function resolveRematePieceNomeForRemate(
  remate: RematePiece,
  _boxNameById?: ReadonlyMap<string, string> | Record<string, string>
): string {
  void _boxNameById;
  const suffix = resolveRemateIndustrialSuffix(remate);
  return resolveRematePieceDisplayName(remate, `Remate ${suffix}`);
}
