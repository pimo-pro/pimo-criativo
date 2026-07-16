import * as THREE from "three";
import type { BoxPanelIds, TechnicalDrillHole, ViewerDrillMarkersByPanel } from "../../../core/types";
import { filterTechnicalDrillHolesForViewerMesh } from "../drill/viewerCncDrillFilter";
import { filterDivisorViewerShelfHoles, resolveDivisorViewerDrillHoles } from "../drill/divSepViewerDrillLookup";
import {
  resolveDrillHoleViewerColorHex,
  resolvePanelOutlineColorHex,
  resolvePanelOutlineHighlight,
} from "../../../core/industrialDesigner/drillHoleViewerColors";

type ViewerBoxLike = {
  mesh: THREE.Object3D;
  width: number;
  height: number;
  depth: number;
  carcassDepth?: number;
  drillMarkersByPanel?: ViewerDrillMarkersByPanel;
};

type PanelType = "left" | "right" | "top" | "bottom" | "back";

/**
 * Contrato de integração do módulo de visibilidade de painéis.
 * Panel Visualization 2.1: contornos consistentes, z-order e suporte a peças finas.
 * Invariantes esperados em userData:
 * - boxId identifica o box dono do mesh.
 * - panelType mapeia para left/right/top/bottom/back quando aplicável.
 * - doorLayerId/drawerLayerId/shelfIndex identificam camadas especiais.
 */
type ViewerPanelVisibilityDeps = {
  getBoxes: () => Map<string, ViewerBoxLike>;
  getHighlightEnabled: () => boolean;
  getBoxIdByMesh: (_mesh: THREE.Object3D) => string | null;
  getSharedPanelEdgeMaterial: () => THREE.LineBasicMaterial;
  getIndustrialDesignWorkspaceEnabled?: () => boolean;
};

export class ViewerPanelVisibility {
  private readonly deps: ViewerPanelVisibilityDeps;
  private panelEdgesVisible = true;
  private hiddenPanels = new Set<string>();
  private hideAllPanels = false;
  private explodedViewEnabled = false;
  private explodedViewIntensity = 0.35;
  private panelRenderingEnabled = false;
  private validationEdgeMaterial: THREE.LineBasicMaterial | null = null;
  private selectionEdgeMaterial: THREE.LineBasicMaterial | null = null;
  private readonly holeColorMaterials = new Map<number, THREE.LineBasicMaterial>();

  private static readonly PANEL_THICKNESS_M = 0.019;
  private static readonly PANEL_BACK_THICKNESS_M = 0.01;
  private static readonly HOLE_CIRCLE_SEGMENTS = 16;
  private static readonly OVERLAY_INSET_M = 0.00015;
  private static readonly FALLBACK_EDGES_ANGLE_DEG = 5;
  /** Peças com espessura ≤ 12 mm (GAV FUNDO 10 mm, prateleiras finas, etc.) */
  private static readonly THIN_PIECE_THRESHOLD_M = 0.012;
  /** Contornos renderizam acima da peça mas abaixo da Orla (renderOrder 10). */
  private static readonly EDGE_OVERLAY_RENDER_OFFSET = 8;

