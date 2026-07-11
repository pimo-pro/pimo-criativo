/**
 * SSOT runtime — highlight/outline de peças e furos no viewer 3D (Fase 4).
 * Fluxo único: peça → contorno | furo → realce face-aware | SEP/DIV → ramo dedicado.
 */

import * as THREE from "three";
import type { TechnicalDrillHole, ViewerDrillMarkersByPanel } from "../../../core/types";
import {
  collectPairedHoleLineSegments,
  type DesignPanelMeshRef,
} from "../../../core/industrialDesigner/industrialDesignPairingLines";
import { INDUSTRIAL_DESIGN_PAIRING_LINE_COLOR } from "../../../core/industrialDesigner/drillHoleViewerColors";
import type { IndustrialDesignBox } from "../../../core/industrialDesigner/types";
import {
  resolveDrillHoleViewerColorHex,
  resolvePanelOutlineColorHex,
  resolvePanelOutlineHighlight,
} from "../../../core/industrialDesigner/drillHoleViewerColors";
import {
  assertKnownPieceMesh,
  assertViewerHighlightInvariants,
  findSpuriousSegmentsInGeometry,
  isViewerHighlightInvariantEnabled,
  logViewerHighlightViolations,
} from "./viewerHighlightInvariant";
import {
  createBoxWireframeContourGeometry,
  createHoleCircleGeometry,
  createPanelContourGeometry,
  outlineDimsFromMeshSize,
  type PanelOutlineDims,
  type PanelOutlineKind,
} from "./viewerHighlightGeometry";
import {
  auditMeshHighlightOverlaysIfEnabled,
  stampHoleHighlightOverlay,
  stampPanelContourOverlay,
} from "./viewerHighlightGuard";
import {
  HOLE_HIGHLIGHT_OVERLAY_FLAG,
  PANEL_EDGE_OVERLAY_FLAG,
  PAIRING_OVERLAY_FLAG,
} from "./viewerHighlightConstants";
import { resolveViewerHighlightPieceContext } from "./viewerHighlightPieceKind";

import {
  isKnownPieceMesh,
  resolvePieceHighlightVisible,
  resolveViewerHighlightMode,
  shouldDrawHoleHighlights,
  shouldDrawPairingLines,
  shouldDrawPieceContour,
  type ViewerHighlightFlags,
  type ViewerHighlightMode,
} from "./viewerHighlightPolicy";

export type ViewerHighlightBoxEntry = {
  mesh: THREE.Object3D;
  width: number;
  height: number;
  depth: number;
  carcassDepth?: number;
  drillMarkersByPanel?: ViewerDrillMarkersByPanel;
};

export type ViewerHighlightControllerDeps = {
  getBoxes: () => Map<string, ViewerHighlightBoxEntry>;
  getSharedPanelEdgeMaterial: () => THREE.LineBasicMaterial;
  getIndustrialDesignWorkspaceEnabled?: () => boolean;
  getHighlightFlags: () => ViewerHighlightFlags;
};

const EDGE_OVERLAY_RENDER_OFFSET = 8;

function buildDesignMeshLookup(boxMesh: THREE.Object3D): Map<string, DesignPanelMeshRef> {
  const map = new Map<string, DesignPanelMeshRef>();
  const tmpMatrix = new THREE.Matrix4();
  const invBoxWorld = new THREE.Matrix4();

  boxMesh.updateMatrixWorld(true);
  invBoxWorld.copy(boxMesh.matrixWorld).invert();

  boxMesh.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const panelId = node.userData?.panelId as string | undefined;
    if (!panelId) return;

    const panelType = (node.userData?.panelType as string | undefined) ?? "top";
    const widthM = Number(node.userData?.width) || 0;
    const heightM = Number(node.userData?.height) || 0;
    if (widthM <= 0 || heightM <= 0) return;

    node.updateMatrixWorld(true);
    tmpMatrix.copy(node.matrixWorld).premultiply(invBoxWorld);
    map.set(panelId, {
      panelId,
      panelType,
      widthM,
      heightM,
      matrix: tmpMatrix.toArray(),
    });
  });

  return map;
}

export class ViewerHighlightController {
  private readonly deps: ViewerHighlightControllerDeps;
  private validationEdgeMaterial: THREE.LineBasicMaterial | null = null;
  private selectionEdgeMaterial: THREE.LineBasicMaterial | null = null;
  private readonly holeColorMaterials = new Map<number, THREE.LineBasicMaterial>();
  private readonly pairingMaterial: THREE.LineBasicMaterial;
  private readonly pairingGroups = new Map<string, THREE.Group>();
  private modeOverride: ViewerHighlightMode | undefined;

