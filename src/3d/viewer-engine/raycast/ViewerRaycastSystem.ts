import * as THREE from "three";
import {
  isDrawerClickTarget,
  resolveDrawerIdFromMesh,
} from "../../../core/drawers/drawerMeshIdentity";
import {
  DEFAULT_DOOR_CONFIG,
  DEFAULT_WINDOW_CONFIG,
} from "../../room/types";
import type { DoorWindowConfig } from "../../room/types";
import type { ViewerBoxEntry } from "../types";
import { getPointerNdc } from "../utils";
import { devLogger } from "../../../utils/devLogger";
import { clampOpeningToWall } from "../../../utils/openingConstraints";
import type { MouseMenuTarget } from "../../../ui/context-menu/ContextMenuEngine";
import type { InternalSelectionHit } from "../selection/internalSelectionTypes";
import { resolveInternalSelectionHit } from "../selection/InternalSelectionResolver";
import { resolveRemateIdFromFinishHit } from "../remate/remateLCompositeVisual";

/** Layer lógica interna (raycast continua em layer 0; classificação separa interno vs externo). */
export const VIEWER_INTERNAL_PICK_LAYER = 30;

/** Limites da sala (m) usados por getWallIdInFrontOfCamera — espelha o campo em ViewerCore. */
export type ViewerRaycastRoomBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY: number;
  maxY: number;
  centerX: number;
  centerZ: number;
};

/**
 * Dependências injetadas pelo ViewerCore (sem duplicar estado).
 * Inclui getters pedidos explicitamente; getCanvas / getRoomBounds / getTransformControlsHelper / getDebugMode
 * são necessários para manter o picking idêntico ao código original.
 */
export type ViewerRaycastSystemDeps = {
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  camera: THREE.Camera;
  getBoxes: () => Map<string, ViewerBoxEntry>;
  getRoomBoxWalls: () => Array<{ id: number; normal: THREE.Vector3; mesh: THREE.Mesh }>;
  getRoomBuilderGroup: () => THREE.Group;
  getScene: () => THREE.Scene;
  getCanvas: () => HTMLCanvasElement;
  getRoomBounds: () => ViewerRaycastRoomBounds | null;
  getTransformControlsHelper: () => THREE.Object3D | null;
  getDebugMode: () => boolean;
  getBoxEntry?: (boxId: string) => ViewerBoxEntry | undefined;
  projectWorldToScreen?: (world: THREE.Vector3) => { x: number; y: number } | null;
  getRemateRoot?: () => THREE.Object3D | null;
  /** Root do visualizador TAMPO (trapézio / postforming) — picking de remates. */
  getTampoRoot?: () => THREE.Object3D | null;
  getHematiRoot?: () => THREE.Object3D | null;
  getRodapeRoot?: () => THREE.Object3D | null;
};

/**
 * Sistema de raycast/picking extraído do ViewerCore.
 * Reutiliza o mesmo Raycaster e Vector2 do core (não cria instâncias novas).
 */
export class ViewerRaycastSystem {
  private readonly deps: ViewerRaycastSystemDeps;

  constructor(deps: ViewerRaycastSystemDeps) {
    this.deps = deps;
  }

  getTransformGizmoIntersections(event: { clientX: number; clientY: number }): number {
    const helper = this.deps.getTransformControlsHelper();
    if (!helper || !helper.visible) return 0;
    const { x, y } = getPointerNdc(this.deps.getCanvas(), event);
    this.deps.pointer.set(x, y);
    this.deps.raycaster.setFromCamera(this.deps.pointer, this.deps.camera);
    return this.deps.raycaster.intersectObject(helper, true).length;
  }

  /** Raízes para raycaster do highlight (caixas + sala). */
  private getHighlightRaycastRoots(): THREE.Object3D[] {
    const roots: THREE.Object3D[] = [];
    this.deps.getBoxes().forEach((entry) => roots.push(entry.mesh));
    roots.push(this.deps.getRoomBuilderGroup());
    this.deps.getRoomBoxWalls().forEach((w) => roots.push(w.mesh));
    return roots;
  }

  getHighlightIntersects(event: { clientX: number; clientY: number }): THREE.Intersection[] {
    const canvas = this.deps.getCanvas();
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return [];
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.deps.pointer.set(x, y);
    this.deps.raycaster.setFromCamera(this.deps.pointer, this.deps.camera);
    this.deps.raycaster.layers.set(0);
    const roots = this.getHighlightRaycastRoots();
    return this.deps.raycaster.intersectObjects(roots, true);
  }

