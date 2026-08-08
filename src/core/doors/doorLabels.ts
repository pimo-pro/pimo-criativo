import type { DoorLayerItem } from "../../models/BoxLayers";
import { VERTICAL_STACK_MIN_DELTA_MM } from "./doorLayerGeometry";

export type DoorPositionKind = "dir" | "esq" | "cima" | "baixa";

const UI_LABELS: Record<DoorPositionKind, string> = {
  dir: "Porta Direita",
  esq: "Porta Esquerda",
  cima: "Porta Cima",
  baixa: "Porta Baixa",
};

const INDUSTRIAL_CODES: Record<DoorPositionKind, string> = {
  dir: "port_dir",
  esq: "port_esq",
  cima: "port_cima",
  baixa: "port_baix",
};

const LEGACY_INDEX_FALLBACK: DoorPositionKind[] = ["dir", "esq", "cima", "baixa"];

function fromHingeSide(hingeSide?: DoorLayerItem["hingeSide"]): DoorPositionKind | null {
  if (hingeSide === "right") return "dir";
  if (hingeSide === "left") return "esq";
  if (hingeSide === "top") return "cima";
  if (hingeSide === "bottom") return "baixa";
  return null;
}

function fromOpenDirection(openDirection?: DoorLayerItem["openDirection"]): DoorPositionKind | null {
  if (openDirection === "right") return "dir";
  if (openDirection === "left") return "esq";
  if (openDirection === "up") return "cima";
  if (openDirection === "down") return "baixa";
  return null;
}

/** Portas empilhadas verticalmente (ex.: caixa forno) — prioridade sobre hingeSide lateral. */
function resolveVerticalStackPosition(
  door: DoorLayerItem,
  allDoors: readonly DoorLayerItem[]
): DoorPositionKind | null {
  if (allDoors.length < 2) return null;
  const ys = allDoors.map((d) => Number(d.posY) || 0);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  if (maxY - minY < VERTICAL_STACK_MIN_DELTA_MM) return null;

  const sorted = [...allDoors].sort(
    (a, b) => (Number(a.posY) || 0) - (Number(b.posY) || 0)
  );
  const rank = sorted.findIndex((d) => d.id === door.id);
  if (rank < 0) return null;
  if (sorted.length === 2) {
    return rank === 0 ? "baixa" : "cima";
  }
  if (rank === 0) return "baixa";
  if (rank === sorted.length - 1) return "cima";
  return null;
}

/** Porta parcial superior (Fase B): centro elevado + uma só folha. */
function fromPartialUpperDoor(door: DoorLayerItem): DoorPositionKind | null {
  const posY = Number(door.posY) || 0;
  const h = Number(door.height) || 0;
  if (posY > 40 && h > 0) return "cima";
  return null;
}

export function resolveDoorPositionKind(
  door: DoorLayerItem | null | undefined,
  doorIndex: number,
  allDoors?: readonly DoorLayerItem[]
): DoorPositionKind {
  const siblings = allDoors?.length ? allDoors : door ? [door] : [];

  if (door) {
    const vertical = resolveVerticalStackPosition(door, siblings);
    if (vertical) return vertical;

    const partial = fromPartialUpperDoor(door);
    if (partial && siblings.length === 1) return partial;

    const fromHinge = fromHingeSide(door.hingeSide);
    if (fromHinge) return fromHinge;

    const fromOpen = fromOpenDirection(door.openDirection);
    if (fromOpen) return fromOpen;
  }

  return LEGACY_INDEX_FALLBACK[doorIndex] ?? "dir";
}

/** Nome completo para UI (ex.: Porta Direita). */
export function resolveDoorLabel(
  door: DoorLayerItem | null | undefined,
  doorIndex: number,
  allDoors?: readonly DoorLayerItem[]
): string {
  return UI_LABELS[resolveDoorPositionKind(door, doorIndex, allDoors)];
}

/** Código industrial curto (ex.: port_dir). */
export function resolveDoorIndustrialLabel(
  door: DoorLayerItem | null | undefined,
  doorIndex: number,
  allDoors?: readonly DoorLayerItem[]
): string {
  return INDUSTRIAL_CODES[resolveDoorPositionKind(door, doorIndex, allDoors)];
}
