/**
 * Classificação de peças para o pipeline de highlight — extensível para novos tipos.
 */

import type * as THREE from "three";
import type { TechnicalDrillHole, ViewerDrillMarkersByPanel } from "../../../core/types";
import type { PanelOutlineDims, PanelOutlineKind } from "./viewerHighlightGeometry";
import { isKnownPieceMesh } from "./viewerHighlightPolicy";

type PanelType = "left" | "right" | "top" | "bottom" | "back";

export type ViewerHighlightPieceKind =
  | "structural"
  | "sep"
  | "div"
  | "frente-fixa"
  | "door-front"
  | "drawer-shelf-remate"
  | "unknown";

export type ViewerHighlightPieceContext = {
  kind: ViewerHighlightPieceKind;
  panelType: PanelOutlineKind;
  holes: TechnicalDrillHole[];
  dims: PanelOutlineDims | null;
  boxSize: THREE.Vector3 | null;
  colorizeHoles: boolean;
};

export type ViewerHighlightBoxEntryLike = {
  width: number;
  height: number;
  depth: number;
  carcassDepth?: number;
  drillMarkersByPanel?: ViewerDrillMarkersByPanel;
};

const STRUCTURAL_NAMES = new Set(["left", "right", "top", "bottom", "back"]);

function structuralOutlineDims(panelType: PanelType, entry: ViewerHighlightBoxEntryLike): PanelOutlineDims {
  const t = 0.019;
  const carcassDepth = entry.carcassDepth ?? entry.depth;
  if (panelType === "left" || panelType === "right") {
    return { width: carcassDepth, height: entry.height, thickness: t };
  }
  if (panelType === "top" || panelType === "bottom") {
    return { width: entry.width, height: carcassDepth, thickness: t };
  }
  return { width: entry.width, height: entry.height, thickness: t, depth: carcassDepth };
}

function resolveStructuralHoles(
  panelType: PanelType,
  drillMap: ViewerDrillMarkersByPanel | undefined
): TechnicalDrillHole[] {
  if (!drillMap) return [];
  if (panelType === "top") return drillMap.cima ?? [];
  if (panelType === "bottom") return drillMap.fundo ?? [];
  if (panelType === "left") return drillMap.lateral_esquerda ?? [];
  if (panelType === "right") return drillMap.lateral_direita ?? [];
  return [];
}

function resolveSepHoles(
  mesh: THREE.Mesh,
  drillMap: ViewerDrillMarkersByPanel | undefined
): TechnicalDrillHole[] {
  const sepItemId = mesh.userData?.divSepItemId as string | undefined;
  if (!sepItemId || !drillMap?.separadoresById) return [];
  return drillMap.separadoresById[sepItemId] ?? [];
}

/** Resolve contexto de highlight para uma mesh — ponto único de ramificação por tipo de peça. */
export function resolveViewerHighlightPieceContext(
  mesh: THREE.Mesh,
  entry: ViewerHighlightBoxEntryLike | undefined,
  getMeshSize: (mesh: THREE.Mesh) => THREE.Vector3
): ViewerHighlightPieceContext | null {
  if (!isKnownPieceMesh(mesh)) return null;

  const panelType = mesh.userData?.panelType as PanelType | undefined;
  const isStructuralPanel = Boolean(mesh.name && STRUCTURAL_NAMES.has(mesh.name));

  if (
    panelType &&
    isStructuralPanel &&
    entry &&
    Number.isFinite(entry.width) &&
    Number.isFinite(entry.height) &&
    Number.isFinite(entry.depth)
  ) {
    return {
      kind: "structural",
      panelType,
      holes: resolveStructuralHoles(panelType, entry.drillMarkersByPanel),
      dims: structuralOutlineDims(panelType, entry),
      boxSize: null,
      colorizeHoles: true,
    };
  }

  if (mesh.userData?.divSepKind === "sep" && entry) {
    const size = getMeshSize(mesh);
    return {
      kind: "sep",
      panelType: "top",
      holes: resolveSepHoles(mesh, entry.drillMarkersByPanel),
      dims: null,
      boxSize: size,
      colorizeHoles: true,
    };
  }

  if (mesh.userData?.divSepKind === "div") {
    return {
      kind: "div",
      panelType: "top",
      holes: [],
      dims: null,
      boxSize: getMeshSize(mesh),
      colorizeHoles: false,
    };
  }

  if (mesh.name === "frente-fixa" && entry) {
    const size = getMeshSize(mesh);
    return {
      kind: "frente-fixa",
      panelType: "front",
      holes: entry.drillMarkersByPanel?.frente_fixa ?? [],
      dims: {
        width: size.x,
        height: size.y,
        thickness: size.z,
        depth: size.z,
      },
      boxSize: null,
      colorizeHoles: true,
    };
  }

  if (
    (mesh.name && mesh.name.startsWith("door-leaf-")) ||
    mesh.userData?.doorLayerId != null ||
    mesh.userData?.drawerPart === "front"
  ) {
    const size = getMeshSize(mesh);
    const holeData = mesh.userData?.doorHolesEffective;
    const holesRaw = Array.isArray(holeData)
      ? (holeData.filter((h) => h && Number.isFinite(h.x) && Number.isFinite(h.y)) as TechnicalDrillHole[])
      : [];
    return {
      kind: "door-front",
      panelType: "front",
      holes: holesRaw,
      dims: {
        width: size.x,
        height: size.y,
        thickness: size.z,
        depth: size.z,
      },
      boxSize: null,
      colorizeHoles: false,
    };
  }

  if (
    mesh.userData?.drawerPart != null ||
    mesh.userData?.shelfIndex != null ||
    (mesh.name && (mesh.name.startsWith("shelf-") || mesh.name.startsWith("drawer-"))) ||
    mesh.userData?.isRematePiece === true
  ) {
    return {
      kind: "drawer-shelf-remate",
      panelType: "top",
      holes: [],
      dims: null,
      boxSize: getMeshSize(mesh),
      colorizeHoles: false,
    };
  }

  return { kind: "unknown", panelType: "top", holes: [], dims: null, boxSize: null, colorizeHoles: false };
}
