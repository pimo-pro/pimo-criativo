/**
 * Normalizacao exclusiva do PDF ferragens_totais (apresentacao).
 * Nao altera catalogo industrial, CNC, furos nem outros PDFs.
 * Literais PT usam escapes Unicode para evitar corrupcao de encoding no disco.
 */

import type { BoxModule, CutListItem, CutListItemComPreco, PanelDrillHole, WorkspaceBox } from "../types";
import type { FerragensTotaisArmazemRow } from "../industrial/industrialBottomSectionData";
import { getNumDobradicas, type RulesConfig } from "../rules/rulesConfig";
import { isIndustrialDoorPanelTipo } from "../doors/industrialDoorPanels";
import { resolveActiveDrawersLayer, resolveActiveGavetasCount } from "../drawers/drawerModeloAGate";
import {
  aggregatePesPlasticoFromBoxes,
  aggregateParafuso3x30FromBoxes,
  loadPesPlasticoConfig,
  PARAFUSO_3X30_ID,
  PARAFUSO_3X30_MEDIDA,
  PARAFUSO_3X30_NOME,
  PARAFUSO_3X30_PRECO,
  PE_PLASTICO_ID,
  PE_PLASTICO_NOME,
} from "../ferragens/pesPlasticoConfig";
import {
  aggregateParafuso4x35FromProject,
  aggregateParafuso5x50FromBoxes,
  aggregatePuxa8mmFromBoxes,
  PARAFUSO_4X35_ID,
  PARAFUSO_5X50_ID,
  PUXA_8MM_ID,
} from "../ferragens/freeagemParafusos";
import type { RematePiece } from "../remate/rematePieceTypes";
import {
  aggregateCalcoRowsForPdf,
  CALCO_MATERIAL,
  loadCalcoConfig,
} from "../ferragens/calcoConfig";
import {
  aggregateOrlaRowsForFerragensTotaisPdf,
  computeOrlaFerragem,
  syncOrlaPiecesForProject,
} from "../orla/orlaCalculator";
import type { OrlaPreset } from "../orla/orlaTypes";
import type { ProjectFerragemOrla } from "../orla/orlaTypes";
import { normalizeOrlaPresets } from "../orla/orlaPresets";

export const CORREDICA_LENGTHS_MM = [300, 350, 400, 450, 500, 550] as const;
export const PARAFUSO_COSTA_SPACING_MM = 180;

const EM_DASH = "\u2014";
const CORREDICA_LABEL = "Corredi\u00e7a";
const DOBRADICA_LABEL = "Dobradi\u00e7a";
/** Ref industrial oficial da dobradiça principal (PDF / totais). */
export const DOBRADICA_REF = "I-Sensys 8645i";
const PE_REF_DEFAULT = "P\u00e9-Pl\u00e1stico";

export function snapCorredicaLengthMm(depthMm: number): number {
  if (!Number.isFinite(depthMm) || depthMm <= 0) return 450;
  let best: number = CORREDICA_LENGTHS_MM[0];
  let bestDist = Math.abs(depthMm - best);
  for (const len of CORREDICA_LENGTHS_MM) {
    const d = Math.abs(depthMm - len);
    if (d < bestDist) {
      best = len;
      bestDist = d;
    }
  }
  return best;
}

/** Parafuso 3x30: 1 por cada 18 cm em cada uma das 4 bordas (ceil por lado). */
export function countParafusosCosta3x30(
  items: Array<Pick<CutListItemComPreco, "tipo" | "dimensoes" | "quantidade">>
): number {
  let total = 0;
  for (const item of items) {
    const tipo = String(item.tipo ?? "").trim().toLowerCase();
    if (tipo !== "costa") continue;
    const w = Number(item.dimensoes?.largura) || 0;
    const h = Number(item.dimensoes?.altura) || 0;
    if (w <= 0 || h <= 0) continue;
    const qty = Math.max(1, Math.floor(Number(item.quantidade) || 1));
    const perPiece =
      Math.ceil(w / PARAFUSO_COSTA_SPACING_MM) +
      Math.ceil(w / PARAFUSO_COSTA_SPACING_MM) +
      Math.ceil(h / PARAFUSO_COSTA_SPACING_MM) +
      Math.ceil(h / PARAFUSO_COSTA_SPACING_MM);
    total += perPiece * qty;
  }
  return total;
}