  /** Obtém boxId a partir de um mesh (grupo ou filho/GLB); sobe na hierarquia até encontrar userData.boxId ou o grupo da caixa. */
  getBoxIdByMesh(mesh: THREE.Object3D): string | null {
    const boxes = this.deps.getBoxes();
    let current: THREE.Object3D | null = mesh;
    while (current) {
      const boxId = current.userData?.boxId as string | undefined;
      if (boxId && boxes.has(boxId)) return boxId;
      for (const [id, entry] of boxes.entries()) {
        if (entry.mesh === current) return id;
      }
      current = current.parent;
    }
    return null;
  }

  /** Obtém doorLayerId subindo na hierarquia (mesh → pivot door-layer-* → …). Usado por getContextMenuLayerHit e getDoorHitAtPointer. */
  private getDoorLayerIdByMesh(mesh: THREE.Object3D): string | null {
    let current: THREE.Object3D | null = mesh;
    while (current) {
      const doorLayerId = current.userData?.doorLayerId;
      if (typeof doorLayerId === "string" && doorLayerId.length > 0) {
        return doorLayerId;
      }
      current = current.parent;
    }
    return null;
  }

  private isDrawerHierarchyObject(object: THREE.Object3D): boolean {
    if (isDrawerClickTarget(object)) return true;
    let current: THREE.Object3D | null = object;
    while (current) {
      if (typeof current.name === "string" && current.name.startsWith("drawer-layer-")) return true;
      current = current.parent;
    }
    return false;
  }

  private pickIdFromFinishRoot(
    event: { clientX: number; clientY: number },
    root: THREE.Object3D | null | undefined,
    idKey: "hematiId" | "rodapeId" | "remateId",
    skipMergeKey: "isHematiMergeVisual" | "isRodapeMergeVisual" | "isRemateMergeVisual"
  ): string | null {
    if (!root) return null;
    return this.pickIdFromFinishRoots(event, [root], idKey, skipMergeKey);
  }

  private pickIdFromFinishRoots(
    event: { clientX: number; clientY: number },
    roots: THREE.Object3D[],
    idKey: "hematiId" | "rodapeId" | "remateId",
    skipMergeKey: "isHematiMergeVisual" | "isRodapeMergeVisual" | "isRemateMergeVisual"
  ): string | null {
    if (!roots.length) return null;
    const canvas = this.deps.getCanvas();
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.deps.pointer.set(x, y);
    this.deps.raycaster.setFromCamera(this.deps.pointer, this.deps.camera);
    this.deps.raycaster.layers.set(0);
    const hits = this.deps.raycaster.intersectObjects(roots, true);
    for (const hit of hits) {
      if (hit.object.userData?.[skipMergeKey] === true) continue;
      if (idKey === "remateId") {
        const remateId = resolveRemateIdFromFinishHit(hit.object);
        if (remateId) return remateId;
        continue;
      }
      const id = hit.object.userData?.[idKey];
      if (typeof id === "string" && id.length > 0) return id;
    }
    return null;
  }

  getHematiIdAtPointer(event: { clientX: number; clientY: number }): string | null {
    return this.pickIdFromFinishRoot(event, this.deps.getHematiRoot?.(), "hematiId", "isHematiMergeVisual");
  }

  getRodapeIdAtPointer(event: { clientX: number; clientY: number }): string | null {
    return this.pickIdFromFinishRoot(event, this.deps.getRodapeRoot?.(), "rodapeId", "isRodapeMergeVisual");
  }

  getRemateIdAtPointer(event: { clientX: number; clientY: number }): string | null {
    const roots = [this.deps.getRemateRoot?.(), this.deps.getTampoRoot?.()].filter(
      (r): r is THREE.Object3D => r != null
    );
    return this.pickIdFromFinishRoots(event, roots, "remateId", "isRemateMergeVisual");
  }

