/**
 * Routing industrial: peça → máquina XML (CNC vs DRILL).
 *
 * CNC (`cnc/XML/{qr}.xml`): cima, fundo, costa de módulo, frentes/portas, prateleira.
 * DRILL (`drill/XML/{qr}_DRILL.xml`): laterais módulo, laterais/costa/frente gaveta, sep, div.
 * PRINCIPAL (`drill/{qr}.xml`): auditoria — todas as peças com XML (CNC+DRILL), sem duplicados.
 */

import type { CutListItemComPreco } from "../types";
import { isLateralPanel } from "./lateralDowels";
import { isDrawerPieceTipo } from "../../services/drawerCutlistAdapter";
import {
  INDUSTRIAL_DRILL_TIPOS,
  industrialDrillTokenMatch,
  industrialExcludeFromCncHeuristic,
  isIndustrialDrillTipo,
} from "../industrialAdmin/industrialPieceTables";

/** Destino de ficheiro no export. `completo` = lista principal em `drill/{qr}.xml`. */
export type XmlMachineTarget = "cnc" | "drill" | "completo";

const CNC_TIPOS = new Set([
  "cima",
  "fundo",
  "costa",
  "COSTA",
  "frente_fixa",
  "porta",
  "porta_simples",
  "porta_dupla",
  "porta_correr",
  "prateleira",
]);

const DRILL_TIPOS = new Set([
  "lateral_esquerda",
  "lateral_direita",
  "lat_esq",
  "lat_dir",
  "gaveta_lat_esq",
  "gaveta_lat_dir",
  "gav_lat_esq",
  "gav_lat_dir",
  "gaveta_traseira",
  "gav_costa",
  "gaveta_frente",
  "gav_frente",
  "gaveta_frente_int",
  "gaveta_frente_ext",
  "divisorio",
  "separador",
  "div",
  "sep",
  // Modos industriais A/D — registo consolidado (Fase E)
  ...INDUSTRIAL_DRILL_TIPOS,
]);

/** Peças sem furação de máquina (acabamentos / rodapés). */
const EXCLUDED_TIPOS = new Set([
  "remate",
  "roda_pe",
  "rodape",
  "rodapé",
  "rodape_frente",
  "rodape_lateral",
  "rodape_canto",
]);