function normalizeKey(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[x\u00d7]/gi, "x")
    .replace(/\u00d7/g, "x");
}

type Bucket =
  | "cavilha"
  | "corredica"
  | "dobradica"
  | "calco"
  | "suporte"
  | "parafuso_puxador"
  | "parafuso_3x30"
  | "parafuso_4x35"
  | "parafuso_5x50"
  | "puxa_8mm"
  | "prego_costa"
  | "pe"
  | "other";

function classifyFerragem(nome: string, ref: string): Bucket {
  const n = normalizeKey(nome);
  const r = normalizeKey(ref);
  if (n.includes("parafuso") && n.includes("puxador")) return "parafuso_puxador";
  if (r === "parafuso_puxador") return "parafuso_puxador";
  if (r === PARAFUSO_4X35_ID || n.includes("4x35") || /parafuso\s*4\s*x\s*35/.test(n)) {
    return "parafuso_4x35";
  }
  if (r === PARAFUSO_5X50_ID || n.includes("5x50") || /parafuso\s*5\s*x\s*50/.test(n)) {
    return "parafuso_5x50";
  }
  if (r === PUXA_8MM_ID || n.includes("puxa")) return "puxa_8mm";
  if (
    r === PARAFUSO_3X30_ID ||
    r === "parafuso_3x30" ||
    (n.includes("parafuso") && n.includes("3") && n.includes("30") && !n.includes("puxador"))
  ) {
    return "parafuso_3x30";
  }
  if (n.includes("prego") && n.includes("costa")) return "prego_costa";
  if (r === "prego_costa") return "prego_costa";
  if (n.includes("cavilha") || r.startsWith("cavilha")) return "cavilha";
  if (n.includes("corredica") || r.startsWith("corredica") || n === "corredicas") {
    return "corredica";
  }
  if (n.includes("dobradica") || r.startsWith("dobradica") || n === "dobradicas") {
    return "dobradica";
  }
  if (n.includes("calco") || r.startsWith("calco_")) {
    return "calco";
  }
  if (n.includes("suporte") && n.includes("prateleira")) return "suporte";
  if (r === "suporte_prateleira" || n === "suportes_prateleira") return "suporte";
  if (
    r === PE_PLASTICO_ID ||
    r === "pe-plastico" ||
    r === normalizeKey(PE_REF_DEFAULT) ||
    n === normalizeKey(PE_PLASTICO_NOME) ||
    n.includes("pe de plastico") ||
    n.includes("pe plastico") ||
    (n.startsWith("pe") &&
      (n.includes("cozinha") || n.includes("regulavel") || n.includes("plastico")))
  ) {
    return "pe";
  }
  return "other";
}

function drawerDepthMm(box: BoxModule): number {
  const fromDim = Number(box.dimensoes?.profundidade);
  if (Number.isFinite(fromDim) && fromDim > 0) return fromDim;
  const layer = resolveActiveDrawersLayer(box);
  for (const d of layer) {
    const util = Number((d as { profundidadeUtilMm?: number }).profundidadeUtilMm);
    if (Number.isFinite(util) && util > 0) return util;
  }
  return 450;
}

function countDrawersInBox(box: BoxModule): number {
  const layer = resolveActiveDrawersLayer(box);
  if (layer.length > 0) return layer.length;
  return resolveActiveGavetasCount(box);
}

/**
 * Distribui pares de corredica por comprimento (snap 300-550),
 * proporcional ao numero de gavetas por profundidade.
 */