  /** Ponto 3D do primeiro hit (medidas/âncoras — não altera seleção). */
  getPointerWorldHit(event: { clientX: number; clientY: number }): THREE.Vector3 | null {
    const canvas = this.deps.getCanvas();
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.deps.pointer.set(x, y);
    this.deps.raycaster.setFromCamera(this.deps.pointer, this.deps.camera);
    this.deps.raycaster.layers.set(0);

    const finishRoots = [
      this.deps.getHematiRoot?.(),
      this.deps.getRodapeRoot?.(),
      this.deps.getRemateRoot?.(),
      this.deps.getTampoRoot?.(),
    ].filter((root): root is THREE.Object3D => root != null);

    if (finishRoots.length > 0) {
      const finishHits = this.deps.raycaster.intersectObjects(finishRoots, true);
      for (const hit of finishHits) {
        if (hit.object.userData?.isHematiMergeVisual === true) continue;
        if (hit.object.userData?.isRodapeMergeVisual === true) continue;
        if (hit.object.userData?.isRemateMergeVisual === true) continue;
        const remateId = resolveRemateIdFromFinishHit(hit.object);
        if (remateId) {
          return hit.point.clone();
        }
        const id =
          hit.object.userData?.hematiId ??
          hit.object.userData?.rodapeId ??
          hit.object.userData?.remateId;
        if (typeof id === "string" && id.length > 0) {
          return hit.point.clone();
        }
      }
    }

    const boxRoots: THREE.Object3D[] = [];
    this.deps.getBoxes().forEach((entry) => boxRoots.push(entry.mesh));
    if (!boxRoots.length) return null;

    const boxHits = this.deps.raycaster.intersectObjects(boxRoots, true);
    for (const hit of boxHits) {
      const boxId = this.getBoxIdByMesh(hit.object);
      if (!boxId) continue;
      return hit.point.clone();
    }
    return null;
  }

  getBoxIdAtPointer(event: { clientX: number; clientY: number }) {
    const canvas = this.deps.getCanvas();
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.deps.pointer.set(x, y);
    this.deps.raycaster.setFromCamera(this.deps.pointer, this.deps.camera);
    this.deps.raycaster.layers.set(0);
    const roots: THREE.Object3D[] = [];
    const boxes = this.deps.getBoxes();
    boxes.forEach((entry) => {
      roots.push(entry.mesh);
    });
    const hits = this.deps.raycaster.intersectObjects(roots, true);
    if (import.meta.env.DEV) {
      const hitsDebug = hits.map((hit, index) => ({
        index,
        objectName: hit.object.name,
        objectUuid: hit.object.uuid,
        distance: hit.distance,
        hasBoxIdInHierarchy: this.getBoxIdByMesh(hit.object),
        hasDoorLayerIdInHierarchy: this.getDoorLayerIdByMesh(hit.object),
      }));
      devLogger.debug("[SELECTION][Raycast] getBoxIdAtPointer hits", {
        totalHits: hits.length,
        hits: hitsDebug,
      });
    }
    if (!hits.length) return null;
    for (const hit of hits) {
      const candidate = hit.object;
      const boxIdCandidate = this.getBoxIdByMesh(candidate);
      if (!boxIdCandidate) continue;
      if (import.meta.env.DEV) {
        devLogger.debug("[SELECTION][Raycast] primeiro hit com boxId", {
          boxIdCandidate,
          candidateName: candidate.name,
          candidateUuid: candidate.uuid,
        });
      }
      const doorLayerIdAtPointer = this.getDoorLayerIdByMesh(candidate);
      if (!doorLayerIdAtPointer) {
        if (import.meta.env.DEV) {
          devLogger.debug("[SELECTION][Raycast] mesh final resolvido", {
            boxId: boxIdCandidate,
            meshName: candidate.name,
            meshUuid: candidate.uuid,
          });
        }
        return boxIdCandidate;
      }
      const entry = boxes.get(boxIdCandidate);
      const doorIndex = entry?.mesh
        ? entry.mesh.children.filter((c) => c.name.startsWith("door-layer-")).findIndex((c) => c.name === `door-layer-${doorLayerIdAtPointer}`)
        : -1;
      if (import.meta.env.DEV && this.deps.getDebugMode()) {
        devLogger.debug("[DOOR-MAT] getBoxIdAtPointer — primeiro hit é porta (clique simples)", {
          boxId: boxIdCandidate,
          doorLayerId: doorLayerIdAtPointer,
          specId: doorLayerIdAtPointer,
          doorIndex,
          hitObjectName: candidate.name,
        });
      }
      if (import.meta.env.DEV) {
        devLogger.debug("[SELECTION][Raycast] mesh final resolvido (porta)", {
          boxId: boxIdCandidate,
          meshName: candidate.name,
          meshUuid: candidate.uuid,
          doorLayerIdAtPointer,
        });
      }
      return boxIdCandidate;
    }
    if (import.meta.env.DEV) {
      devLogger.debug("[SELECTION][Raycast] nenhum hit válido com boxId", {
        totalHits: hits.length,
      });
    }
    return null;
  }