function normalizeTipoToken(tipo: string): string {
  return String(tipo ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function isExcludedPiece(tipo: string, nome: string): boolean {
  const lower = normalizeTipoToken(tipo);
  if (EXCLUDED_TIPOS.has(tipo) || EXCLUDED_TIPOS.has(lower)) return true;
  const token = `${lower} ${normalizeTipoToken(nome)}`;
  if (token.includes("remate")) return true;
  if (token.includes("roda_pe") || token.includes("roda-pe") || token.includes("rodape")) {
    return true;
  }
  return false;
}

/**
 * Destino de máquina da peça (CNC ou DRILL).
 * `null` = não gera XML de máquina (ex.: remate, rodapé, fundo de gaveta sem furos).
 * Nota: o ficheiro principal (`drill/{qr}.xml`) é gerado à parte para todas as peças com XML.
 */
export function resolveXmlMachineTarget(
  item: Pick<CutListItemComPreco, "tipo" | "nome" | "drillHoles"> | string
): "cnc" | "drill" | null {
  const tipo = typeof item === "string" ? item : String(item.tipo ?? "");
  if (!tipo) return null;

  const nome =
    typeof item === "string" ? "" : String((item as { nome?: string }).nome ?? "");
  if (isExcludedPiece(tipo, nome)) return null;

  // DRILL antes de CNC: laterais / gavetas / div-sep / tipos industriais nunca caem em CNC.
  if (
    isIndustrialDrillTipo(tipo) ||
    DRILL_TIPOS.has(tipo) ||
    isLateralPanel({ tipo } as CutListItemComPreco)
  ) {
    return "drill";
  }

  // CNC nesting (furos + corte) — nunca entram em *_DRILL.xml
  if (CNC_TIPOS.has(tipo)) return "cnc";

  const lower = normalizeTipoToken(tipo);
  const nomeLower = normalizeTipoToken(nome);
  const token = `${lower} ${nomeLower}`;

  if (industrialDrillTokenMatch(token)) return "drill";
  if (lower.includes("lateral") && !lower.includes("gaveta")) return "drill";
  if (
    lower.startsWith("gaveta_lat") ||
    lower.includes("gav_lat") ||
    lower === "lat_dir" ||
    lower === "lat_esq"
  ) {
    return "drill";
  }
  if (lower === "gaveta_traseira" || lower.includes("gav_cost")) return "drill";
  if (
    lower.startsWith("gaveta_frente") ||
    lower.includes("gav_frent") ||
    lower === "gav_frente"
  ) {
    return "drill";
  }
  if (lower === "divisorio" || lower === "separador" || lower === "div" || lower === "sep") {
    return "drill";
  }

  // Peças CNC por heurística de nome/tipo (exclui modos industriais A/D via registo)
  if (
    lower === "cima" ||
    lower === "fundo" ||
    lower === "costa" ||
    lower.startsWith("porta") ||
    lower === "frente_fixa" ||
    lower === "prateleira" ||
    (nomeLower.startsWith("porta") && !token.includes("gav")) ||
    ((nomeLower === "cima" || nomeLower.includes("_cima") || nomeLower.endsWith("-cima")) &&
      !industrialExcludeFromCncHeuristic(token) &&
      !token.includes("gav")) ||
    ((nomeLower === "fundo" || nomeLower.includes("_fundo") || nomeLower.endsWith("-fundo")) &&
      !industrialExcludeFromCncHeuristic(token) &&
      !token.includes("gav"))
  ) {
    return "cnc";
  }

  // Qualquer peça com furos que não é CNC nesting → DRILL
  if (typeof item !== "string") {
    const holes = (item as { drillHoles?: unknown[] }).drillHoles;
    if (Array.isArray(holes) && holes.length > 0 && isDrawerPieceTipo(tipo)) return "drill";
  }

  return null;
}

/** Peça deve ter etiqueta/passo DRILL activo (apenas estação DRILL — não lista principal). */
export function pieceShouldHaveDrillLabel(
  item: Pick<CutListItemComPreco, "tipo" | "nome" | "drillHoles">
): boolean {
  if (resolveXmlMachineTarget(item) !== "drill") return false;
  return (item.drillHoles?.length ?? 0) > 0 || isLateralPanel(item as CutListItemComPreco);
}

/** Peça elegível para XML na estação DRILL. */
export function isDrillStationXmlPiece(item: CutListItemComPreco): boolean {
  return resolveXmlMachineTarget(item) === "drill";
}

/** Peça elegível para XML na estação CNC (furação em CNC). */
export function isCncStationXmlPiece(item: CutListItemComPreco): boolean {
  return resolveXmlMachineTarget(item) === "cnc";
}

export function isDrawerDrillPieceTipo(tipo: string): boolean {
  return (
    tipo === "gaveta_lat_esq" ||
    tipo === "gaveta_lat_dir" ||
    tipo === "gaveta_traseira" ||
    tipo === "gaveta_frente" ||
    tipo === "gaveta_frente_int" ||
    tipo === "gaveta_frente_ext" ||
    (isDrawerPieceTipo(tipo) && resolveXmlMachineTarget(tipo) === "drill")
  );
}

/** Frente de gaveta — furação exclusiva DRILL (nunca TCN/CNC). */
export function isDrawerFrontPieceTipo(tipo: string): boolean {
  const t = normalizeTipoToken(tipo);
  return (
    t === "gaveta_frente" ||
    t === "gaveta_frente_int" ||
    t === "gaveta_frente_ext" ||
    t === "gav_frente" ||
    t === "gav_frent" ||
    t === "gav_frent_int" ||
    t === "gav_frent_ext" ||
    t.startsWith("gaveta_frente") ||
    t.startsWith("gav_frent")
  );
}