export function distributeCorredicaPairsByLength(
  pairs: number,
  boxes: BoxModule[]
): Array<{ lengthMm: number; qty: number }> {
  if (pairs <= 0) return [];

  const byLength = new Map<number, number>();
  let drawerSlots = 0;
  for (const box of boxes) {
    const n = countDrawersInBox(box);
    if (n <= 0) continue;
    const len = snapCorredicaLengthMm(drawerDepthMm(box));
    byLength.set(len, (byLength.get(len) ?? 0) + n);
    drawerSlots += n;
  }

  if (drawerSlots <= 0 || byLength.size === 0) {
    return [{ lengthMm: 450, qty: pairs }];
  }

  const lengths = [...byLength.keys()].sort((a, b) => a - b);
  const out: Array<{ lengthMm: number; qty: number }> = [];
  let assigned = 0;
  for (let i = 0; i < lengths.length; i++) {
    const len = lengths[i]!;
    const weight = byLength.get(len) ?? 0;
    const qty =
      i === lengths.length - 1
        ? pairs - assigned
        : Math.max(0, Math.round((pairs * weight) / drawerSlots));
    if (qty > 0) out.push({ lengthMm: len, qty });
    assigned += qty;
  }
  if (assigned < pairs) {
    const last = out[out.length - 1];
    if (last) last.qty += pairs - assigned;
    else out.push({ lengthMm: 450, qty: pairs - assigned });
  }
  return out.filter((r) => r.qty > 0);
}

export type NormalizeFerragensTotaisInput = {
  ferragens: FerragensTotaisArmazemRow[];
  cutlistItems: Array<
    Pick<CutListItemComPreco, "tipo" | "dimensoes" | "quantidade" | "drillHoles" | "boxId">
  >;
  boxes: BoxModule[];
  rules?: RulesConfig;
  /** Orla automatica industrial (metros / PDF). */
  ferragemOrla?: ProjectFerragemOrla | null;
  orlaPresets?: OrlaPreset[];
  projectMaterialId?: string;
  remates?: RematePiece[];
  workspaceBoxes?: WorkspaceBox[];
};

function isPlaceholderDash(value: string): boolean {
  const v = String(value ?? "").trim();
  return v === "" || v === EM_DASH || v === "-" || v === "?" || v === "\uFFFD";
}

function isDoorPanelTipo(tipo: string): boolean {
  const t = String(tipo ?? "").trim().toLowerCase();
  if (isIndustrialDoorPanelTipo(t)) return true;
  return t === "porta" || t.startsWith("porta_");
}

function countCupsOnPanel(holes: PanelDrillHole[] | undefined): number {
  if (!holes?.length) return 0;
  return holes.filter((h) => h.holeType === "dobradica").length;
}

/**
 * Contagem oficial de dobradiças para PDF/online (apresentacao).
 * Fonte: canecos ?35 (holeType === "dobradica") nas pecas porta do cutlist.
 * Fallback: getNumDobradicas(alturaMm, rules) por folha.
 * Ignora gerarFerragens / ComponentTypes (nao usar como fonte).
 */