  constructor(deps: ViewerPanelVisibilityDeps) {
    this.deps = deps;
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

  private isIndustrialDesignActive(): boolean {
    return this.deps.getIndustrialDesignWorkspaceEnabled?.() === true;
  }

  setPanelEdgesVisible(visible: boolean): void {
    this.panelEdgesVisible = Boolean(visible);
    this.applyPanelVisibilityForAllBoxes();
  }

  setPanelHidden(panel: PanelType, hidden: boolean): void {
    if (hidden) this.hiddenPanels.add(panel);
    else this.hiddenPanels.delete(panel);
    this.applyPanelVisibilityForAllBoxes();
  }

  setHiddenPanels(keys: string[]): void {
    this.hiddenPanels = new Set((keys ?? []).filter((item) => typeof item === "string" && item.trim().length > 0));
    this.applyPanelVisibilityForAllBoxes();
  }

  getHiddenPanels(): string[] {
    return Array.from(this.hiddenPanels);
  }

  setAllPanelsHidden(hidden: boolean): void {
    this.hideAllPanels = Boolean(hidden);
    this.applyPanelVisibilityForAllBoxes();
  }

  setPanelRenderingEnabled(enabled: boolean): void {
    this.panelRenderingEnabled = Boolean(enabled);
    this.applyPanelVisibilityForAllBoxes();
  }

  getPanelRenderingEnabled(): boolean {
    return this.panelRenderingEnabled;
  }

  setExplodedViewEnabled(enabled: boolean): void {
    this.explodedViewEnabled = Boolean(enabled);
    this.applyExplodedViewForAllBoxes();
  }

  getExplodedViewEnabled(): boolean {
    return this.explodedViewEnabled;
  }

  setExplodedViewIntensity(value: number): void {
    const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
    this.explodedViewIntensity = clamped;
    this.applyExplodedViewForAllBoxes();
  }

  getExplodedViewIntensity(): number {
    return this.explodedViewIntensity;
  }

  /**
   * Precondições:
   * - root deve ser a raiz do box com meshes de painel/porta/gaveta/prateleira.
   * - boxId deve ser estável para manter chaves de visibilidade consistentes.
   */
  applyPanelIdsToBox(
    root: THREE.Object3D,
    boxId: string,
    panelIds?: Partial<BoxPanelIds> | null,
    materialPresetId?: string
  ): void {
    const panelIdByType: Partial<Record<PanelType, string | undefined>> = {
      left: panelIds?.lateral_esquerda,
      right: panelIds?.lateral_direita,
      top: panelIds?.cima,
      bottom: panelIds?.fundo,
      back: panelIds?.costa,
    };

    root.traverse((node) => {
      node.userData.boxId = boxId;
      if (node.layers && typeof node.layers.set === "function") {
        node.layers.set(0);
      }
      if (!(node instanceof THREE.Mesh)) return;
      const panelType = node.userData?.panelType as PanelType | undefined;
      if (panelType) {
        const specificId = panelIdByType[panelType];
        const pieceId = specificId && specificId.trim().length > 0 ? specificId : `${boxId}:${panelType}`;
        node.userData.panelId = pieceId;
        node.userData.pieceId = pieceId;
        node.userData.isPanelMesh = true;
        node.userData.materialPresetId = materialPresetId;
        this.applyPanelDimensionMetadata(node, panelType);
        return;
      }

      const doorLayerId = node.userData?.doorLayerId as string | undefined;
      if (doorLayerId && doorLayerId.trim().length > 0) {
        const pieceId = `door:${doorLayerId}`;
        node.userData.panelId = pieceId;
        node.userData.pieceId = pieceId;
        node.userData.isPanelMesh = true;
        node.userData.materialPresetId = materialPresetId;
        this.applyPanelDimensionMetadata(node, "front");
        return;
      }

      const drawerLayerId = node.userData?.drawerLayerId as string | undefined;
      const drawerPart = node.userData?.drawerPart as string | undefined;
      if (drawerLayerId && drawerLayerId.trim().length > 0) {
        const pieceId = `drawer:${drawerLayerId}:${drawerPart ?? "body"}`;
        node.userData.panelId = pieceId;
        node.userData.pieceId = pieceId;
        node.userData.isPanelMesh = true;
        const drawerFrontMaterialId = node.userData?.drawerFrontMaterialId as string | undefined;
        node.userData.materialPresetId =
          drawerPart === "front" && drawerFrontMaterialId?.trim()
            ? drawerFrontMaterialId.trim()
            : materialPresetId;
        this.applyPanelDimensionMetadata(node, "front");
        return;
      }

      const shelfIndexValue = node.userData?.shelfIndex;
      const shelfIndex = typeof shelfIndexValue === "number"
        ? shelfIndexValue
        : typeof node.name === "string"
          ? Number((node.name.match(/shelf-(\d+)/)?.[1] ?? "NaN"))
          : Number.NaN;
      if (Number.isFinite(shelfIndex)) {
        const indexedId = panelIds?.prateleiras?.[shelfIndex as number];
        const pieceId = indexedId && indexedId.trim().length > 0
          ? indexedId
          : `shelf:${boxId}:${shelfIndex}`;
        node.userData.panelId = pieceId;
        node.userData.pieceId = pieceId;
        node.userData.isPanelMesh = true;
        node.userData.materialPresetId = materialPresetId;
        this.applyPanelDimensionMetadata(node, "top");
      }
    });
  }

  /**
   * Precondições:
   * - root deve ter userData.boxId preenchido (direto ou em ancestrais).
   * - applyPanelIdsToBox deve ter sido aplicado para chaves panelId/panelType coerentes.
   */
  applyPanelVisibilityForObject(root: THREE.Object3D): void {
    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const panelType = node.userData?.panelType as PanelType | undefined;
      const isRemate = node.userData?.isRematePiece === true;
      const isDoorOrDrawerOrShelf =
        (node.name &&
          (node.name.startsWith("door-leaf-") ||
            node.name.startsWith("shelf-") ||
            node.name.startsWith("drawer-"))) ||
        node.userData?.doorLayerId != null ||
        node.userData?.drawerPart != null;
      if (!panelType && !isDoorOrDrawerOrShelf && !isRemate) return;
      const remateId = node.userData?.remateId as string | undefined;
      const panelKey = isRemate
        ? (remateId?.trim() || (node.userData?.pieceId as string | undefined)?.trim() || "")
        : panelType
          ? this.getPanelVisibilityKey(node, panelType)
          : this.getAnyVisibilityKey(node) ?? "";
      const hidden =
        this.hideAllPanels ||
        (panelType != null && this.hiddenPanels.has(panelType)) ||
        (panelKey.length > 0 && this.hiddenPanels.has(panelKey));
      node.visible = !hidden;
      this.applyPieceRenderOrder(node);
      this.ensurePanelEdges(node, (this.panelEdgesVisible || this.panelRenderingEnabled) && !hidden);
      node.children.forEach((child) => {
        if (child.userData?.isPanelEdgeOverlay === true) {
          child.visible = (this.panelEdgesVisible || this.panelRenderingEnabled) && !hidden;
        }
      });
    });
  }

  private applyPanelDimensionMetadata(mesh: THREE.Mesh, panelType: PanelType | "front"): void {
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    if (!bb) return;
    const size = new THREE.Vector3();
    bb.getSize(size);
    const dims =
      panelType === "left" || panelType === "right"
        ? { width: size.z, height: size.y, thickness: size.x }
        : panelType === "top" || panelType === "bottom"
          ? { width: size.x, height: size.z, thickness: size.y }
          : { width: size.x, height: size.y, thickness: size.z };
    mesh.userData.width = dims.width;
    mesh.userData.height = dims.height;
    mesh.userData.thickness = dims.thickness;
  }

  applyPanelVisibilityForAllBoxes(): void {
    this.deps.getBoxes().forEach((entry) => this.applyPanelVisibilityForObject(entry.mesh));
  }

  applyExplodedViewForObject(root: THREE.Object3D): void {
    const offsetDistance = this.explodedViewIntensity * 0.2;
    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      if (!this.isExplodableMesh(node)) return;

      const storedBase = node.userData?.explodedBasePosition as THREE.Vector3 | undefined;
      const basePosition = storedBase instanceof THREE.Vector3 ? storedBase : node.position.clone();
      node.userData.explodedBasePosition = basePosition.clone();

      if (!this.explodedViewEnabled || offsetDistance <= 0) {
        node.position.copy(basePosition);
        return;
      }

      const direction = this.getExplodedDirection(node);
      node.position.copy(basePosition).addScaledVector(direction, offsetDistance);
    });
  }

  applyExplodedViewForAllBoxes(): void {
    this.deps.getBoxes().forEach((entry) => this.applyExplodedViewForObject(entry.mesh));
  }

  private static createContourEdgesGeometry(
    panelType: PanelType | "front",
    width: number,
    height: number,
    depth: number,
    holes: TechnicalDrillHole[]
  ): THREE.BufferGeometry {
    const t = ViewerPanelVisibility.PANEL_THICKNESS_M;
    const bt = ViewerPanelVisibility.PANEL_BACK_THICKNESS_M;
    const sideH = Math.max(0.001, height - 2 * t);
    const segs: number[] = [];

    const pushSegment = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) => {
      segs.push(x1, y1, z1, x2, y2, z2);
    };

    if (panelType === "top") {
      const w2 = width / 2;
      const d2 = depth / 2;
      const y0 = -t / 2 - ViewerPanelVisibility.OVERLAY_INSET_M;
      pushSegment(-w2, y0, -d2, w2, y0, -d2);
      pushSegment(w2, y0, -d2, w2, y0, d2);
      pushSegment(w2, y0, d2, -w2, y0, d2);
      pushSegment(-w2, y0, d2, -w2, y0, -d2);
      const panelW = width;
      const panelH = depth;
      for (const hole of holes) {
        const a = hole.x / 1000 - panelW / 2;
        const b = panelH / 2 - hole.y / 1000;
        const r = Math.max(0.0005, hole.diametro / 2000);
        for (let i = 0; i < ViewerPanelVisibility.HOLE_CIRCLE_SEGMENTS; i += 1) {
          const t0 = (i * 2 * Math.PI) / ViewerPanelVisibility.HOLE_CIRCLE_SEGMENTS;
          const t1 = ((i + 1) * 2 * Math.PI) / ViewerPanelVisibility.HOLE_CIRCLE_SEGMENTS;
          pushSegment(
            a + r * Math.cos(t0), y0, b + r * Math.sin(t0),
            a + r * Math.cos(t1), y0, b + r * Math.sin(t1)
          );
        }
      }
    } else if (panelType === "bottom") {
      const w2 = width / 2;
      const d2 = depth / 2;
      const y0 = t / 2 + ViewerPanelVisibility.OVERLAY_INSET_M;
      pushSegment(-w2, y0, -d2, w2, y0, -d2);
      pushSegment(w2, y0, -d2, w2, y0, d2);
      pushSegment(w2, y0, d2, -w2, y0, d2);
      pushSegment(-w2, y0, d2, -w2, y0, -d2);
      const panelW = width;
      const panelH = depth;
      for (const hole of holes) {
        const a = hole.x / 1000 - panelW / 2;
        const b = panelH / 2 - hole.y / 1000;
        const r = Math.max(0.0005, hole.diametro / 2000);
        for (let i = 0; i < ViewerPanelVisibility.HOLE_CIRCLE_SEGMENTS; i += 1) {
          const t0 = (i * 2 * Math.PI) / ViewerPanelVisibility.HOLE_CIRCLE_SEGMENTS;
          const t1 = ((i + 1) * 2 * Math.PI) / ViewerPanelVisibility.HOLE_CIRCLE_SEGMENTS;
          pushSegment(
            a + r * Math.cos(t0), y0, b + r * Math.sin(t0),
            a + r * Math.cos(t1), y0, b + r * Math.sin(t1)
          );
        }
      }
    } else if (panelType === "left") {
      const sh2 = sideH / 2;
      const d2 = depth / 2;
      const xExterior = -(t / 2 + ViewerPanelVisibility.OVERLAY_INSET_M);
      const xInterior = t / 2 + ViewerPanelVisibility.OVERLAY_INSET_M;
      pushSegment(xExterior, -sh2, -d2, xExterior, sh2, -d2);
      pushSegment(xExterior, sh2, -d2, xExterior, sh2, d2);
      pushSegment(xExterior, sh2, d2, xExterior, -sh2, d2);
      pushSegment(xExterior, -sh2, d2, xExterior, -sh2, -d2);
      const panelW = depth;
      const panelH = sideH;
      for (const hole of holes) {
        const a = hole.x / 1000 - panelW / 2;
        const b = ViewerPanelVisibility.holeLocalB("left", panelH, hole);
        const r = Math.max(0.0005, hole.diametro / 2000);
        for (let i = 0; i < ViewerPanelVisibility.HOLE_CIRCLE_SEGMENTS; i += 1) {
          const t0 = (i * 2 * Math.PI) / ViewerPanelVisibility.HOLE_CIRCLE_SEGMENTS;
          const t1 = ((i + 1) * 2 * Math.PI) / ViewerPanelVisibility.HOLE_CIRCLE_SEGMENTS;
          pushSegment(xInterior, b + r * Math.cos(t0), a + r * Math.sin(t0), xInterior, b + r * Math.cos(t1), a + r * Math.sin(t1));
        }
      }
    } else if (panelType === "right") {
      const sh2 = sideH / 2;
      const d2 = depth / 2;
      const xExterior = t / 2 + ViewerPanelVisibility.OVERLAY_INSET_M;
      const xInterior = -(t / 2 + ViewerPanelVisibility.OVERLAY_INSET_M);
      pushSegment(xExterior, -sh2, -d2, xExterior, sh2, -d2);
      pushSegment(xExterior, sh2, -d2, xExterior, sh2, d2);
      pushSegment(xExterior, sh2, d2, xExterior, -sh2, d2);
      pushSegment(xExterior, -sh2, d2, xExterior, -sh2, -d2);
      const panelW = depth;
      const panelH = sideH;
      for (const hole of holes) {
        const a = hole.x / 1000 - panelW / 2;
        const b = ViewerPanelVisibility.holeLocalB("right", panelH, hole);
        const r = Math.max(0.0005, hole.diametro / 2000);
        for (let i = 0; i < ViewerPanelVisibility.HOLE_CIRCLE_SEGMENTS; i += 1) {
          const t0 = (i * 2 * Math.PI) / ViewerPanelVisibility.HOLE_CIRCLE_SEGMENTS;
          const t1 = ((i + 1) * 2 * Math.PI) / ViewerPanelVisibility.HOLE_CIRCLE_SEGMENTS;
          pushSegment(xInterior, b + r * Math.cos(t0), a + r * Math.sin(t0), xInterior, b + r * Math.cos(t1), a + r * Math.sin(t1));
        }
      }
    } else if (panelType === "front") {
      const w2 = width / 2;
      const h2 = height / 2;
      const zInside = -depth / 2 - ViewerPanelVisibility.OVERLAY_INSET_M;
      const zOutside = depth / 2 + ViewerPanelVisibility.OVERLAY_INSET_M;
      pushSegment(-w2, -h2, zInside, w2, -h2, zInside);
      pushSegment(w2, -h2, zInside, w2, h2, zInside);
      pushSegment(w2, h2, zInside, -w2, h2, zInside);
      pushSegment(-w2, h2, zInside, -w2, -h2, zInside);
      pushSegment(-w2, -h2, zOutside, w2, -h2, zOutside);
      pushSegment(w2, -h2, zOutside, w2, h2, zOutside);
      pushSegment(w2, h2, zOutside, -w2, h2, zOutside);
      pushSegment(-w2, h2, zOutside, -w2, -h2, zOutside);

      const panelW = width;
      const panelH = height;
      for (const hole of holes) {
        const a = hole.x / 1000 - panelW / 2;
        const b = ViewerPanelVisibility.holeLocalB("front", panelH, hole);
        const r = Math.max(0.0005, hole.diametro / 2000);
        for (let i = 0; i < ViewerPanelVisibility.HOLE_CIRCLE_SEGMENTS; i += 1) {
          const t0 = (i * 2 * Math.PI) / ViewerPanelVisibility.HOLE_CIRCLE_SEGMENTS;
          const t1 = ((i + 1) * 2 * Math.PI) / ViewerPanelVisibility.HOLE_CIRCLE_SEGMENTS;
          pushSegment(
            a + r * Math.cos(t0), b + r * Math.sin(t0), zInside,
            a + r * Math.cos(t1), b + r * Math.sin(t1), zInside
          );
        }
      }
    } else {
      const w2 = width / 2;
      const h2 = height / 2;
      const z0 = bt / 2 + ViewerPanelVisibility.OVERLAY_INSET_M;
      pushSegment(-w2, -h2, z0, w2, -h2, z0);
      pushSegment(w2, -h2, z0, w2, h2, z0);
      pushSegment(w2, h2, z0, -w2, h2, z0);
      pushSegment(-w2, h2, z0, -w2, -h2, z0);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(segs), 3));
    geo.computeBoundingSphere();
    return geo;
  }

  private static holeLocalB(
    panelType: PanelType | "front",
    panelH: number,
    hole: TechnicalDrillHole
  ): number {
    const useBottomOriginY =
      hole.tipo === "cavilha" &&
      (panelType === "front" || panelType === "left" || panelType === "right");
    return useBottomOriginY
      ? hole.y / 1000 - panelH / 2
      : panelH / 2 - hole.y / 1000;
  }

  private static createHoleCircleGeometry(
    panelType: PanelType | "front",
    width: number,
    height: number,
    depth: number,
    hole: TechnicalDrillHole
  ): THREE.BufferGeometry | null {
    const t = ViewerPanelVisibility.PANEL_THICKNESS_M;
    const sideH = Math.max(0.001, height - 2 * t);
    const segs: number[] = [];
    const pushSegment = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) => {
      segs.push(x1, y1, z1, x2, y2, z2);
    };

    const panelW = panelType === "left" || panelType === "right" ? depth : width;
    const panelH =
      panelType === "left" || panelType === "right"
        ? sideH
        : panelType === "top" || panelType === "bottom"
          ? depth
          : height;

    const a = hole.x / 1000 - panelW / 2;
    const b = ViewerPanelVisibility.holeLocalB(panelType, panelH, hole);
    const r = Math.max(0.0005, hole.diametro / 2000);

    if (panelType === "top") {
      const y0 = -t / 2 - ViewerPanelVisibility.OVERLAY_INSET_M;
      for (let i = 0; i < ViewerPanelVisibility.HOLE_CIRCLE_SEGMENTS; i += 1) {
        const t0 = (i * 2 * Math.PI) / ViewerPanelVisibility.HOLE_CIRCLE_SEGMENTS;
        const t1 = ((i + 1) * 2 * Math.PI) / ViewerPanelVisibility.HOLE_CIRCLE_SEGMENTS;
        pushSegment(
          a + r * Math.cos(t0), y0, b + r * Math.sin(t0),
          a + r * Math.cos(t1), y0, b + r * Math.sin(t1)
        );
      }
    } else if (panelType === "bottom") {
      const y0 = t / 2 + ViewerPanelVisibility.OVERLAY_INSET_M;
      for (let i = 0; i < ViewerPanelVisibility.HOLE_CIRCLE_SEGMENTS; i += 1) {
        const t0 = (i * 2 * Math.PI) / ViewerPanelVisibility.HOLE_CIRCLE_SEGMENTS;
        const t1 = ((i + 1) * 2 * Math.PI) / ViewerPanelVisibility.HOLE_CIRCLE_SEGMENTS;
        pushSegment(
          a + r * Math.cos(t0), y0, b + r * Math.sin(t0),
          a + r * Math.cos(t1), y0, b + r * Math.sin(t1)
        );
      }
    } else if (panelType === "left" || panelType === "right") {
      const x0 =
        panelType === "left"
          ? t / 2 + ViewerPanelVisibility.OVERLAY_INSET_M
          : -(t / 2 + ViewerPanelVisibility.OVERLAY_INSET_M);
      for (let i = 0; i < ViewerPanelVisibility.HOLE_CIRCLE_SEGMENTS; i += 1) {
        const t0 = (i * 2 * Math.PI) / ViewerPanelVisibility.HOLE_CIRCLE_SEGMENTS;
        const t1 = ((i + 1) * 2 * Math.PI) / ViewerPanelVisibility.HOLE_CIRCLE_SEGMENTS;
        pushSegment(x0, b + r * Math.cos(t0), a + r * Math.sin(t0), x0, b + r * Math.cos(t1), a + r * Math.sin(t1));
      }
    } else if (panelType === "front") {
      const zInside = -depth / 2 - ViewerPanelVisibility.OVERLAY_INSET_M;
      for (let i = 0; i < ViewerPanelVisibility.HOLE_CIRCLE_SEGMENTS; i += 1) {
        const t0 = (i * 2 * Math.PI) / ViewerPanelVisibility.HOLE_CIRCLE_SEGMENTS;
        const t1 = ((i + 1) * 2 * Math.PI) / ViewerPanelVisibility.HOLE_CIRCLE_SEGMENTS;
        pushSegment(
          a + r * Math.cos(t0), b + r * Math.sin(t0), zInside,
          a + r * Math.cos(t1), b + r * Math.sin(t1), zInside
        );
      }
    } else {
      return null;
    }

    if (!segs.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(segs), 3));
    geo.computeBoundingSphere();
    return geo;
  }

  /**
   * Contorno completo de caixa alinhado ao BoxGeometry local (12 arestas).
   * Usado para gavetas, prateleiras finas e remates — dimensões reais do mesh,
   * sem constantes industriais de espessura de caixaria.
   */
  private static createBoxWireframeContourGeometry(
    width: number,
    height: number,
    depth: number
  ): THREE.BufferGeometry {
    const inset = ViewerPanelVisibility.OVERLAY_INSET_M;
    const w2 = Math.max(0.0005, width / 2);
    const h2 = Math.max(0.0005, height / 2);
    const d2 = Math.max(0.0005, depth / 2);
    const segs: number[] = [];
    const push = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) => {
      segs.push(x1, y1, z1, x2, y2, z2);
    };

    const ring = (y: number, xs: number[], zs: number[]) => {
      for (let i = 0; i < 4; i += 1) {
        const j = (i + 1) % 4;
        push(xs[i], y, zs[i], xs[j], y, zs[j]);
      }
    };

    ring(-h2 - inset, [-w2, w2, w2, -w2], [-d2, -d2, d2, d2]);
    ring(h2 + inset, [-w2, w2, w2, -w2], [-d2, -d2, d2, d2]);

    const corners: Array<[number, number]> = [[-w2, -d2], [w2, -d2], [w2, d2], [-w2, d2]];
    for (const [x, z] of corners) {
      push(x, -h2 - inset, z, x, h2 + inset, z);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(segs), 3));
    geo.computeBoundingSphere();
    return geo;
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

  /** Preferir tamanho pré-CSG (authoredSize) para overlays — evita “rays” de bbox degenerada. */
  private getOverlayPanelSize(mesh: THREE.Mesh): THREE.Vector3 {
    const authored = mesh.userData?.authoredSize as [number, number, number] | undefined;
    if (
      Array.isArray(authored) &&
      authored.length === 3 &&
      authored.every((v) => typeof v === "number" && Number.isFinite(v) && v > 0)
    ) {
      return new THREE.Vector3(
        Math.max(0.001, authored[0]),
        Math.max(0.001, authored[1]),
        Math.max(0.001, authored[2])
      );
    }
    return this.getMeshBoundingSize(mesh);
  }

  private static isDivSepDivMesh(mesh: THREE.Mesh): boolean {
    return (
      mesh.userData?.divSepKind === "div" ||
      (typeof mesh.name === "string" && mesh.name.startsWith("divsep-div-"))
    );
  }

  private static resolveDivOverlayPanelType(mesh: THREE.Mesh): "left" | "right" {
    const pt = mesh.userData?.panelType;
    if (pt === "left" || pt === "right") return pt;
    return "left";
  }

  /** Z-order apenas visual — não altera geometria industrial. */
  private applyPieceRenderOrder(mesh: THREE.Mesh): void {
    const size = this.getMeshBoundingSize(mesh);
    const minDim = Math.min(size.x, size.y, size.z);
    const structuralNames = new Set(["left", "right", "top", "bottom", "back"]);
    const isStructural =
      mesh.userData?.panelType != null &&
      typeof mesh.name === "string" &&
      structuralNames.has(mesh.name);

    let order = 1;
    if (isStructural) order = 0;
    else if (mesh.userData?.isRematePiece === true) order = 12;
    else if (minDim <= ViewerPanelVisibility.THIN_PIECE_THRESHOLD_M) order = 5;
    else if (mesh.userData?.doorLayerId != null || mesh.name?.startsWith("door-leaf-")) order = 4;
    else if (mesh.userData?.drawerPart != null || mesh.name?.startsWith("drawer-")) order = 3;
    else if (
      mesh.userData?.shelfIndex != null ||
      (typeof mesh.name === "string" && mesh.name.startsWith("shelf-"))
    ) order = 2;

    mesh.renderOrder = order;
  }

  private finalizePanelEdgeOverlay(
    overlay: THREE.LineSegments,
    mesh: THREE.Mesh,
    visible: boolean
  ): void {
    overlay.userData.isPanelEdgeOverlay = overlay.userData.isIndustrialDesignHoleOverlay !== true;
    if (overlay.userData.isPanelEdgeOverlay) {
      overlay.userData.pieceId =
        mesh.userData.pieceId ?? mesh.userData.panelId ?? mesh.userData.remateId;
      overlay.userData.parentPieceUuid = mesh.uuid;
    }
    overlay.raycast = () => null;
    overlay.frustumCulled = false;
    const remateOutlineOrder = mesh.userData?.remateOutlineRenderOrder as number | undefined;
    overlay.renderOrder =
      remateOutlineOrder != null && Number.isFinite(remateOutlineOrder)
        ? remateOutlineOrder
        : (mesh.renderOrder ?? 0) + ViewerPanelVisibility.EDGE_OVERLAY_RENDER_OFFSET;
    mesh.add(overlay);
    overlay.visible = visible && !this.deps.getHighlightEnabled();
  }

  private ensurePanelEdges(mesh: THREE.Mesh, visible: boolean): void {
    const overlayChildren = mesh.children.filter(
      (child) =>
        child.userData?.isPanelEdgeOverlay === true ||
        child.userData?.isIndustrialDesignHoleOverlay === true
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
          if (!isHoleMat) {
            existing.material.dispose();
          }
        }
      }
    }

    const panelType = mesh.userData?.panelType as PanelType | undefined;
    const boxId = mesh.userData?.boxId as string | undefined;
    const entry = boxId ? this.deps.getBoxes().get(boxId) : undefined;
    const structuralPanelNames = new Set(["left", "right", "top", "bottom", "back"]);
    const isStructuralPanel = mesh.name && structuralPanelNames.has(mesh.name);

    let geometry: THREE.BufferGeometry | null = null;

    if (
      panelType &&
      isStructuralPanel &&
      entry &&
      Number.isFinite(entry.width) &&
      Number.isFinite(entry.height) &&
      Number.isFinite(entry.depth)
    ) {
      const drillMap: ViewerDrillMarkersByPanel | undefined = entry.drillMarkersByPanel;
      const holesRaw =
        panelType === "top"
          ? (drillMap?.cima ?? [])
          : panelType === "bottom"
            ? (drillMap?.fundo ?? [])
            : panelType === "left"
              ? (drillMap?.lateral_esquerda ?? [])
              : panelType === "right"
                ? (drillMap?.lateral_direita ?? [])
                : [];
      const holes = filterTechnicalDrillHolesForViewerMesh(holesRaw);
      const industrialActive = this.isIndustrialDesignActive();
      geometry = ViewerPanelVisibility.createContourEdgesGeometry(
        panelType,
        entry.width,
        entry.height,
        entry.carcassDepth ?? entry.depth,
        industrialActive ? [] : holes
      );

      if (!geometry) return;

      const highlight = resolvePanelOutlineHighlight(
        mesh.userData?.industrialDesignValidationError === true,
        mesh.userData?.industrialDesignSelected === true
      );
      const outlineColor = industrialActive ? resolvePanelOutlineColorHex(highlight) : null;
      const material =
        outlineColor != null
          ? highlight === "error"
            ? this.getValidationEdgeMaterial()
            : this.getSelectionEdgeMaterial()
          : mesh.userData?.industrialDesignValidationError === true
            ? this.getValidationEdgeMaterial()
            : this.deps.getSharedPanelEdgeMaterial();
      const overlay = new THREE.LineSegments(geometry, material);
      this.finalizePanelEdgeOverlay(overlay, mesh, visible);

      if (industrialActive && holes.length > 0) {
        for (const hole of holes) {
          const holeGeo = ViewerPanelVisibility.createHoleCircleGeometry(
            panelType,
            entry.width,
            entry.height,
            entry.carcassDepth ?? entry.depth,
            hole
          );
          if (!holeGeo) continue;
          const holeMat = this.getHoleColorMaterial(resolveDrillHoleViewerColorHex(hole.tipo));
          const holeOverlay = new THREE.LineSegments(holeGeo, holeMat);
          holeOverlay.userData.isIndustrialDesignHoleOverlay = true;
          holeOverlay.userData.holeType = hole.tipo;
          this.finalizePanelEdgeOverlay(holeOverlay, mesh, visible);
        }
      }
      return;
    } else if (mesh.name === "frente-fixa" && entry) {
      const size = this.getMeshBoundingSize(mesh);
      const holes = filterTechnicalDrillHolesForViewerMesh(entry.drillMarkersByPanel?.frente_fixa ?? []);
      const industrialActive = this.isIndustrialDesignActive();
      geometry = ViewerPanelVisibility.createContourEdgesGeometry(
        "front",
        size.x,
        size.y,
        size.z,
        industrialActive ? [] : holes
      );
      if (!geometry) return;
      const overlay = new THREE.LineSegments(geometry, this.deps.getSharedPanelEdgeMaterial());
      this.finalizePanelEdgeOverlay(overlay, mesh, visible);
      if (industrialActive && holes.length > 0) {
        for (const hole of holes) {
          const holeGeo = ViewerPanelVisibility.createHoleCircleGeometry(
            "front",
            size.x,
            size.y,
            size.z,
            hole
          );
          if (!holeGeo) continue;
          const holeMat = this.getHoleColorMaterial(resolveDrillHoleViewerColorHex(hole.tipo));
          const holeOverlay = new THREE.LineSegments(holeGeo, holeMat);
          holeOverlay.userData.isIndustrialDesignHoleOverlay = true;
          holeOverlay.userData.holeType = hole.tipo;
          this.finalizePanelEdgeOverlay(holeOverlay, mesh, visible);
        }
      }
      return;
    } else if (
      (mesh.name && mesh.name.startsWith("door-leaf-")) ||
      mesh.userData?.doorLayerId != null ||
      mesh.userData?.drawerPart === "front"
    ) {
      const size = this.getMeshBoundingSize(mesh);
      const holeData = mesh.userData?.doorHolesEffective;
      const holesRaw = Array.isArray(holeData)
        ? (holeData.filter((h) => h && Number.isFinite(h.x) && Number.isFinite(h.y)) as TechnicalDrillHole[])
        : [];
      const holes = filterTechnicalDrillHolesForViewerMesh(holesRaw);
      geometry = ViewerPanelVisibility.createContourEdgesGeometry(
        "front",
        size.x,
        size.y,
        size.z,
        holes
      );
    } else if (ViewerPanelVisibility.isDivSepDivMesh(mesh)) {
      // DIV: malha sólida (sem CSG). Contorno + círculos de prateleira — nunca EdgesGeometry.
      const size = this.getOverlayPanelSize(mesh);
      const t = ViewerPanelVisibility.PANEL_THICKNESS_M;
      const divPanelType = ViewerPanelVisibility.resolveDivOverlayPanelType(mesh);
      const resolvedBoxId =
        typeof boxId === "string" && boxId.trim().length > 0 ? boxId : this.deps.getBoxIdByMesh(mesh);
      const divEntry = resolvedBoxId ? this.deps.getBoxes().get(resolvedBoxId) : entry;
      const divItemId =
        typeof mesh.userData?.divSepItemId === "string" && mesh.userData.divSepItemId.trim().length > 0
          ? mesh.userData.divSepItemId
          : typeof mesh.name === "string"
            ? mesh.name.slice("divsep-div-".length)
            : "";
      const divIndex =
        typeof mesh.userData?.divSepIndex === "number" && Number.isFinite(mesh.userData.divSepIndex)
          ? mesh.userData.divSepIndex
          : 0;
      const cachedHoles = Array.isArray(mesh.userData?.divViewerHoles)
        ? (mesh.userData.divViewerHoles as TechnicalDrillHole[])
        : null;
      const holesRaw =
        cachedHoles ??
        resolveDivisorViewerDrillHoles(divEntry?.drillMarkersByPanel?.divisoresById, {
          divItemId,
          divIndex,
        });
      const holes = filterDivisorViewerShelfHoles(filterTechnicalDrillHolesForViewerMesh(holesRaw));
      const industrialActive = this.isIndustrialDesignActive();
      // createContourEdgesGeometry(left/right) faz sideH = height - 2*t; compensar para sideH = size.y.
      const contourHeight = size.y + 2 * t;
      // Contorno sem furos embutidos — círculos sempre em overlays separados (marcadores limpos).
      geometry = ViewerPanelVisibility.createContourEdgesGeometry(
        divPanelType,
        size.x,
        contourHeight,
        size.z,
        []
      );
      if (!geometry) return;

      const highlight = resolvePanelOutlineHighlight(
        mesh.userData?.industrialDesignValidationError === true,
        mesh.userData?.industrialDesignSelected === true
      );
      const outlineColor = industrialActive ? resolvePanelOutlineColorHex(highlight) : null;
      const material =
        outlineColor != null
          ? highlight === "error"
            ? this.getValidationEdgeMaterial()
            : this.getSelectionEdgeMaterial()
          : mesh.userData?.industrialDesignValidationError === true
            ? this.getValidationEdgeMaterial()
            : this.deps.getSharedPanelEdgeMaterial();
      const overlay = new THREE.LineSegments(geometry, material);
      this.finalizePanelEdgeOverlay(overlay, mesh, visible);

      for (const hole of holes) {
        const holeGeo = ViewerPanelVisibility.createHoleCircleGeometry(
          divPanelType,
          size.x,
          contourHeight,
          size.z,
          hole
        );
        if (!holeGeo) continue;
        const holeMat = industrialActive
          ? this.getHoleColorMaterial(resolveDrillHoleViewerColorHex(hole.tipo))
          : this.deps.getSharedPanelEdgeMaterial();
        const holeOverlay = new THREE.LineSegments(holeGeo, holeMat);
        holeOverlay.userData.isIndustrialDesignHoleOverlay = industrialActive;
        holeOverlay.userData.isPanelEdgeOverlay = !industrialActive;
        holeOverlay.userData.holeType = hole.tipo;
        this.finalizePanelEdgeOverlay(holeOverlay, mesh, visible);
      }
      return;
    } else if (
      mesh.userData?.divSepKind === "sep" ||
      (typeof mesh.name === "string" && mesh.name.startsWith("divsep-")) ||
      mesh.userData?.hasCsgDrillHoles === true
    ) {
      // SEP / meshes CSG: contorno de caixa a partir de authoredSize — sem EdgesGeometry.
      const size = this.getOverlayPanelSize(mesh);
      geometry = ViewerPanelVisibility.createBoxWireframeContourGeometry(size.x, size.y, size.z);
    } else if (
      mesh.userData?.drawerPart != null ||
      mesh.userData?.shelfIndex != null ||
      (mesh.name && (mesh.name.startsWith("shelf-") || mesh.name.startsWith("drawer-"))) ||
      mesh.userData?.isRematePiece === true
    ) {
      const size = this.getMeshBoundingSize(mesh);
      geometry = ViewerPanelVisibility.createBoxWireframeContourGeometry(size.x, size.y, size.z);
    } else if (mesh.geometry) {
      geometry = new THREE.EdgesGeometry(mesh.geometry, ViewerPanelVisibility.FALLBACK_EDGES_ANGLE_DEG);
    }

    if (!geometry) return;

    const industrialActive = this.isIndustrialDesignActive();
    const highlight = resolvePanelOutlineHighlight(
      mesh.userData?.industrialDesignValidationError === true,
      mesh.userData?.industrialDesignSelected === true
    );
    const outlineColor = industrialActive ? resolvePanelOutlineColorHex(highlight) : null;
    const material =
      outlineColor != null
        ? highlight === "error"
          ? this.getValidationEdgeMaterial()
          : this.getSelectionEdgeMaterial()
        : mesh.userData?.industrialDesignValidationError === true
          ? this.getValidationEdgeMaterial()
          : this.deps.getSharedPanelEdgeMaterial();
    const overlay = new THREE.LineSegments(geometry, material);
    this.finalizePanelEdgeOverlay(overlay, mesh, visible);
  }

  private getPanelVisibilityKey(node: THREE.Object3D, panelType: PanelType): string {
    const panelId = node.userData?.panelId as string | undefined;
    if (panelId && panelId.trim().length > 0) return panelId;
    const boxId = this.deps.getBoxIdByMesh(node);
    if (boxId && boxId.trim().length > 0) return `${boxId}:${panelType}`;
    return panelType;
  }

  private getAnyVisibilityKey(node: THREE.Object3D): string | null {
    const panelId = node.userData?.panelId as string | undefined;
    if (panelId && panelId.trim().length > 0) return panelId;

    const remateId = node.userData?.remateId as string | undefined;
    if (remateId && remateId.trim().length > 0) return remateId;

    const doorLayerId = node.userData?.doorLayerId as string | undefined;
    if (doorLayerId && doorLayerId.trim().length > 0) return `door:${doorLayerId}`;

    const drawerLayerId = node.userData?.drawerLayerId as string | undefined;
    const drawerPart = node.userData?.drawerPart as string | undefined;
    if (drawerLayerId && drawerLayerId.trim().length > 0) {
      return `drawer:${drawerLayerId}:${drawerPart ?? "body"}`;
    }

    const shelfIndexValue = node.userData?.shelfIndex;
    const shelfIndex = typeof shelfIndexValue === "number"
      ? shelfIndexValue
      : typeof node.name === "string"
        ? Number((node.name.match(/shelf-(\d+)/)?.[1] ?? "NaN"))
        : Number.NaN;
    if (Number.isFinite(shelfIndex)) {
      const boxId = this.deps.getBoxIdByMesh(node) ?? "box";
      return `shelf:${boxId}:${shelfIndex}`;
    }

    return null;
  }

  private isExplodableMesh(node: THREE.Mesh): boolean {
    if (node.userData?.isPanelEdgeOverlay === true) return false;
    if (node.userData?.isDrillMarker === true) return false;
    if (node.userData?.panelType != null) return true;
    if (node.userData?.doorLayerId != null) return true;
    if (node.userData?.drawerPart != null) return true;
    return node.name.startsWith("shelf-") || node.name.startsWith("door-leaf-") || node.name.startsWith("drawer-");
  }

  private getExplodedDirection(node: THREE.Mesh): THREE.Vector3 {
    const panelType = node.userData?.panelType as PanelType | undefined;
    if (panelType === "left") return new THREE.Vector3(-1, 0, 0);
    if (panelType === "right") return new THREE.Vector3(1, 0, 0);
    if (panelType === "top") return new THREE.Vector3(0, 1, 0);
    if (panelType === "bottom") return new THREE.Vector3(0, -1, 0);
    if (panelType === "back") return new THREE.Vector3(0, 0, -1);
    const base = node.userData?.explodedBasePosition as THREE.Vector3 | undefined;
    if (base instanceof THREE.Vector3 && base.lengthSq() > 1e-8) {
      return base.clone().normalize();
    }
    const localPos = node.position.clone();
    if (localPos.lengthSq() > 1e-8) {
      return localPos.normalize();
    }
    return new THREE.Vector3(0, 0, -1);
  }
}