  constructor(deps: ViewerHighlightControllerDeps) {
    this.deps = deps;
    this.pairingMaterial = new THREE.LineBasicMaterial({
      color: INDUSTRIAL_DESIGN_PAIRING_LINE_COLOR,
      transparent: true,
      opacity: 0.85,
      depthTest: true,
    });
  }

  setHighlightFlags(flags: Partial<ViewerHighlightFlags>): void {
    this.modeOverride = flags.modeOverride;
  }

  private getHighlightMode(): ViewerHighlightMode {
    return resolveViewerHighlightMode({
      ...this.deps.getHighlightFlags(),
      modeOverride: this.modeOverride ?? this.deps.getHighlightFlags().modeOverride,
    });
  }

  /** Ponto de entrada único por mesh de peça. */
  syncPieceHighlights(mesh: THREE.Mesh, pieceVisible: boolean): void {
    this.clearPieceOverlays(mesh);

    const mode = this.getHighlightMode();
    if (mode === "off") return;

    const flags = this.deps.getHighlightFlags();
    const visible = resolvePieceHighlightVisible(pieceVisible, {
      ...flags,
      modeOverride: this.modeOverride ?? flags.modeOverride,
    });
    if (!visible) return;

    const meshId =
      (mesh.userData?.pieceId as string | undefined) ??
      (mesh.userData?.panelId as string | undefined) ??
      mesh.name ??
      mesh.uuid;

    const boxId = mesh.userData?.boxId as string | undefined;
    const entry = boxId ? this.deps.getBoxes().get(boxId) : undefined;
    const pieceContext = resolveViewerHighlightPieceContext(mesh, entry, (m) =>
      this.getMeshBoundingSize(m)
    );

    if (!pieceContext || pieceContext.kind === "unknown") {
      if (isViewerHighlightInvariantEnabled()) {
        logViewerHighlightViolations(assertKnownPieceMesh(meshId, false));
      }
      return;
    }

    const { panelType, holes, dims, boxSize, colorizeHoles } = pieceContext;
    const industrialActive = mode === "industrial-design" || this.isIndustrialDesignActive();

    if (dims) {
      this.applyContourAndHoleOverlays(mesh, visible, panelType, dims, holes, {
        mode,
        colorizeHoles: colorizeHoles && industrialActive,
      });
    } else if (boxSize) {
      this.applyBoxContourAndHoleOverlays(mesh, visible, panelType, boxSize, holes, {
        mode,
        colorizeHoles: colorizeHoles && industrialActive,
      });
    }

    auditMeshHighlightOverlaysIfEnabled(mesh, holes.length);
  }