export function countDobradicasForPdf(
  cutlistItems: Array<
    Pick<CutListItemComPreco, "tipo" | "dimensoes" | "quantidade" | "drillHoles">
  >,
  boxes: BoxModule[],
  rules?: RulesConfig
): number {
  let total = 0;
  let doorPanelsSeen = 0;

  for (const item of cutlistItems ?? []) {
    if (!isDoorPanelTipo(String(item.tipo ?? ""))) continue;
    const pieceQty = Math.max(1, Math.floor(Number(item.quantidade) || 1));
    doorPanelsSeen += pieceQty;
    const cups = countCupsOnPanel(item.drillHoles);
    if (cups > 0) {
      total += cups * pieceQty;
      continue;
    }
    if (rules) {
      const alturaMm =
        Number(item.dimensoes?.altura) || Number(item.dimensoes?.largura) || 0;
      total += getNumDobradicas(alturaMm, rules) * pieceQty;
    }
  }

  if (doorPanelsSeen > 0 || total > 0) return total;

  // Sem pecas porta na cutlist: fallback pelas caixas / doorsLayer.
  if (!rules) return 0;
  for (const box of boxes ?? []) {
    const layer = box.doorsLayer ?? [];
    if (layer.length > 0) {
      for (const door of layer) {
        total += getNumDobradicas(Math.max(0, Number(door.height) || 0), rules);
      }
      continue;
    }
    if (box.portaTipo && box.portaTipo !== "sem_porta") {
      const alturaMm = Number(box.dimensoes?.altura) || 0;
      const perLeaf = getNumDobradicas(alturaMm, rules);
      total += box.portaTipo === "porta_dupla" ? perLeaf * 2 : perLeaf;
    }
  }
  return total;
}

/** Quantidade de canecos por caixa (para detalhe online). */
export function countDobradicasPorCaixaForPdf(
  cutlistItems: Array<
    Pick<CutListItemComPreco, "tipo" | "dimensoes" | "quantidade" | "drillHoles" | "boxId">
  >,
  boxes: BoxModule[],
  rules?: RulesConfig
): Array<{ caixa: string; quantidade: number }> {
  const byBox = new Map<string, number>();
  const boxNome = (id: string) => {
    const b = boxes.find((x) => x.id === id);
    return b?.nome?.trim() || id || EM_DASH;
  };

  let anyDoor = false;
  for (const item of cutlistItems ?? []) {
    if (!isDoorPanelTipo(String(item.tipo ?? ""))) continue;
    anyDoor = true;
    const pieceQty = Math.max(1, Math.floor(Number(item.quantidade) || 1));
    const cups = countCupsOnPanel(item.drillHoles);
    const n =
      cups > 0
        ? cups * pieceQty
        : rules
          ? getNumDobradicas(
              Number(item.dimensoes?.altura) || Number(item.dimensoes?.largura) || 0,
              rules
            ) * pieceQty
          : 0;
    if (n <= 0) continue;
    const id = String(item.boxId ?? "");
    byBox.set(id, (byBox.get(id) ?? 0) + n);
  }

  if (!anyDoor && rules) {
    for (const box of boxes ?? []) {
      const layer = box.doorsLayer ?? [];
      let n = 0;
      if (layer.length > 0) {
        n = layer.reduce(
          (s, d) => s + getNumDobradicas(Math.max(0, Number(d.height) || 0), rules),
          0
        );
      } else if (box.portaTipo && box.portaTipo !== "sem_porta") {
        const perLeaf = getNumDobradicas(Number(box.dimensoes?.altura) || 0, rules);
        n = box.portaTipo === "porta_dupla" ? perLeaf * 2 : perLeaf;
      }
      if (n > 0) byBox.set(box.id, n);
    }
  }

  return [...byBox.entries()]
    .filter(([, q]) => q > 0)
    .map(([id, quantidade]) => ({ caixa: boxNome(id), quantidade }))
    .sort((a, b) => a.caixa.localeCompare(b.caixa, "pt"));
}

/**
 * Aplica regras de nomenclatura/quantidade exclusivas do PDF ferragens_totais.
 */
