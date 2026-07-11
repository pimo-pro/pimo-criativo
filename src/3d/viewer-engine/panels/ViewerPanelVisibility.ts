import * as THREE from "three";
import type { BoxPanelIds } from "../../../core/types";
import { ViewerHighlightController } from "../highlight/ViewerHighlightController";
import { resolvePieceHighlightVisible } from "../highlight/viewerHighlightPolicy";

type ViewerBoxLike = {
  mesh: THREE.Object3D;
  width: number;
  height: number;
  depth: number;
  carcassDepth?: number;
  drillMarkersByPanel?: import("../../../core/types").ViewerDrillMarkersByPanel;
};

type PanelType = "left" | "right" | "top" | "bottom" | "back";

type ViewerPanelVisibilityDeps = {
  getBoxes: () => Map<string, ViewerBoxLike>;
  getBoxIdByMesh: (_mesh: THREE.Object3D) => string | null;
  getSharedPanelEdgeMaterial: () => THREE.LineBasicMaterial;
  getIndustrialDesignWorkspaceEnabled?: () => boolean;
};

export class ViewerPanelVisibility {
  private readonly deps: ViewerPanelVisibilityDeps;
  private readonly highlightController: ViewerHighlightController;
  private panelEdgesVisible = true;
  private hiddenPanels = new Set<string>();
  private hideAllPanels = false;
  private explodedViewEnabled = false;
  private explodedViewIntensity = 0.35;
  private panelRenderingEnabled = false;

  private static readonly THIN_PIECE_THRESHOLD_M = 0.012;

  constructor(deps: ViewerPanelVisibilityDeps) {
    this.deps = deps;
    this.highlightController = new ViewerHighlightController({
      getBoxes: () => deps.getBoxes(),
      getSharedPanelEdgeMaterial: () => deps.getSharedPanelEdgeMaterial(),
      getIndustrialDesignWorkspaceEnabled: deps.getIndustrialDesignWorkspaceEnabled,
      getHighlightFlags: () => ({
        panelEdgesVisible: this.panelEdgesVisible,
        panelRenderingEnabled: this.panelRenderingEnabled,
        industrialDesignActive: this.deps.getIndustrialDesignWorkspaceEnabled?.() === true,
      }),
    });
  }

  getHighlightController(): ViewerHighlightController {
    return this.highlightController;
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

  applyPanelVisibilityForObject(root: THREE.Object3D): void {
    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const panelType = node.userData?.panelType as PanelType | undefined;
      const isRemate = node.userData?.isRematePiece === true;
      const isDoorOrDrawerOrShelf =
        (node.name &&
          (node.name.startsWith("door-leaf-") ||
            node.name.startsWith("shelf-") ||
            node.name.startsWith("drawer-") ||
            node.name.startsWith("divsep-"))) ||
        node.userData?.doorLayerId != null ||
        node.userData?.drawerPart != null ||
        node.userData?.divSepKind != null;
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
      const highlightVisible = resolvePieceHighlightVisible(!hidden, {
        panelEdgesVisible: this.panelEdgesVisible,
        panelRenderingEnabled: this.panelRenderingEnabled,
        industrialDesignActive: this.deps.getIndustrialDesignWorkspaceEnabled?.() === true,
      });
      this.highlightController.syncPieceHighlights(node, highlightVisible);
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
