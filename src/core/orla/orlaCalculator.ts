import type { BoxModule, CutListItem } from "../types";
import type {
  OrlaFerragemLine,
  OrlaJuntoPair,
  OrlaPreset,
  OrlaSideId,
  PieceOrlaConfig,
  ProjectFerragemOrla,
} from "./orlaTypes";
import { EMPTY_ORLA_SIDES, ORLA_SIDES } from "./orlaTypes";
import { findOrlaPreset } from "./orlaPresets";
import { getOrlaEdgeLengthsMm } from "./orlaEdgeLengths";
import {
  buildPieceOrlaConfigForTipo,
  formatOrlaRefForPdf,
  isCostaPieceTipo,
  pieceAllowsOrlaByThickness,
  resolveOrlaSidesForPieceTipo,
  stripMaterialThicknessLabel,
} from "./orlaIndustrialRules";
import {
  resolveOrlaPresetIdForPiece,
  resolvePieceOrlaMaterial,
} from "./orlaMaterialResolve";
import type { FerragensTotaisArmazemRow } from "../industrial/industrialBottomSectionData";
import { getMaterialDisplayInfo, getMaterialForBox } from "../materials/service";

type CalcInput = {
  boxes: BoxModule[];
  orlaPresets: OrlaPreset[];
  orlaPieces: Record<string, PieceOrlaConfig>;
  orlaJuntoPairs: OrlaJuntoPair[];
  /** Remates / rodapes e outras pecas fora de box.cutList */
  extraCutListItems?: Array<CutListItem & { boxId?: string; boxNome?: string }>;
};

function edgeKey(pieceId: string, side: OrlaSideId): string {
  return `${pieceId}:${side}`;
}

function panelIdFromCutListItem(item: CutListItem): string {
  const meta = item.metadata?.panelId;
  if (typeof meta === "string" && meta.trim().length > 0) return meta;
  return item.id;
}

export function lookupPieceOrlaConfig(
  pieceKey: string,
  orlaPieces: Record<string, PieceOrlaConfig>
): PieceOrlaConfig | undefined {
  if (orlaPieces[pieceKey]) return orlaPieces[pieceKey];
  return undefined;
}

function isOrlaJuntoPrimaryEdge(
  pair: OrlaJuntoPair,
  pieceId: string,
  side: OrlaSideId
): boolean {
  const ekA = edgeKey(pair.pieceAId, pair.sideA);
  const ekB = edgeKey(pair.pieceBId, pair.sideB);
  const ek = edgeKey(pieceId, side);
  if (ek !== ekA && ek !== ekB) return false;
  return ek === (ekA <= ekB ? ekA : ekB);
}

function collectPiecesForBox(
  box: BoxModule,
  extras: Array<CutListItem & { boxId?: string; boxNome?: string }>
): CutListItem[] {
  const fromBox = box.cutList ?? [];
  const fromExtra = extras.filter((e) => e.boxId === box.id);
  return [...fromBox, ...fromExtra];
}

function pieceEspessuraMm(item: CutListItem): number {
  return (
    Number(item.espessura) ||
    Number((item as { espessura_mm?: number }).espessura_mm) ||
    Number(item.dimensoes?.profundidade) ||
    0
  );
}

