/**
 * Sistema unificado de observações — caixas e peças.
 * Fonte única para UI, PDFs, etiquetas v5 e viewer.
 *
 * Escrita: `box.observacoes[]` e `project.pieceObservacoes[pieceId][]`.
 * Leitura na pipeline industrial: exclusivamente destes campos (após migração).
 * Não ler nem escrever `piece.notes` (Pimo-Trak / qualidade).
 */

import type { BoxModule, CutListItem, WorkspaceBox } from "../types";
import type { RematePiece } from "../remate/rematePieceTypes";
import type { ProjectRodape } from "../rodape/rodapeTypes";
import { resolveFullIndustrialNameForDocument } from "../etiquetas/industrialDisplayName";
import { resolveRematePieceNomeForRemate } from "../remate/labels";
import type {
  IndustrialPieceCategory,
  IndustrialPieceEntry,
  ObservacoesCollectionContext,
  PieceObservacoesStore,
} from "./observacoesTypes";
import {
  isRemateLIndustrialMetadata,
  isRemateLIndustrialPiece,
  REMATE_L_INDUSTRIAL_OBSERVACAO,
} from "../remate/remateLGeometry";

export const MAX_OBSERVATION_TEXT_LENGTH = 240;
export const MAX_LABEL_OBSERVATIONS_V5 = 3;

/** Chaves legadas em metadata — apenas migração; não usar na pipeline após migrate. */
const LEGACY_META_OBS_KEYS = ["observacoes", "observacao", "obs"] as const;

const HTML_TAG_RE = /<[^>]*>/g;
const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function panelIdFromCutListItem(item: CutListItem): string {
  const meta = item.metadata?.panelId;
  if (typeof meta === "string" && meta.trim().length > 0) return meta.trim();
  return item.id;
}

/**
 * Sanitiza texto de observação:
 * - trim
 * - colapsa whitespace / remove quebras de linha
 * - remove tags HTML
 * - remove caracteres de controlo
 * - limita comprimento
 */
export function sanitizeObservationText(value: string): string {
  let text = value
    .replace(/\r\n/g, " ")
    .replace(/[\r\n\t\v\f]/g, " ")
    .replace(HTML_TAG_RE, "")
    .replace(CONTROL_CHARS_RE, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  if (text.length > MAX_OBSERVATION_TEXT_LENGTH) {
    text = text.slice(0, MAX_OBSERVATION_TEXT_LENGTH);
  }
  return text;
}

/** @deprecated Use sanitizeObservationText — mantido para compatibilidade interna. */
export function normalizeObservationText(value: string): string | null {
  const sanitized = sanitizeObservationText(value);
  return sanitized || null;
}

export function normalizeObservacoesList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    if (typeof values === "string") {
      const one = sanitizeObservationText(values);
      return one ? [one] : [];
    }
    return [];
  }
  const result: string[] = [];
  for (const entry of values) {
    if (typeof entry !== "string") continue;
    const normalized = sanitizeObservationText(entry);
    if (!normalized || result.includes(normalized)) continue;
    result.push(normalized);
  }
  return result;
}

function mergeRemateLFixedObservacoes(
  observations: string[],
  meta?: Record<string, unknown>
): string[] {
  if (!isRemateLIndustrialMetadata(meta)) return observations;
  return normalizeObservacoesList([REMATE_L_INDUSTRIAL_OBSERVACAO, ...observations]);
}

function mergeRemateLFixedObservacoesForEntry(
  observations: string[],
  entry?: Pick<IndustrialPieceEntry, "tipo" | "categoria">
): string[] {
  if (entry?.categoria !== "remate" || entry.tipo !== "L") return observations;
  return normalizeObservacoesList([REMATE_L_INDUSTRIAL_OBSERVACAO, ...observations]);
}

function pushUniqueSanitized(result: string[], value: string): void {
  const normalized = sanitizeObservationText(value);
  if (!normalized) return;
  if (result.includes(normalized)) return;
  result.push(normalized);
}

function pushFromLegacyValue(result: string[], value: unknown): void {
  if (typeof value === "string") {
    pushUniqueSanitized(result, value);
    return;
  }
  if (!Array.isArray(value)) return;
  for (const entry of value) {
    if (typeof entry === "string") pushUniqueSanitized(result, entry);
  }
}

/** Lê observações legadas em metadata (somente migração / compatibilidade de leitura). */
export function migrateLegacyMetadataObservations(
  metadata?: Record<string, unknown>
): string[] {
  if (!metadata) return [];
  const result: string[] = [];
  for (const key of LEGACY_META_OBS_KEYS) {
    pushFromLegacyValue(result, metadata[key]);
  }
  return result;
}