  getDoorHitAtPointer(event: { clientX: number; clientY: number }): { boxId: string; doorLayerId: string } | null {
    const canvas = this.deps.getCanvas();
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.deps.pointer.set(x, y);
    this.deps.raycaster.setFromCamera(this.deps.pointer, this.deps.camera);
    this.deps.raycaster.layers.set(0);
    const roots: THREE.Object3D[] = [];
    const boxes = this.deps.getBoxes();
    boxes.forEach((entry) => {
      roots.push(entry.mesh);
    });
    const hits = this.deps.raycaster.intersectObjects(roots, true);
    for (const hit of hits) {
      const doorLayerId = this.getDoorLayerIdByMesh(hit.object);
      if (!doorLayerId) continue;
      const boxId = this.getBoxIdByMesh(hit.object);
      if (!boxId) continue;
      const entry = boxes.get(boxId);
      const doorNames = entry?.mesh ? entry.mesh.children.filter((c) => c.name.startsWith("door-layer-")).map((c) => c.name) : [];
      const doorIndex = entry?.mesh
        ? entry.mesh.children.filter((c) => c.name.startsWith("door-layer-")).findIndex((c) => c.name === `door-layer-${doorLayerId}`)
        : -1;
      if (import.meta.env.DEV) {
        devLogger.debug("[DOOR-MAT] getDoorHitAtPointer (double-click/raycast)", {
          boxId,
          doorLayerId,
          specId: doorLayerId,
          doorIndex,
          doorNamesNoBox: doorNames,
          hitObjectName: hit.object.name,
        });
      }
      return { boxId, doorLayerId };
    }
    return null;
  }

  /**
   * Primeiro hit no corpo da caixa (painéis estruturais), excluindo portas e gavetas.
   * Usado pelo duplo clique global no módulo.
   */
  getBoxBodyHitAtPointer(event: { clientX: number; clientY: number }): { boxId: string } | null {
    const canvas = this.deps.getCanvas();
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.deps.pointer.set(x, y);
    this.deps.raycaster.setFromCamera(this.deps.pointer, this.deps.camera);
    this.deps.raycaster.layers.set(0);
    const roots: THREE.Object3D[] = [];
    this.deps.getBoxes().forEach((entry) => roots.push(entry.mesh));
    const hits = this.deps.raycaster.intersectObjects(roots, true);
    for (const hit of hits) {
      if (this.isDrawerHierarchyObject(hit.object)) continue;
      if (this.getDoorLayerIdByMesh(hit.object)) continue;
      const boxId = this.getBoxIdByMesh(hit.object);
      if (!boxId) continue;
      return { boxId };
    }
    return null;
  }

  getDrawerHitAtPointer(event: { clientX: number; clientY: number }): { boxId: string; drawerLayerId: string } | null {
    const canvas = this.deps.getCanvas();
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.deps.pointer.set(x, y);
    this.deps.raycaster.setFromCamera(this.deps.pointer, this.deps.camera);
    this.deps.raycaster.layers.set(0);
    const roots: THREE.Object3D[] = [];
    this.deps.getBoxes().forEach((entry) => roots.push(entry.mesh));
    const hits = this.deps.raycaster.intersectObjects(roots, true);
    for (const hit of hits) {
      if (!isDrawerClickTarget(hit.object)) continue;
      const drawerLayerId = resolveDrawerIdFromMesh(hit.object);
      if (!drawerLayerId) continue;
      const boxId = this.getBoxIdByMesh(hit.object);
      if (!boxId) continue;
      return { boxId, drawerLayerId };
    }
    return null;
  }