export function computeOrlaFerragem(input: CalcInput): ProjectFerragemOrla {
  const { boxes, orlaPresets, orlaPieces, orlaJuntoPairs } = input;
  const extras = input.extraCutListItems ?? [];
  const counted = new Set<string>();
  const linhasMap = new Map<string, OrlaFerragemLine>();
  const porBox: Record<string, { metros: number; custo: number }> = {};

  const addMeters = (
    presetId: string,
    preset: OrlaPreset,
    metros: number,
    ctx: {
      boxId: string;
      boxNome: string;
      pieceId: string;
      pieceNome: string;
      orlaMaterialId: string;
      orlaMaterialLabel: string;
      tipo: "normal" | "orla_junto";
    }
  ) => {
    if (metros <= 0) return;
    const key = `${ctx.tipo}:${presetId}:${ctx.orlaMaterialId}:${ctx.boxId}:${ctx.pieceId}`;
    const existing = linhasMap.get(key);
    const custo = metros * preset.precoPorMetro;
    if (existing) {
      existing.metros += metros;
      existing.custo += custo;
    } else {
      linhasMap.set(key, {
        id: key,
        presetId,
        presetNome: preset.nome,
        metros,
        custo,
        boxId: ctx.boxId,
        boxNome: ctx.boxNome,
        pieceId: ctx.pieceId,
        pieceNome: ctx.pieceNome,
        orlaMaterialId: ctx.orlaMaterialId,
        orlaMaterialLabel: ctx.orlaMaterialLabel,
        tipo: ctx.tipo,
      });
    }
    porBox[ctx.boxId] = porBox[ctx.boxId] ?? { metros: 0, custo: 0 };
    porBox[ctx.boxId].metros += metros;
    porBox[ctx.boxId].custo += custo;
  };

  const processItem = (
    item: CutListItem,
    ctx: { boxId: string; boxNome: string }
  ) => {
    const tipo = item.tipo ?? item.nome ?? "";
    if (isCostaPieceTipo(tipo)) return;
    const esp = pieceEspessuraMm(item);
    if (!pieceAllowsOrlaByThickness(esp)) return;
    const pieceId = panelIdFromCutListItem(item);
    const cfg = lookupPieceOrlaConfig(pieceId, orlaPieces);
    if (!cfg) return;
    const mat =
      cfg.orlaMaterialId && cfg.orlaMaterialLabel
        ? { orlaMaterialId: cfg.orlaMaterialId, orlaMaterialLabel: cfg.orlaMaterialLabel }
        : resolvePieceOrlaMaterial(item);
    const pieceCtx = {
      nome: item.nome,
      hingeSide: typeof (item as { hingeSide?: string }).hingeSide === "string"
        ? (item as { hingeSide?: string }).hingeSide
        : typeof item.metadata?.hingeSide === "string"
          ? String(item.metadata.hingeSide)
          : undefined,
      doorsLayerIndex:
        typeof (item as { doorsLayerIndex?: number }).doorsLayerIndex === "number"
          ? (item as { doorsLayerIndex?: number }).doorsLayerIndex
          : typeof item.metadata?.doorsLayerIndex === "number"
            ? Number(item.metadata.doorsLayerIndex)
            : undefined,
      doorPositionKind:
        typeof item.metadata?.doorPositionKind === "string"
          ? String(item.metadata.doorPositionKind)
          : undefined,
    };
    const allowedSides = new Set(resolveOrlaSidesForPieceTipo(tipo, pieceCtx));
    const edges = getOrlaEdgeLengthsMm(item);
    for (const side of ORLA_SIDES) {
      if (!allowedSides.has(side)) continue;
      const sc = cfg.sides[side];
      if (!sc?.enabled || !sc.presetId) continue;
      const ek = edgeKey(pieceId, side);
      if (counted.has(ek)) continue;
      const juntoPair = orlaJuntoPairs.find(
        (p) =>
          (p.pieceAId === pieceId && p.sideA === side) ||
          (p.pieceBId === pieceId && p.sideB === side)
      );
      if (juntoPair && !isOrlaJuntoPrimaryEdge(juntoPair, pieceId, side)) {
        counted.add(ek);
        continue;
      }
      const preset = findOrlaPreset(orlaPresets, sc.presetId);
      if (!preset) continue;
      const metros = (edges[side] / 1000) * Math.max(1, item.quantidade ?? 1);
      addMeters(sc.presetId, preset, metros, {
        boxId: ctx.boxId,
        boxNome: ctx.boxNome,
        pieceId,
        pieceNome: item.nome,
        orlaMaterialId: mat.orlaMaterialId,
        orlaMaterialLabel: mat.orlaMaterialLabel,
        tipo: juntoPair ? "orla_junto" : "normal",
      });
      counted.add(ek);
    }
  };

  const boxIds = new Set(boxes.map((b) => b.id));
  for (const box of boxes) {
    const boxNome = box.nome || box.id;
    for (const item of collectPiecesForBox(box, extras)) {
      processItem(item, { boxId: box.id, boxNome });
    }
  }
  for (const item of extras) {
    if (item.boxId && boxIds.has(item.boxId)) continue;
    processItem(item, {
      boxId: item.boxId || "_orphan",
      boxNome: item.boxNome || "Remate/Rodape",
    });
  }

  const linhas = Array.from(linhasMap.values());
  const metrosTotal = linhas.reduce((s, l) => s + l.metros, 0);
  const custoTotal = linhas.reduce((s, l) => s + l.custo, 0);
  return { linhas, metrosTotal, custoTotal, porBox };
}