export function getPieceObservacoes(
  pieceId: string,
  store?: PieceObservacoesStore
): string[] {
  if (!pieceId || !store) return [];
  return normalizeObservacoesList(store[pieceId]);
}

export function getBoxObservacoes(box?: Pick<WorkspaceBox | BoxModule, "observacoes">): string[] {
  return normalizeObservacoesList(box?.observacoes);
}

/** Concatena observações para colunas PDF (tecnico, cutlist, unificado). */
export function formatObservacoesForPdf(observations: string[]): string {
  return normalizeObservacoesList(observations).join("; ");
}

/**
 * Resolve observações de peça para a pipeline industrial.
 * Fonte única: `pieceObservacoes` (não inclui box, rules nem metadata legado).
 */
export function resolveObservacoesForPiece(
  pieceId: string,
  context?: Pick<ObservacoesCollectionContext, "pieceObservacoes">
): string[] {
  return getPieceObservacoes(pieceId, context?.pieceObservacoes);
}

export function resolveObservacoesForCutListItem(
  item: CutListItem,
  context?: Pick<ObservacoesCollectionContext, "pieceObservacoes">
): string[] {
  const pieceId = panelIdFromCutListItem(item);
  const userObs = resolveObservacoesForPiece(pieceId, context);
  return mergeRemateLFixedObservacoes(userObs, item.metadata);
}

/** Etiqueta v5 — máx. 3 slots. */
export function observationsToV5Slots(observations: string[]): [string, string, string] {
  const normalized = normalizeObservacoesList(observations).slice(0, MAX_LABEL_OBSERVATIONS_V5);
  return [normalized[0] ?? "", normalized[1] ?? "", normalized[2] ?? ""];
}

export type LabelObservationItemLike = {
  metadata?: Record<string, unknown>;
  id?: string;
};

/** Recolha para etiquetas v5 — pieceObservacoes, ou overlay documental (Fase 5). */
export function collectObservationsForItem(
  item: LabelObservationItemLike,
  /** @deprecated Ignorado — legado removido da pipeline. */
  _legacyRules?: unknown,
  pieceObservacoes?: PieceObservacoesStore
): string[] {
  const documentary = item.metadata?.documentaryObservacoes;
  if (Array.isArray(documentary)) {
    return normalizeObservacoesList(documentary).slice(0, MAX_LABEL_OBSERVATIONS_V5);
  }
  if (typeof documentary === "string") {
    return normalizeObservacoesList([documentary]).slice(0, MAX_LABEL_OBSERVATIONS_V5);
  }

  const pieceId =
    typeof item.metadata?.panelId === "string" && item.metadata.panelId.trim()
      ? item.metadata.panelId.trim()
      : typeof item.id === "string"
        ? item.id
        : "";
  return mergeRemateLFixedObservacoes(
    resolveObservacoesForPiece(pieceId, { pieceObservacoes }),
    item.metadata
  ).slice(0, MAX_LABEL_OBSERVATIONS_V5);
}

function inferCategoryFromTipo(tipo: string): IndustrialPieceCategory {
  const t = tipo.toLowerCase();
  if (t.includes("porta")) return "porta";
  if (t.includes("gaveta")) return "gaveta";
  if (t.includes("remate")) return "remate";
  if (t.includes("rodape") || t.includes("roda")) return "rodape";
  if (t === "divisor" || t.includes("div")) return "div";
  if (t.includes("sep")) return "sep";
  return "painel";
}

type EnumerateBoxPiecesInput = {
  box: BoxModule;
  boxNome: string;
  projectName: string;
  remates?: RematePiece[];
  rodapes?: ProjectRodape[];
};