  /**
   * Retorna o alvo do ponteiro para o menu de contexto: porta, gaveta ou null (módulo/canvas).
   * Raycast nos boxes; para o primeiro hit que tenha getDoorLayerIdByMesh ou getDrawerLayerIdByMesh, devolve boxId + type + doorLayerId/drawerLayerId.
   * Depende de userData.doorLayerId propagado em createDoorObject e de userData.boxId em applyPanelIdsToBox.
   */
  getContextMenuLayerHit(event: { clientX: number; clientY: number }): MouseMenuTarget | null {
    const canvas = this.deps.getCanvas();
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.deps.pointer.set(x, y);
    this.deps.raycaster.setFromCamera(this.deps.pointer, this.deps.camera);
    this.deps.raycaster.layers.set(0);
    const roots: THREE.Object3D[] = [];
    const boxes = this.deps.getBoxes();
    boxes.forEach((entry) => {
      roots.push(entry.mesh);
    });
    const hits = this.deps.raycaster.intersectObjects(roots, true);
    for (const hit of hits) {
      const boxId = this.getBoxIdByMesh(hit.object);
      if (!boxId) continue;
      const remateId = hit.object.userData?.remateId;
      if (typeof remateId === "string" && remateId.length > 0) {
        return { type: "remate", boxId, remateId };
      }
      const doorLayerId = this.getDoorLayerIdByMesh(hit.object);
      if (doorLayerId) {
        const entry = boxes.get(boxId);
        const doorNames = entry?.mesh ? entry.mesh.children.filter((c) => c.name.startsWith("door-layer-")).map((c) => c.name) : [];
        const doorIndex = entry?.mesh
          ? entry.mesh.children.filter((c) => c.name.startsWith("door-layer-")).findIndex((c) => c.name === `door-layer-${doorLayerId}`)
          : -1;
        if (import.meta.env.DEV) {
          devLogger.debug("[DOOR-MAT] getContextMenuLayerHit — porta selecionada pelo raycaster (menu contexto)", {
            boxId,
            doorLayerId,
            specId: doorLayerId,
            doorIndex,
            doorNamesNoBox: doorNames,
            hitObjectName: hit.object.name,
            hitObjectUserDataDoorLayerId: (hit.object as THREE.Object3D & { userData: { doorLayerId?: string } }).userData?.doorLayerId,
          });
        }
        if (import.meta.env.DEV) {
          devLogger.debug("[getContextMenuLayerHit] porta clicada (enviado para o menu)", {
            boxId,
            doorLayerId,
            hitObjectName: hit.object.name,
            hitObjectUuid: hit.object.uuid,
            hitObjectUserDataDoorLayerId: (hit.object as THREE.Object3D & { userData: { doorLayerId?: string } }).userData?.doorLayerId,
          });
        }
        return { boxId, type: "door", doorLayerId };
      }
      const drawerLayerId = isDrawerClickTarget(hit.object) ? resolveDrawerIdFromMesh(hit.object) : null;
      if (drawerLayerId) return { boxId, type: "drawer", drawerLayerId };
      const divSepHit = this.resolveDivSepFromMesh(hit.object, boxId);
      if (divSepHit) return divSepHit;
      const panelId = hit.object.userData?.panelId;
      const panelType = hit.object.userData?.panelType;
      if (typeof panelId === "string" && panelId.length > 0) {
        return {
          type: "piece",
          boxId,
          panelId,
          panelType: typeof panelType === "string" ? panelType : undefined,
        };
      }
      return { type: "box", boxId };
    }
    const roomElement = this.getRoomElementAtPointer(event);
    if (roomElement) {
      return {
        type: "room",
        wallId: roomElement.wallId,
        roomElementId: roomElement.elementId,
      };
    }
    const wallId = this.getWallIdAtPointer(event);
    if (wallId != null) return { type: "room", wallId };
    return null;
  }

  /**
   * Picking interno (faces, arestas, pontos dentro da cavidade).
   * Pipeline separado — não altera getBoxIdAtPointer nem seleção externa.
   */
  getInternalSelectionHit(event: { clientX: number; clientY: number }): InternalSelectionHit | null {
    const getBoxEntry = this.deps.getBoxEntry;
    const projectWorldToScreen = this.deps.projectWorldToScreen;
    if (!getBoxEntry || !projectWorldToScreen) return null;

    const canvas = this.deps.getCanvas();
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.deps.pointer.set(x, y);
    this.deps.raycaster.setFromCamera(this.deps.pointer, this.deps.camera);
    this.deps.raycaster.layers.set(0);

    const roots: THREE.Object3D[] = [];
    this.deps.getBoxes().forEach((entry) => roots.push(entry.mesh));
    if (!roots.length) return null;

    const hits = this.deps.raycaster.intersectObjects(roots, true);
    if (import.meta.env.DEV && this.deps.getDebugMode()) {
      devLogger.debug("[SELECTION][Raycast] getInternalSelectionHit hits", {
        totalHits: hits.length,
      });
    }

    const getBoxMesh = (boxId: string): THREE.Object3D | null => {
      return this.deps.getBoxes().get(boxId)?.mesh ?? null;
    };

    return resolveInternalSelectionHit(hits, event, rect, getBoxMesh, {
      getBoxEntry,
      projectWorldToScreen,
    });
  }

