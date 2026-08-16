import type { RematePiece, RematePieceTipo } from "./rematePieceTypes";
import { remateLIndustrialSuffix } from "./remateLGeometry";
import { inferProductTypeFromLegacy } from "./remateProductRules";

/** Sanitiza nome de caixa para etiqueta industrial (espelha DIV/SEP). */
export function sanitizeRemateBoxName(boxName: string): string {
  return (
    String(boxName || "BOX")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_\-]/g, "")
      .slice(0, 32) || "BOX"
  );
}

/** Suffix industrial após `_REMATE_` (ex.: DIR, L_ext, CIMA). */
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

/** Nome industrial: BOXNAME_REMATE_DIR_01 */
export function buildRemateIndustrialLabel(
  boxName: string,
  suffix: string,
  index1Based: number
): string {
  const safeName = sanitizeRemateBoxName(boxName);
  const safeSuffix =
    String(suffix || "REMATE")
      .trim()
      .replace(/[^a-zA-Z0-9_]/g, "") || "REMATE";
  const num = String(Math.max(1, index1Based)).padStart(2, "0");
  return `${safeName}_REMATE_${safeSuffix}_${num}`;
}

export function buildRemateIndustrialLabelsForRemates(
  remates: readonly RematePiece[],
  boxNameById: ReadonlyMap<string, string> | Record<string, string>
): Map<string, string> {
  const getBoxName = (boxId: string): string => {
    if (boxNameById instanceof Map) return boxNameById.get(boxId) ?? boxId;
    return boxNameById[boxId] ?? boxId;
  };

  const counters = new Map<string, number>();
  const labels = new Map<string, string>();

  for (const remate of remates) {
    const boxId = remate.parentBoxId ?? "";
    const suffix = resolveRemateIndustrialSuffix(remate);
    const counterKey = `${boxId}\0${suffix}`;
    const index = (counters.get(counterKey) ?? 0) + 1;
    counters.set(counterKey, index);
    const boxName = boxId ? getBoxName(boxId) : remate.name.split("_")[0] ?? "BOX";
    labels.set(remate.id, buildRemateIndustrialLabel(boxName, suffix, index));
  }

  return labels;
}

/** Nome exibido na UI/cutlist: personalizado ou rótulo industrial automático. */
export function resolveRematePieceDisplayName(
  remate: RematePiece,
  autoIndustrialLabel: string
): string {
  const custom = remate.nomePersonalizado?.trim();
  if (custom) return custom;
  return autoIndustrialLabel;
}

export function resolveRematePieceNomeForRemate(
  remate: RematePiece,
  boxNameById: ReadonlyMap<string, string> | Record<string, string>
): string {
  const autoLabel =
    buildRemateIndustrialLabelsForRemates([remate], boxNameById).get(remate.id) ?? remate.name;
  return resolveRematePieceDisplayName(remate, autoLabel);
}