export function resolvePieceOrlaConfig(
  pieceId: string,
  orlaPieces: Record<string, PieceOrlaConfig>,
  boxPresetId: string | null | undefined,
  _presets: OrlaPreset[],
  pieceTipo?: string
): PieceOrlaConfig {
  const existing = lookupPieceOrlaConfig(pieceId, orlaPieces);
  if (existing) return existing;
  if (boxPresetId && pieceTipo) {
    return (
      buildPieceOrlaConfigForTipo(pieceTipo, boxPresetId) ?? { sides: EMPTY_ORLA_SIDES() }
    );
  }
  if (boxPresetId) {
    return {
      sides: {
        front: { presetId: boxPresetId, enabled: true },
        back: { presetId: boxPresetId, enabled: true },
        left: { presetId: boxPresetId, enabled: true },
        right: { presetId: boxPresetId, enabled: true },
      },
    };
  }
  return { sides: EMPTY_ORLA_SIDES() };
}

/**
 * Aplica orla automatica industrial por tipo de peca.
 * Cada peca recebe materia propria + preset matched ao acabamento (fallback = caixa).
 * Costa nunca e incluida. Limpa entradas antigas da caixa quando preset e null.
 */
export function buildOrlaPiecesForBox(
  box: BoxModule,
  presetId: string | null,
  current: Record<string, PieceOrlaConfig>,
  extraItems: CutListItem[] = [],
  orlaPresets: OrlaPreset[] = []
): Record<string, PieceOrlaConfig> {
  const next = { ...current };
  const items = [...(box.cutList ?? []), ...extraItems];
  const panelIds = new Set(items.map((i) => panelIdFromCutListItem(i)));

  if (!presetId) {
    for (const id of panelIds) {
      delete next[id];
    }
    return next;
  }

  for (const item of items) {
    const panelId = panelIdFromCutListItem(item);
    const tipo = item.tipo ?? item.nome ?? "";
    if (isCostaPieceTipo(tipo)) {
      delete next[panelId];
      continue;
    }
    // Tampo / laminado de fábrica — sem orla clássica
    if (
      item.metadata?.laminadoFabrica === true ||
      item.metadata?.productType === "TAMPO_COZINHA"
    ) {
      delete next[panelId];
      continue;
    }
    const esp = pieceEspessuraMm(item);
    const mat = resolvePieceOrlaMaterial(item);
    const piecePresetId = resolveOrlaPresetIdForPiece(
      mat.orlaMaterialLabel,
      esp,
      orlaPresets,
      presetId
    );
    if (!piecePresetId) {
      delete next[panelId];
      continue;
    }
    const cfg = buildPieceOrlaConfigForTipo(tipo, piecePresetId, current[panelId], esp, {
      nome: item.nome,
      hingeSide: typeof (item as { hingeSide?: string }).hingeSide === "string"
        ? (item as { hingeSide?: string }).hingeSide
        : typeof item.metadata?.hingeSide === "string"
          ? String(item.metadata.hingeSide)
          : undefined,
      doorsLayerIndex:
        typeof (item as { doorsLayerIndex?: number }).doorsLayerIndex === "number"
          ? (item as { doorsLayerIndex?: number }).doorsLayerIndex
          : typeof item.metadata?.doorsLayerIndex === "number"
            ? Number(item.metadata.doorsLayerIndex)
            : undefined,
      doorPositionKind:
        typeof item.metadata?.doorPositionKind === "string"
          ? String(item.metadata.doorPositionKind)
          : undefined,
    });
    if (!cfg) {
      delete next[panelId];
      continue;
    }
    next[panelId] = {
      ...cfg,
      orlaMaterialId: mat.orlaMaterialId,
      orlaMaterialLabel: mat.orlaMaterialLabel,
    };
  }
  return next;
}

/** Resolve preset efectivo: null = desligado; undefined/vazio = default Admin. */
export function resolveBoxOrlaPresetId(
  box: { orlaPresetId?: string | null },
  defaultPresetId: string | null
): string | null {
  if (box.orlaPresetId === null) return null;
  const explicit = typeof box.orlaPresetId === "string" ? box.orlaPresetId.trim() : "";
  if (explicit) return explicit;
  return defaultPresetId;
}