export function normalizeFerragensTotaisForPdf(
  input: NormalizeFerragensTotaisInput
): FerragensTotaisArmazemRow[] {
  let cavilhaQty = 0;
  let corredicaPieces = 0;
  let suporteQty = 0;
  const others = new Map<string, FerragensTotaisArmazemRow>();

  for (const row of input.ferragens) {
    const bucket = classifyFerragem(row.material, row.ref);
    const qty = Math.max(0, Math.floor(Number(row.quantidade) || 0));
    if (qty <= 0) continue;

    switch (bucket) {
      case "parafuso_puxador":
      case "prego_costa":
      case "pe":
        // Pes: recalculados a partir das caixas (fonte oficial).
        break;
      case "parafuso_3x30":
        // Freeagem: recalculado (pés × 4 + costa); ignorar industrial.
        break;
      case "parafuso_4x35":
      case "parafuso_5x50":
      case "puxa_8mm":
        // Freeagem: recalculado a nível de projeto; ignorar industrial.
        break;
      case "dobradica":
        // Ignorar industrial (gerarFerragens + ComponentTypes). Fonte = canecos reais.
        break;
      case "calco":
        // Calcos: recalculados (Ref 00/03). Ignorar industrial.
        break;
      case "cavilha":
        cavilhaQty += qty;
        break;
      case "corredica":
        corredicaPieces += qty;
        break;
      case "suporte":
        suporteQty += qty;
        break;
      default: {
        const key = `${normalizeKey(row.material)}||${normalizeKey(row.ref)}||${normalizeKey(row.medida)}`;
        const prev = others.get(key);
        if (prev) prev.quantidade += qty;
        else {
          others.set(key, {
            material: row.material,
            ref: isPlaceholderDash(row.ref) ? "" : row.ref,
            medida: isPlaceholderDash(row.medida) ? "" : row.medida,
            quantidade: qty,
            preco: row.preco,
          });
        }
        break;
      }
    }
  }

  const result: FerragensTotaisArmazemRow[] = [];

  if (cavilhaQty > 0) {
    result.push({
      material: "Cavilha 10mm",
      ref: "",
      medida: "10mm",
      quantidade: cavilhaQty,
    });
  }

  const pairs = Math.floor(corredicaPieces / 2);
  for (const row of distributeCorredicaPairsByLength(pairs, input.boxes ?? [])) {
    result.push({
      material: CORREDICA_LABEL,
      ref: "",
      medida: `${row.lengthMm}mm`,
      quantidade: row.qty,
    });
  }

  const dobradicaQty = countDobradicasForPdf(input.cutlistItems ?? [], input.boxes ?? [], input.rules);
  if (dobradicaQty > 0) {
    result.push({
      material: DOBRADICA_LABEL,
      ref: DOBRADICA_REF,
      medida: "35mm",
      quantidade: dobradicaQty,
    });
  }

  for (const calco of aggregateCalcoRowsForPdf(dobradicaQty, input.boxes ?? [], loadCalcoConfig())) {
    result.push({
      material: calco.material,
      ref: calco.ref,
      medida: calco.medida,
      quantidade: calco.quantidade,
      preco: calco.precoUnitario,
    });
  }

  const peCfg = loadPesPlasticoConfig();
  const peParafRows = aggregateParafuso3x30FromBoxes(input.boxes ?? [], input.rules, peCfg);
  const peParafQty = peParafRows.reduce((s, r) => s + r.quantidade, 0);
  const parafusosCosta = countParafusosCosta3x30(input.cutlistItems ?? []);
  const parafuso3x30Qty = peParafQty + parafusosCosta;
  if (parafuso3x30Qty > 0) {
    result.push({
      material: PARAFUSO_3X30_NOME,
      ref: PARAFUSO_3X30_ID,
      medida: PARAFUSO_3X30_MEDIDA,
      quantidade: parafuso3x30Qty,
      preco: PARAFUSO_3X30_PRECO,
    });
  }

  if (suporteQty > 0) {
    result.push({
      material: "Suporte de Prateleira",
      ref: "",
      medida: "",
      quantidade: suporteQty,
    });
  }

  for (const pe of aggregatePesPlasticoFromBoxes(input.boxes ?? [], input.rules, peCfg)) {
    result.push({
      material: pe.material,
      ref: pe.ref,
      medida: pe.medida,
      quantidade: pe.quantidade,
      preco: pe.precoUnitario,
    });
  }

  for (const row of aggregateParafuso4x35FromProject(
    input.boxes ?? [],
    input.remates,
    input.workspaceBoxes
  )) {
    result.push({
      material: row.material,
      ref: row.ref,
      medida: row.medida,
      quantidade: row.quantidade,
      preco: row.precoUnitario,
    });
  }
  for (const row of aggregateParafuso5x50FromBoxes(input.boxes ?? [])) {
    result.push({
      material: row.material,
      ref: row.ref,
      medida: row.medida,
      quantidade: row.quantidade,
      preco: row.precoUnitario,
    });
  }
  for (const row of aggregatePuxa8mmFromBoxes(input.boxes ?? [])) {
    result.push({
      material: row.material,
      ref: row.ref,
      medida: row.medida,
      quantidade: row.quantidade,
      preco: row.precoUnitario,
    });
  }

  for (const row of others.values()) {
    result.push(row);
  }

  const orlaPresets = normalizeOrlaPresets(input.orlaPresets);
  // Sempre recalcular orla com regras industriais actuais (costa/prateleira/duplas).
  let ferragemOrla = input.ferragemOrla;
  if ((input.boxes?.length ?? 0) > 0) {
    const defaultOrlaId = orlaPresets[0]?.id ?? null;
    const extrasByBoxId: Record<string, CutListItem[]> = {};
    for (const item of input.cutlistItems ?? []) {
      const bid = String(item.boxId ?? "");
      if (!bid) continue;
      (extrasByBoxId[bid] ??= []).push(item as CutListItem);
    }
    const boxesForOrla = (input.boxes ?? []).map((box) => {
      const fromCutlist = (input.cutlistItems ?? []).filter((i) => i.boxId === box.id) as CutListItem[];
      if ((box.cutList?.length ?? 0) > 0) return box;
      return { ...box, cutList: fromCutlist };
    });
    const orlaPieces = syncOrlaPiecesForProject(
      boxesForOrla,
      {},
      defaultOrlaId,
      extrasByBoxId,
      orlaPresets
    );
    ferragemOrla = computeOrlaFerragem({
      boxes: boxesForOrla,
      orlaPresets,
      orlaPieces,
      orlaJuntoPairs: [],
      extraCutListItems: (input.cutlistItems ?? []) as Array<
        CutListItem & { boxId?: string; boxNome?: string }
      >,
    });
  }

  const orlaRows = aggregateOrlaRowsForFerragensTotaisPdf(
    ferragemOrla,
    orlaPresets,
    input.boxes ?? [],
    input.projectMaterialId
  );
  for (const row of orlaRows) {
    result.push(row);
  }

  return sortFerragensTotaisRows(result);
}