  /** Sincroniza highlight de todas as peças reconhecidas numa caixa. */
  syncAllPieceHighlightsForObject(root: THREE.Object3D, pieceVisible: boolean): void {
    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      if (!isKnownPieceMesh(node)) return;
      this.syncPieceHighlights(node, pieceVisible);
    });
  }

  syncBoxPairingLines(
    boxId: string,
    boxMesh: THREE.Object3D,
    designBox: IndustrialDesignBox | null,
    enabled: boolean
  ): void {
    this.clearBoxPairingLines(boxId, boxMesh);
    const mode = this.getHighlightMode();
    if (!enabled || !designBox || !shouldDrawPairingLines(mode)) return;

    const meshByPanelId = buildDesignMeshLookup(boxMesh);
    const segments = collectPairedHoleLineSegments(designBox, meshByPanelId);
    if (!segments.length) return;

    const group = new THREE.Group();
    group.userData[PAIRING_OVERLAY_FLAG] = true;

    for (const seg of segments) {
      const positions = new Float32Array([
        seg.from.x,
        seg.from.y,
        seg.from.z,
        seg.to.x,
        seg.to.y,
        seg.to.z,
      ]);
      if (isViewerHighlightInvariantEnabled()) {
        const bad = findSpuriousSegmentsInGeometry(positions, 2);
        if (bad.length > 0) continue;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const line = new THREE.LineSegments(geometry, this.pairingMaterial);
      line.userData[PAIRING_OVERLAY_FLAG] = true;
      line.raycast = () => null;
      line.frustumCulled = false;
      group.add(line);
    }

    if (group.children.length === 0) return;
    boxMesh.add(group);
    this.pairingGroups.set(boxId, group);
  }

  clearBoxPairingLines(boxId: string, boxMesh: THREE.Object3D): void {
    const existing = this.pairingGroups.get(boxId);
    if (existing) {
      boxMesh.remove(existing);
      existing.traverse((child) => {
        if (child instanceof THREE.LineSegments) child.geometry.dispose();
      });
      this.pairingGroups.delete(boxId);
    }

    const orphans = boxMesh.children.filter(
      (c) => c.userData?.[PAIRING_OVERLAY_FLAG] === true
    );
    for (const node of orphans) {
      boxMesh.remove(node);
      node.traverse((child) => {
        if (child instanceof THREE.LineSegments) child.geometry.dispose();
      });
    }
  }

  clearAllPairingLines(): void {
    this.pairingGroups.clear();
  }

  dispose(): void {
    this.validationEdgeMaterial?.dispose();
    this.selectionEdgeMaterial?.dispose();
    this.pairingMaterial.dispose();
    this.holeColorMaterials.forEach((m) => m.dispose());
    this.holeColorMaterials.clear();
    this.validationEdgeMaterial = null;
    this.selectionEdgeMaterial = null;
  }

  private getMeshBoundingSize(mesh: THREE.Mesh): THREE.Vector3 {
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    const size = new THREE.Vector3();
    if (bb) bb.getSize(size);
    return new THREE.Vector3(
      Math.max(0.001, size.x),
      Math.max(0.001, size.y),
      Math.max(0.001, size.z)
    );
  }

  private isIndustrialDesignActive(): boolean {
    return this.deps.getIndustrialDesignWorkspaceEnabled?.() === true;
  }

  private getValidationEdgeMaterial(): THREE.LineBasicMaterial {
    if (!this.validationEdgeMaterial) {
      this.validationEdgeMaterial = new THREE.LineBasicMaterial({
        color: 0xff3344,
        linewidth: 2,
        depthTest: true,
        transparent: false,
      });
    }
    return this.validationEdgeMaterial;
  }

  private getSelectionEdgeMaterial(): THREE.LineBasicMaterial {
    if (!this.selectionEdgeMaterial) {
      this.selectionEdgeMaterial = new THREE.LineBasicMaterial({
        color: 0x3b82f6,
        linewidth: 2,
        depthTest: true,
        transparent: false,
      });
    }
    return this.selectionEdgeMaterial;
  }

  private getHoleColorMaterial(colorHex: number): THREE.LineBasicMaterial {
    const cached = this.holeColorMaterials.get(colorHex);
    if (cached) return cached;
    const material = new THREE.LineBasicMaterial({
      color: colorHex,
      depthTest: true,
      transparent: false,
    });
    this.holeColorMaterials.set(colorHex, material);
    return material;
  }

  private resolveOutlineMaterial(mesh: THREE.Mesh, industrialActive: boolean): THREE.LineBasicMaterial {
    const highlight = resolvePanelOutlineHighlight(
      mesh.userData?.industrialDesignValidationError === true,
      mesh.userData?.industrialDesignSelected === true
    );
    const outlineColor = industrialActive ? resolvePanelOutlineColorHex(highlight) : null;
    if (outlineColor != null) {
      return highlight === "error"
        ? this.getValidationEdgeMaterial()
        : this.getSelectionEdgeMaterial();
    }
    if (mesh.userData?.industrialDesignValidationError === true) {
      return this.getValidationEdgeMaterial();
    }
    return this.deps.getSharedPanelEdgeMaterial();
  }

  private clearPieceOverlays(mesh: THREE.Mesh): void {
    const overlayChildren = mesh.children.filter(
      (child) =>
        child.userData?.[PANEL_EDGE_OVERLAY_FLAG] === true ||
        child.userData?.[HOLE_HIGHLIGHT_OVERLAY_FLAG] === true
    );
    for (const existing of overlayChildren) {
      mesh.remove(existing);
      if (existing instanceof THREE.LineSegments) {
        existing.geometry.dispose();
        const shared = this.deps.getSharedPanelEdgeMaterial();
        if (!Array.isArray(existing.material) && existing.material !== shared) {
          const isHoleMat = [...this.holeColorMaterials.values()].includes(
            existing.material as THREE.LineBasicMaterial
          );
          if (!isHoleMat) existing.material.dispose();
        }
      }
    }
  }

  private finalizePanelEdgeOverlay(
    overlay: THREE.LineSegments,
    mesh: THREE.Mesh,
    visible: boolean,
    kind: "contour" | "hole",
    holeType?: string
  ): void {
    if (kind === "hole") {
      stampHoleHighlightOverlay(overlay, mesh, holeType);
    } else {
      stampPanelContourOverlay(overlay, mesh);
    }
    overlay.raycast = () => null;
    overlay.frustumCulled = false;
    const remateOutlineOrder = mesh.userData?.remateOutlineRenderOrder as number | undefined;
    overlay.renderOrder =
      remateOutlineOrder != null && Number.isFinite(remateOutlineOrder)
        ? remateOutlineOrder
        : (mesh.renderOrder ?? 0) + EDGE_OVERLAY_RENDER_OFFSET;
    mesh.add(overlay);
    overlay.visible = visible;
  }

  private applyContourAndHoleOverlays(
    mesh: THREE.Mesh,
    visible: boolean,
    panelType: PanelOutlineKind,
    dims: PanelOutlineDims,
    holes: TechnicalDrillHole[],
    options?: {
      contourMaterial?: THREE.LineBasicMaterial;
      colorizeHoles?: boolean;
      mode?: ViewerHighlightMode;
    }
  ): void {
    const mode = options?.mode ?? this.getHighlightMode();
    const industrialActive = mode === "industrial-design" || this.isIndustrialDesignActive();
    const colorizeHoles = options?.colorizeHoles ?? industrialActive;
    const contourMaterial =
      options?.contourMaterial ?? this.resolveOutlineMaterial(mesh, industrialActive);

    if (shouldDrawPieceContour(mode)) {
      const contourGeo = createPanelContourGeometry(panelType, dims);
      if (contourGeo) {
        const contourOverlay = new THREE.LineSegments(contourGeo, contourMaterial);
        this.finalizePanelEdgeOverlay(contourOverlay, mesh, visible, "contour");
      }
    }

    if (shouldDrawHoleHighlights(mode, holes.length)) {
      this.applyHoleOverlaysOnly(mesh, visible, panelType, dims, holes, { colorizeHoles });
    }
  }

  private applyBoxContourOnly(
    mesh: THREE.Mesh,
    visible: boolean,
    size: THREE.Vector3,
    mode?: ViewerHighlightMode
  ): void {
    const resolvedMode = mode ?? this.getHighlightMode();
    if (!shouldDrawPieceContour(resolvedMode)) return;

    const contourGeo = createBoxWireframeContourGeometry(size.x, size.y, size.z);
    const overlay = new THREE.LineSegments(
      contourGeo,
      this.resolveOutlineMaterial(mesh, resolvedMode === "industrial-design")
    );
    this.finalizePanelEdgeOverlay(overlay, mesh, visible, "contour");
  }

  private applyBoxContourAndHoleOverlays(
    mesh: THREE.Mesh,
    visible: boolean,
    panelType: PanelOutlineKind,
    size: THREE.Vector3,
    holes: TechnicalDrillHole[],
    options?: { colorizeHoles?: boolean; mode?: ViewerHighlightMode }
  ): void {
    const mode = options?.mode ?? this.getHighlightMode();
    this.applyBoxContourOnly(mesh, visible, size, mode);
    if (!shouldDrawHoleHighlights(mode, holes.length)) return;
    const dims = outlineDimsFromMeshSize(size, panelType);
    this.applyHoleOverlaysOnly(mesh, visible, panelType, dims, holes, options);
  }

  private applyHoleOverlaysOnly(
    mesh: THREE.Mesh,
    visible: boolean,
    panelType: PanelOutlineKind,
    dims: PanelOutlineDims,
    holes: TechnicalDrillHole[],
    options?: { colorizeHoles?: boolean }
  ): void {
    if (!holes.length) return;

    const industrialActive = this.isIndustrialDesignActive();
    const colorizeHoles = options?.colorizeHoles ?? industrialActive;
    const holeOverlays: Array<{
      isIndustrialDesignHoleOverlay?: boolean;
      parentPieceUuid?: string;
    }> = [];
    const holeGeometries: Array<{ positions: Float32Array } | null> = [];

    for (const hole of holes) {
      const holeGeo = createHoleCircleGeometry(panelType, dims, hole);
      if (!holeGeo) {
        holeGeometries.push(null);
        continue;
      }
      const posAttr = holeGeo.getAttribute("position");
      holeGeometries.push(
        posAttr instanceof THREE.BufferAttribute
          ? { positions: posAttr.array as Float32Array }
          : null
      );
      const holeMat = colorizeHoles
        ? this.getHoleColorMaterial(resolveDrillHoleViewerColorHex(hole.tipo))
        : this.deps.getSharedPanelEdgeMaterial();
      const holeOverlay = new THREE.LineSegments(holeGeo, holeMat);
      this.finalizePanelEdgeOverlay(holeOverlay, mesh, visible, "hole", hole.tipo);
      holeOverlays.push({
        isIndustrialDesignHoleOverlay: true,
        parentPieceUuid: mesh.uuid,
      });
    }

    if (isViewerHighlightInvariantEnabled()) {
      const meshId =
        (mesh.userData?.pieceId as string | undefined) ??
        (mesh.userData?.panelId as string | undefined) ??
        mesh.name ??
        mesh.uuid;
      const violations = assertViewerHighlightInvariants(
        meshId,
        mesh.uuid,
        panelType,
        dims,
        holes,
        holeOverlays,
        holeGeometries,
        {
          holesOnlyMode: true,
          maxSpuriousSegmentLengthM: Math.max(dims.width, dims.height, dims.thickness ?? 0) * 0.6,
        }
      );
      logViewerHighlightViolations(violations);
    }
  }
}