  getWallPlacementHit(
    event: { clientX: number; clientY: number },
    placementType: "door" | "window"
  ): { wallId: number; config: DoorWindowConfig; type: "door" | "window" } | null {
    const base: DoorWindowConfig =
      placementType === "door" ? { ...DEFAULT_DOOR_CONFIG } : { ...DEFAULT_WINDOW_CONFIG };
    const wallEntries = this.deps.getRoomBoxWalls();
    const roomMeshes = wallEntries.map((w) => w.mesh);
    if (!roomMeshes.length) return null;

    const canvas = this.deps.getCanvas();
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.deps.pointer.set(x, y);
    this.deps.raycaster.setFromCamera(this.deps.pointer, this.deps.camera);
    const hits = this.deps.raycaster.intersectObjects(roomMeshes, true);
    if (!hits.length) return null;

    let current: THREE.Object3D | null = hits[0].object;
    let wallMesh: THREE.Mesh | null = null;
    let wallId: number | undefined;
    while (current) {
      const wid = (current as THREE.Mesh & { userData?: { wallId?: number } }).userData?.wallId;
      if (typeof wid === "number") {
        wallId = wid;
        wallMesh = current as THREE.Mesh;
        break;
      }
      current = current.parent;
    }
    if (wallId === undefined || !wallMesh) return null;

    const wallLenMm = (wallMesh.userData.wallLengthMm as number | undefined) ?? 3000;
    const wallHeightMm = (wallMesh.userData.wallHeightMm as number | undefined) ?? 2800;
    const wallLenM = wallLenMm / 1000;
    const wallHM = wallHeightMm / 1000;
    const local = wallMesh.worldToLocal(hits[0].point.clone());

    const horizontalOffsetMm = (local.x + wallLenM / 2) * 1000 - base.widthMm / 2;
    const floorOffsetMm = (local.y + wallHM / 2) * 1000 - base.heightMm / 2;
    const clamped = clampOpeningToWall(
      { ...base, horizontalOffsetMm, floorOffsetMm },
      wallLenMm,
      wallHeightMm
    );
    return {
      wallId,
      config: { ...base, horizontalOffsetMm: clamped.horizontalOffsetMm, floorOffsetMm: clamped.floorOffsetMm },
      type: placementType,
    };
  }

  getWallIdAtPointer(event: { clientX: number; clientY: number }): number | null {
    const roomMeshes = this.deps.getRoomBoxWalls().map((w) => w.mesh);
    if (!roomMeshes.length) return null;

    const canvas = this.deps.getCanvas();
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.deps.pointer.set(x, y);
    this.deps.raycaster.setFromCamera(this.deps.pointer, this.deps.camera);
    const hits = this.deps.raycaster.intersectObjects(roomMeshes, true);
    if (!hits.length) return null;

    let current: THREE.Object3D | null = hits[0].object;
    while (current) {
      const wallId = (current as THREE.Mesh & { userData?: { wallId?: number } }).userData?.wallId;
      if (typeof wallId === "number") return wallId;
      current = current.parent;
    }
    return null;
  }

  getWallIdInFrontOfCamera(): number | null {
    const roomBounds = this.deps.getRoomBounds();
    if (!roomBounds) return null;
    const cam = this.deps.camera;
    const centerY = (roomBounds.minY + roomBounds.maxY) / 2;
    const center = new THREE.Vector3(roomBounds.centerX, centerY, roomBounds.centerZ);
    const dir = center.clone().sub(cam.position);
    if (dir.lengthSq() < 1e-6) return null;
    const roomWalls = this.deps.getRoomBoxWalls().map((w) => w.mesh);
    if (!roomWalls.length) return null;
    this.deps.raycaster.set(cam.position, dir.normalize());
    const hits = this.deps.raycaster.intersectObjects(roomWalls, false);
    const hitWall = hits.length ? hits[0].object : null;
    if (!hitWall) return null;
    const entry = this.deps.getRoomBoxWalls().find((w) => w.mesh === hitWall);
    return entry?.id ?? null;
  }