/** Lista industrial de peças do box para UI (Opções do Box). */
export function enumerateIndustrialPiecesForBox(input: EnumerateBoxPiecesInput): IndustrialPieceEntry[] {
  const { box, boxNome, projectName, remates = [], rodapes = [] } = input;
  const seen = new Set<string>();
  const entries: IndustrialPieceEntry[] = [];

  const pushEntry = (entry: IndustrialPieceEntry) => {
    if (!entry.pieceId || seen.has(entry.pieceId)) return;
    seen.add(entry.pieceId);
    entries.push(entry);
  };

  for (const item of box.cutList ?? []) {
    const pieceId = panelIdFromCutListItem(item);
    const industrialRef = resolveFullIndustrialNameForDocument(item, projectName, boxNome);
    pushEntry({
      pieceId,
      nome: item.nome,
      tipo: item.tipo,
      categoria: inferCategoryFromTipo(item.tipo),
      industrialRef,
    });
  }

  const remateBoxNameById: Record<string, string> = { [box.id]: boxNome };
  for (const remate of remates.filter((r) => r.parentBoxId === box.id)) {
    pushEntry({
      pieceId: remate.id,
      nome: resolveRematePieceNomeForRemate(remate, remateBoxNameById),
      tipo: remate.tipo,
      categoria: remate.tipo === "RODAPE" || remate.tipo === "RODAPE_L" ? "rodape" : "remate",
      industrialRef: remate.nomePersonalizado ?? remate.tipo,
    });
  }

  for (const rodape of rodapes.filter((r) => r.parentBoxId === box.id)) {
    pushEntry({
      pieceId: rodape.id,
      nome:
        rodape.kind === "L" || rodape.kind === "U"
          ? `Roda pé ${rodape.kind}${rodape.partIndex ?? ""}`
          : rodape.kind === "FULL"
            ? "Roda pé Full Wall"
            : "Roda pé",
      tipo: "RODAPE",
      categoria: "rodape",
      industrialRef: rodape.id,
    });
  }

  return entries.sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
}

/** Funde vários stores (ex.: fabricação multi-projeto) sem duplicar entradas. */
export function mergePieceObservacoesStores(
  ...stores: Array<PieceObservacoesStore | undefined>
): PieceObservacoesStore {
  const merged: PieceObservacoesStore = {};
  for (const store of stores) {
    if (!store) continue;
    for (const [pieceId, values] of Object.entries(store)) {
      if (!pieceId) continue;
      const existing = normalizeObservacoesList(merged[pieceId]);
      const next = normalizeObservacoesList([...existing, ...normalizeObservacoesList(values)]);
      if (next.length > 0) merged[pieceId] = next;
    }
  }
  return merged;
}

type MigrateProjectInput = {
  store: PieceObservacoesStore;
  boxes: BoxModule[];
};

/**
 * Migra metadata legado para `pieceObservacoes` sem sobrescrever entradas existentes.
 * Só adiciona observações que ainda não existem no store.
 */
export function migrateProjectPieceObservacoes(
  store: PieceObservacoesStore,
  boxes: BoxModule[]
): PieceObservacoesStore {
  return migrateProjectPieceObservacoesFull({ store, boxes });
}

function migrateProjectPieceObservacoesFull(input: MigrateProjectInput): PieceObservacoesStore {
  const { store, boxes } = input;
  const next = { ...store };
  let changed = false;

  const mergeLegacy = (pieceId: string, legacy: string[]) => {
    if (!pieceId || legacy.length === 0) return;
    const existing = normalizeObservacoesList(next[pieceId]);
    const onlyNew = legacy.filter((o) => !existing.includes(o));
    if (onlyNew.length === 0) return;
    const merged = normalizeObservacoesList([...existing, ...onlyNew]);
    next[pieceId] = merged;
    changed = true;
  };

  for (const box of boxes) {
    for (const item of box.cutList ?? []) {
      const pieceId = panelIdFromCutListItem(item);
      mergeLegacy(pieceId, migrateLegacyMetadataObservations(item.metadata));
    }
  }

  return changed ? next : store;
}

export function resolveObservacoesForIndustrialEntry(
  entry: IndustrialPieceEntry,
  store?: PieceObservacoesStore
): string[] {
  const userObs = getPieceObservacoes(entry.pieceId, store);
  return mergeRemateLFixedObservacoesForEntry(userObs, entry);
}

export function resolveObservacoesForRematePiece(
  remate: Pick<RematePiece, "id" | "productType" | "tipo">,
  store?: PieceObservacoesStore
): string[] {
  const userObs = getPieceObservacoes(remate.id, store);
  if (!isRemateLIndustrialPiece(remate)) return userObs;
  return normalizeObservacoesList([REMATE_L_INDUSTRIAL_OBSERVACAO, ...userObs]);
}

export function hasObservacoes(pieceId: string, store?: PieceObservacoesStore): boolean {
  return getPieceObservacoes(pieceId, store).length > 0;
}

export function hasObservacoesForIndustrialEntry(
  entry: IndustrialPieceEntry,
  store?: PieceObservacoesStore
): boolean {
  return resolveObservacoesForIndustrialEntry(entry, store).length > 0;
}
