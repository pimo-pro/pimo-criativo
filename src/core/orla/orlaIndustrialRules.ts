/**
 * Regras industriais de ORLA por tipo de peça (SSOT metros / PDF / ferragens_totais).
 * Restaurado após 8e991597 (que tinha restringido a «só portas»).
 *
 * - Todas as bordas: cima, fundo, porta, prateleira, gav_frente, remates, roda pé
 * - Frente e trás: laterais, sep, div (lados típicos sem cavilha)
 * - Só topo (front): gav_laterais, gav_costa, gav_frent_int
 * - Costa do módulo / espessura < 16 mm: sem orla
 * - Portas duplas: perímetro sem aresta de encontro
 */

import type { OrlaSideId } from "./orlaTypes";
import { EMPTY_ORLA_SIDES, type PieceOrlaConfig } from "./orlaTypes";
import { INDUSTRIAL_ORLA_SIDES } from "../industrialAdmin/industrialPieceTables";

/** Espessura mínima de chapa (mm) para aplicar orla — excepto costa (sempre sem orla). */
export const MIN_ORLA_PANEL_THICKNESS_MM = 16;

export type OrlaPieceSideContext = {
  /** Nome da peça (ex. PORT_ESQ / port_esq). */
  nome?: string;
  /** Lado da dobradiça (porta). */
  hingeSide?: string;
  /** Índice da folha em porta dupla (0 = esq, 1 = dir). */
  doorsLayerIndex?: number;
  /** Kind industrial: esq | dir | cima | baixa. */
  doorPositionKind?: string;
};