/** Reconstroi orlaPieces para todas as caixas (sync apos cutlist). */
export function syncOrlaPiecesForProject(
  boxes: BoxModule[],
  current: Record<string, PieceOrlaConfig>,
  defaultPresetId: string | null,
  extrasByBoxId: Record<string, CutListItem[]> = {},
  orlaPresets: OrlaPreset[] = []
): Record<string, PieceOrlaConfig> {
  let next = { ...current };
  for (const box of boxes) {
    const presetId = resolveBoxOrlaPresetId(box, defaultPresetId);
    next = buildOrlaPiecesForBox(
      box,
      presetId,
      next,
      extrasByBoxId[box.id] ?? [],
      orlaPresets
    );
  }
  return next;
}

export function mergeOrlaIntoCutListItem(
  item: CutListItem,
  cfg: PieceOrlaConfig | undefined
): CutListItem {
  if (!cfg) return item;
  return {
    ...item,
    metadata: {
      ...(item.metadata ?? {}),
      orla: cfg.sides,
      orlaJunto: cfg.orlaJunto,
      orlaMaterialId: cfg.orlaMaterialId ?? undefined,
    },
  };
}

/** Resolve label de material da caixa sem espessura (fallback legado). */
export function resolveOrlaMaterialLabelForBox(
  box: BoxModule | undefined,
  projectMaterialId?: string,
  fallbackLabel?: string
): string {
  let label = fallbackLabel ?? "";
  if (box) {
    const resolved = getMaterialForBox(box, projectMaterialId);
    if (resolved) label = getMaterialDisplayInfo(resolved).label || label;
  } else if (projectMaterialId) {
    label = getMaterialDisplayInfo(projectMaterialId).label || label;
  }
  return stripMaterialThicknessLabel(label) || "Orla";
}

/**
 * Agrega orla por (materia da peca, preset) para o PDF ferragens_totais.
 * Quantidade = metros; Ref = nome + espessura; material = chapa da peca sem espessura.
 */
export function aggregateOrlaRowsForFerragensTotaisPdf(
  ferragemOrla: ProjectFerragemOrla | undefined | null,
  orlaPresets: OrlaPreset[],
  boxes: BoxModule[] = [],
  projectMaterialId?: string,
  fallbackMaterialLabel?: string
): FerragensTotaisArmazemRow[] {
  if (!ferragemOrla?.linhas?.length) return [];
  const boxById = new Map(boxes.map((b) => [b.id, b]));
  const byKey = new Map<
    string,
    { metros: number; preset: OrlaPreset; material: string }
  >();

  for (const linha of ferragemOrla.linhas) {
    const preset = findOrlaPreset(orlaPresets, linha.presetId);
    if (!preset) continue;
    const pieceLabel = stripMaterialThicknessLabel(String(linha.orlaMaterialLabel ?? "").trim());
    const material =
      pieceLabel ||
      resolveOrlaMaterialLabelForBox(
        linha.boxId ? boxById.get(linha.boxId) : undefined,
        projectMaterialId,
        fallbackMaterialLabel
      );
    const key = `${material}||${linha.presetId}`;
    const prev = byKey.get(key);
    if (prev) prev.metros += linha.metros;
    else byKey.set(key, { metros: linha.metros, preset, material });
  }

  const rows: FerragensTotaisArmazemRow[] = [];
  for (const { metros, preset, material } of byKey.values()) {
    if (metros <= 0) continue;
    const qty = Math.round(metros * 100) / 100;
    const refBase =
      stripMaterialThicknessLabel(preset.nome).replace(/\s*[\u00d7xX]\s*$/i, "").trim() ||
      preset.tipo ||
      "Orla";
    rows.push({
      material,
      ref: formatOrlaRefForPdf(refBase, preset.espessuraMm),
      medida: `${qty.toFixed(2)} m`,
      quantidade: qty,
      preco: preset.precoPorMetro,
    });
  }
  return rows.sort(
    (a, b) =>
      a.material.localeCompare(b.material, "pt") || a.ref.localeCompare(b.ref, "pt")
  );
}