/** Ordem de apresentacao: Dobradica seguida imediatamente dos Calcos; Orla no fim. */
function sortFerragensTotaisRows(rows: FerragensTotaisArmazemRow[]): FerragensTotaisArmazemRow[] {
  const priority = (r: FerragensTotaisArmazemRow): number => {
    const m = normalizeKey(r.material);
    if (m.startsWith("cavilha")) return 10;
    if (m.startsWith("corredica")) return 20;
    if (m.startsWith("dobradica")) return 30;
    if (m === normalizeKey(CALCO_MATERIAL) || m.startsWith("calco")) {
      if (r.ref === "00") return 31;
      if (r.ref === "03") return 32;
      return 33;
    }
    if (m.startsWith("parafuso")) return 40;
    if (m.startsWith("suporte")) return 50;
    if (m === normalizeKey(PE_PLASTICO_NOME) || m.startsWith("pe")) return 60;
    // Orla industrial: medida "12.34 m"
    if (/^\d+([.,]\d+)?\s*m$/i.test(String(r.medida ?? "").trim())) return 70;
    return 100;
  };
  return [...rows].sort((a, b) => {
    const d = priority(a) - priority(b);
    if (d !== 0) return d;
    return a.material.localeCompare(b.material, "pt") || a.ref.localeCompare(b.ref, "pt");
  });
}