/** Normaliza tipo cutlist para matching. */
export function normalizeOrlaPieceTipo(tipoRaw: string): string {
  return String(tipoRaw ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function isCostaPieceTipo(tipoRaw: string): boolean {
  const t = normalizeOrlaPieceTipo(tipoRaw);
  if (!t.includes("costa")) return false;
  // costa de gaveta (gav_costa / gaveta_traseira) nao e a costa do modulo
  if (t.includes("gav") || t.includes("gaveta") || t.includes("traseira")) return false;
  return true;
}

export function isPrateleiraPieceTipo(tipoRaw: string): boolean {
  const t = normalizeOrlaPieceTipo(tipoRaw);
  return t.includes("prateleira") || t.includes("shelf");
}

/** True se a espessura da chapa permite orla industrial. */
export function pieceAllowsOrlaByThickness(espessuraMm: number): boolean {
  return Number.isFinite(espessuraMm) && espessuraMm + 1e-6 >= MIN_ORLA_PANEL_THICKNESS_MM;
}

/**
 * Folha de porta dupla: esq / dir / null (simples ou indeterminado).
 * Aresta de encontro (sem orla): esq → right; dir → left.
 */
export function resolveDoubleDoorLeaf(
  tipoRaw: string,
  ctx?: OrlaPieceSideContext
): "esq" | "dir" | null {
  const t = normalizeOrlaPieceTipo(tipoRaw);
  const nome = normalizeOrlaPieceTipo(ctx?.nome ?? "");
  const blob = `${t} ${nome}`;

  if (/porta_esq|port_esq|_esq\b|esquerda/.test(blob) && /porta|port_/.test(blob)) return "esq";
  if (/porta_dir|port_dir|_dir\b|direita/.test(blob) && /porta|port_/.test(blob)) return "dir";

  const kind = String(
    (ctx as OrlaPieceSideContext & { doorPositionKind?: string })?.doorPositionKind ?? ""
  ).toLowerCase();
  if (kind === "esq" || kind === "esquerda") return "esq";
  if (kind === "dir" || kind === "direita") return "dir";

  const hinge = String(ctx?.hingeSide ?? "").toLowerCase();
  if (t.includes("porta") && (t.includes("dupla") || ctx?.doorsLayerIndex != null || hinge || kind)) {
    if (hinge === "left" || hinge === "esq") return "esq";
    if (hinge === "right" || hinge === "dir") return "dir";
    if (ctx?.doorsLayerIndex === 0) return "esq";
    if (ctx?.doorsLayerIndex === 1) return "dir";
  }
  return null;
}

/**
 * Lados de orla a activar (domínio front/back/left/right).
 * Para peças de gaveta «só topo», usa-se `front` como aresta superior (ver orlaEdgeLengths).
 */
export function resolveOrlaSidesForPieceTipo(
  tipoRaw: string,
  ctx?: OrlaPieceSideContext
): OrlaSideId[] {
  const t = normalizeOrlaPieceTipo(tipoRaw);
  if (!t) return [];

  // Costa do módulo — nunca
  if (isCostaPieceTipo(t)) return [];

  // Modos industriais A/D — registo consolidado (Fase E)
  if (Object.prototype.hasOwnProperty.call(INDUSTRIAL_ORLA_SIDES, t)) {
    return [...INDUSTRIAL_ORLA_SIDES[t]!];
  }

  // Fundo de gaveta — sem orla
  if (t.includes("gav") && (t.includes("fundo") || t.includes("bottom") || t.includes("base"))) {
    return [];
  }

  // Gavetas corpo — só aresta superior (mapeada a `front`)
  if (
    /gav_lat|gaveta_lat|gav_lat_dir|gav_lat_esq/.test(t) ||
    (t.includes("gaveta") && (t.includes("lateral") || t.includes("lat_")))
  ) {
    return ["front"];
  }
  if (
    /gav_costa|gaveta_costa|gaveta_traseira/.test(t) ||
    (t.includes("gaveta") && (t.includes("costa") || t.includes("traseira")))
  ) {
    return ["front"];
  }
  if (/gav_frent_int|gaveta_frente_int|frente_int/.test(t)) {
    return ["front"];
  }

  // Laterais da caixa / sep / div — frente e trás (lados típicos sem cavilha)
  if (
    t.includes("lateral") ||
    t.includes("separador") ||
    t.includes("divisor") ||
    t.startsWith("div")
  ) {
    return ["front", "back"];
  }

  // Portas — perímetro; duplas sem aresta de encontro
  if (t.includes("porta")) {
    const leaf = resolveDoubleDoorLeaf(t, ctx);
    if (leaf === "esq") return ["front", "back", "left"];
    if (leaf === "dir") return ["front", "back", "right"];
    return ["front", "back", "left", "right"];
  }

  // Todas as bordas: cima, fundo, prateleira, gav_frente, remates, roda pé
  if (
    t === "cima" ||
    t === "fundo" ||
    t.includes("tampo") ||
    t.includes("prateleira") ||
    t.includes("shelf") ||
    t.includes("remate") ||
    t.includes("rodape") ||
    t.includes("roda_pe") ||
    /gaveta_frente|gav_frente|frente_gaveta|frente_fixa/.test(t) ||
    (t.includes("gaveta") && t.includes("frente") && !t.includes("int"))
  ) {
    return ["front", "back", "left", "right"];
  }

  return [];
}

export function buildPieceOrlaConfigForTipo(
  tipoRaw: string,
  presetId: string,
  previous?: PieceOrlaConfig,
  espessuraMm?: number,
  ctx?: OrlaPieceSideContext
): PieceOrlaConfig | null {
  if (isCostaPieceTipo(tipoRaw)) return null;
  if (espessuraMm != null && !pieceAllowsOrlaByThickness(espessuraMm)) return null;

  const sidesToEnable = resolveOrlaSidesForPieceTipo(tipoRaw, ctx);
  if (sidesToEnable.length === 0) return null;
  const sides = EMPTY_ORLA_SIDES();
  for (const side of sidesToEnable) {
    sides[side] = { presetId, enabled: true };
  }
  return {
    sides,
    orlaJunto: previous?.orlaJunto,
  };
}

/** Remove espessura do nome de material (ex. "MDF Branco 19mm" / "MDF Branco 19" -> "MDF Branco"). */
export function stripMaterialThicknessLabel(label: string): string {
  const multiply = "[\u00d7xX]";
  return String(label ?? "")
    .replace(new RegExp(`\\s*\\d+([.,]\\d+)?\\s*${multiply}\\s*\\d+([.,]\\d+)?\\s*mm\\b`, "gi"), "")
    .replace(/\s*\d+([.,]\d+)?\s*mm\b/gi, "")
    .replace(/\s+\d+([.,]\d+)?\s*$/g, "")
    .replace(new RegExp(`\\s*${multiply}\\s*$`, "g"), "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ref de orla para PDF: nome + espessura (sem largura). */
export function formatOrlaRefForPdf(nome: string, espessuraMm: number, _larguraMm?: number): string {
  const n = String(nome ?? "").trim() || "Orla";
  const cleaned = n
    .replace(/\s*\d+([.,]\d+)?\s*[\u00d7xX]\s*\d+([.,]\d+)?\s*mm\b/gi, "")
    .replace(/\s*\d+([.,]\d+)?\s*mm\b/gi, "")
    .replace(/\s*\d+([.,]\d+)?\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const e = Number.isFinite(espessuraMm) ? espessuraMm : 0.8;
  return `${cleaned || "Orla"} ${e}mm`.replace(/\s+/g, " ").trim();
}
