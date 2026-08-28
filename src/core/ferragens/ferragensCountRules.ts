/**
 * Regras de contagem e resolução canónica de ferragens (SSOT industrial).
 */

import { isCornerFixedFrontModel } from "../cornerCabinet/cornerCabinetRules";
import {
  CAVILHA_10x40_FERRAGEM_ID,
  CAVILHA_10x40_FERRAGEM_NOME,
} from "../drill/cavilha10x40Rule";
import { resolveActiveDrawersLayer } from "../drawers/drawerModeloAGate";
import { isIndustrialDoorPanelTipo } from "../doors/industrialDoorPanels";
import type { DrawerLayerItem } from "../../models/BoxLayers";
import type { BoxModule, CutListItemComPreco, PanelDrillHole } from "../types";
import type { Ferragem } from "./ferragens";

export const PARAFUSO_3X30_POR_GAVETA = 3;
export const PARAFUSO_4X50_POR_FRENTE_FIXA = 6;

export const DOBRADICA_W90_ID = "dobradica_w90";
export const DOBRADICA_W90_NOME = "Dobradi\u00e7a W90";
export const DOBRADICA_W90_REF = "W90";

const CAVILHA_CANONICAL_ALIASES = new Set([
  "cavilha_10x40",
  "cavilha_10mm",
  "cavilha10x40",
  "cavilha10mm",
]);

function normalizeFerragemToken(raw: string): string {
  return String(raw ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/-/g, "_");
}

/** ID técnico canónico — todas as variantes de cavilha Ø10 resolvem para `cavilha_10x40`. */
export function resolveCanonicalFerragemId(raw: string): string {
  const token = normalizeFerragemToken(raw);
  if (CAVILHA_CANONICAL_ALIASES.has(token) || token === "cavilha_10x40") {
    return CAVILHA_10x40_FERRAGEM_ID;
  }
  return String(raw ?? "").trim();
}

export function resolveFerragemCommercialName(
  ferragemId: string,
  catalog: Map<string, Ferragem> | Ferragem[]
): string {
  const id = resolveCanonicalFerragemId(ferragemId);
  if (id === CAVILHA_10x40_FERRAGEM_ID) {
    return CAVILHA_10x40_FERRAGEM_NOME;
  }
  if (id === DOBRADICA_W90_ID) {
    return DOBRADICA_W90_NOME;
  }
  const list = catalog instanceof Map ? [...catalog.values()] : catalog;
  const hit =
    (catalog instanceof Map ? catalog.get(id) : undefined) ??
    list.find((f) => f.id === id || normalizeFerragemToken(f.nome) === normalizeFerragemToken(id));
  return hit?.nome ?? id;
}

export function boxHasCornerFixedFront(
  box: Pick<BoxModule, "baseCabinetId" | "portaTipo">
): boolean {
  return isCornerFixedFrontModel(box.baseCabinetId) && box.portaTipo === "porta_simples";
}

export function countDrawersInProject(boxes: BoxModule[]): number {
  return (boxes ?? []).reduce((sum, box) => sum + resolveActiveDrawersLayer(box).length, 0);
}

export function countParafuso3x30PorGavetas(boxes: BoxModule[]): number {
  return countDrawersInProject(boxes) * PARAFUSO_3X30_POR_GAVETA;
}

function isDoorPanelTipo(tipo: string): boolean {
  const t = String(tipo ?? "").trim().toLowerCase();
  if (isIndustrialDoorPanelTipo(t)) return true;
  return t === "porta" || t.startsWith("porta_");
}

function resolveDrawerLayerForCutlistItem(
  item: CutListItemComPreco,
  box: BoxModule | undefined
): DrawerLayerItem | undefined {
  if (!box) return undefined;
  const layer = resolveActiveDrawersLayer(box);
  if (layer.length === 0) return undefined;

  const meta = item.metadata as { drawerIndex?: number } | undefined;
  if (typeof meta?.drawerIndex === "number") {
    const idx = meta.drawerIndex;
    if (idx >= 0 && idx < layer.length) return layer[idx];
  }

  const drawerId = String((item.metadata as { drawerId?: string } | undefined)?.drawerId ?? "");
  if (drawerId) {
    const hit = layer.find((d) => d.id === drawerId);
    if (hit) return hit;
  }

  return undefined;
}

function drawerHasHandle(drawer: DrawerLayerItem | undefined): boolean {
  if (!drawer) return false;
  const ht = drawer.handleType ?? drawer.metadata?.handleType;
  return !!ht && ht !== "Nenhum";
}

function pieceHasPuxadorDrillHoles(holes: PanelDrillHole[] | undefined): boolean {
  return (holes ?? []).some((h) => h.holeType === "puxador");
}

/** Parafuso para puxador — só quando a peça tem puxador real (furo ou handle activo). */
export function pieceTemParafusoPuxador(
  item: CutListItemComPreco,
  box: BoxModule | undefined
): boolean {
  if (pieceHasPuxadorDrillHoles(item.drillHoles)) return true;

  const tipo = String(item.tipo ?? "").trim().toLowerCase();
  if (tipo.startsWith("gaveta_frente")) {
    return drawerHasHandle(resolveDrawerLayerForCutlistItem(item, box));
  }
  if (isDoorPanelTipo(tipo)) {
    return pieceHasPuxadorDrillHoles(item.drillHoles);
  }
  return false;
}

export type FerragemCommercialRow = {
  /** Nome comercial para exibição (nunca ID técnico). */
  material: string;
  quantidade: number;
};

/** Agrega linhas normalizadas pelo nome comercial (UI porTipo). */
export function aggregateFerragensByCommercialName(
  rows: Array<{ material: string; quantidade: number }>
): FerragemCommercialRow[] {
  const byName = new Map<string, number>();
  for (const row of rows) {
    const name = String(row.material ?? "").trim() || "\u2014";
    byName.set(name, (byName.get(name) ?? 0) + Math.max(0, Math.floor(row.quantidade)));
  }
  return [...byName.entries()]
    .map(([material, quantidade]) => ({ material, quantidade }))
    .sort((a, b) => a.material.localeCompare(b.material, "pt"));
}