  getRoomElementAtPointer(event: { clientX: number; clientY: number }): {
    elementId: string;
    wallId: number;
    type: "door" | "window";
    config: DoorWindowConfig;
  } | null {
    const roomMeshes: THREE.Object3D[] = [];
    const collect = (root: THREE.Object3D) => {
      root.traverse((child) => {
        if (child instanceof THREE.Mesh && child.userData?.isRoomElement === true) {
          roomMeshes.push(child);
        }
      });
    };
    collect(this.deps.getRoomBuilderGroup());
    this.deps.getRoomBoxWalls().forEach((w) => collect(w.mesh));
    if (!roomMeshes.length) return null;

    const canvas = this.deps.getCanvas();
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.deps.pointer.set(x, y);
    this.deps.raycaster.setFromCamera(this.deps.pointer, this.deps.camera);
    const hits = this.deps.raycaster.intersectObjects(roomMeshes, true);
    if (!hits.length) return null;

    let current: THREE.Object3D | null = hits[0].object;
    while (current) {
      const elementId = current.userData?.elementId as string | undefined;
      const elementType = current.userData?.elementType as "door" | "window" | undefined;
      const config = current.userData?.config as DoorWindowConfig | undefined;
      if (elementId && elementType && config) {
        let wall: THREE.Object3D | null = current.parent;
        while (wall) {
          const wallId = wall.userData?.wallId as number | undefined;
          if (typeof wallId === "number") {
            return { elementId, wallId, type: elementType, config: { ...config } };
          }
          wall = wall.parent;
        }
      }
      current = current.parent;
    }
    return null;
  }

  /** Primeiro hit DIV/SEP dentro de caixas (prioridade sobre seleção de caixa). */
  getDivSepHitAtPointer(event: { clientX: number; clientY: number }): {
    boxId: string;
    kind: "div" | "sep";
    itemId: string;
  } | null {
    const canvas = this.deps.getCanvas();
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.deps.pointer.set(x, y);
    this.deps.raycaster.setFromCamera(this.deps.pointer, this.deps.camera);
    this.deps.raycaster.layers.set(0);
    const roots: THREE.Object3D[] = [];
    this.deps.getBoxes().forEach((entry) => roots.push(entry.mesh));
    if (!roots.length) return null;
    const hits = this.deps.raycaster.intersectObjects(roots, true);
    for (const hit of hits) {
      const boxId = this.getBoxIdByMesh(hit.object);
      if (!boxId) continue;
      const divSep = this.resolveDivSepFromObject(hit.object, boxId);
      if (divSep) return divSep;
    }
    return null;
  }

  private resolveDivSepFromMesh(
    hitObject: THREE.Object3D,
    boxId: string
  ): { type: "divSep"; boxId: string; divSepKind: "div" | "sep"; divSepItemId: string } | null {
    const resolved = this.resolveDivSepFromObject(hitObject, boxId);
    if (!resolved) return null;
    return {
      type: "divSep",
      boxId: resolved.boxId,
      divSepKind: resolved.kind,
      divSepItemId: resolved.itemId,
    };
  }

  private resolveDivSepFromObject(
    hitObject: THREE.Object3D,
    boxId: string
  ): { boxId: string; kind: "div" | "sep"; itemId: string } | null {
    let current: THREE.Object3D | null = hitObject;
    while (current) {
      const kind = current.userData?.divSepKind;
      const itemId = current.userData?.divSepItemId;
      if ((kind === "div" || kind === "sep") && typeof itemId === "string" && itemId.length > 0) {
        return { boxId, kind, itemId };
      }
      if (current === current.parent) break;
      current = current.parent;
    }
    return null;
  }

  /** UI helper — não altera seleção do viewer. */
  isPointerOnSelectableObject(event: { clientX: number; clientY: number }): boolean {
    const layerHit = this.getContextMenuLayerHit(event);
    if (layerHit && layerHit.type !== "empty" && layerHit.type !== "room") return true;
    if (this.getDivSepHitAtPointer(event)) return true;
    if (this.getRemateIdAtPointer(event)) return true;
    if (this.getRodapeIdAtPointer(event)) return true;
    if (this.getHematiIdAtPointer(event)) return true;
    return false;
  }
}
