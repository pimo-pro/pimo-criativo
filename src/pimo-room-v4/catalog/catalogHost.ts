/**
 * Sincroniza itens do catálogo com a cena ViewerCore (WebGL).
 * Select / drag / Q-E / Delete.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { RoomState } from "../RoomState";
import { RoomLevelGeometry } from "../levels/RoomLevelGeometry";
import {
  getRoomEngineViewerHost,
  roomEngineStore,
} from "../roomEngineStore";
import { CatalogItemManager, toCatalogItemState } from "./CatalogItemManager";
import type { CatalogItemState } from "./CatalogItemState";
import { getCatalogPreset } from "./CatalogPresets";
import { createPlaceholderMesh } from "./createPlaceholderMesh";

const GROUP_NAME = "roomCatalogItems";
const USER_ITEM_ID = "roomCatalogItemId";

type ViewerCoreLoose = {
  cameraManager?: { camera: THREE.PerspectiveCamera };
  controls?: { controls: { enabled: boolean } };
  rendererManager?: { renderer: { domElement: HTMLElement } };
  sceneManager?: { scene: THREE.Scene };
};

let itemsGroup: THREE.Group | null = null;
let selectedId: string | null = null;
let dragging = false;
let dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let dragOffset = new THREE.Vector3();
let listenersAttached = false;
const gltfCache = new Map<string, THREE.Object3D>();
const gltfLoader = new GLTFLoader();

function getCore(): ViewerCoreLoose | null {
  return getRoomEngineViewerHost() as unknown as ViewerCoreLoose | null;
}

function ensureGroup(scene: THREE.Scene): THREE.Group {
  if (itemsGroup && itemsGroup.parent === scene) return itemsGroup;
  if (itemsGroup) itemsGroup.parent?.remove(itemsGroup);
  itemsGroup = new THREE.Group();
  itemsGroup.name = GROUP_NAME;
  scene.add(itemsGroup);
  return itemsGroup;
}

function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((c) => {
    if (c instanceof THREE.Mesh) {
      c.geometry?.dispose();
      const m = c.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m?.dispose();
    }
  });
}

async function loadGltf(src: string): Promise<THREE.Object3D | null> {
  if (gltfCache.has(src)) return gltfCache.get(src)!.clone(true);
  try {
    const gltf = await gltfLoader.loadAsync(src);
    const root = gltf.scene;
    gltfCache.set(src, root.clone(true));
    return root;
  } catch {
    return null;
  }
}

function applyTransform(
  root: THREE.Object3D,
  item: CatalogItemState,
  baseElevationM: number
): void {
  root.position.set(
    item.positionMm.x / 1000,
    baseElevationM + item.positionMm.y / 1000,
    item.positionMm.z / 1000
  );
  root.rotation.y = (item.rotationDeg * Math.PI) / 180;
  root.scale.set(item.scale.x, item.scale.y, item.scale.z);
  root.userData[USER_ITEM_ID] = item.id;
  root.traverse((c) => {
    c.userData[USER_ITEM_ID] = item.id;
  });
}

function setSelectedVisual(id: string | null): void {
  selectedId = id;
  roomEngineStore.getState().setSelectedItemId(id);
  if (!itemsGroup) return;
  itemsGroup.traverse((c) => {
    if (!(c instanceof THREE.Mesh)) return;
    const itemId = c.userData[USER_ITEM_ID] as string | undefined;
    const mats = Array.isArray(c.material) ? c.material : [c.material];
    for (const m of mats) {
      if (m && "emissive" in m && m.emissive) {
        (m as THREE.MeshStandardMaterial).emissive.setHex(
          itemId && itemId === id ? 0x224466 : 0x000000
        );
      }
    }
  });
}

function findItemRoot(obj: THREE.Object3D | null): THREE.Object3D | null {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (cur.parent === itemsGroup || cur.parent?.name === GROUP_NAME) {
      return cur;
    }
    cur = cur.parent;
  }
  return null;
}

function onPointerDown(e: PointerEvent): void {
  const core = getCore();
  if (!core?.cameraManager?.camera || !core.rendererManager || !itemsGroup) return;
  if (roomEngineStore.getState().walkthroughActive) return;
  const canvas = core.rendererManager.renderer.domElement;
  const rect = canvas.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, core.cameraManager.camera);
  const hits = raycaster.intersectObjects(itemsGroup.children, true);
  if (hits.length === 0) {
    setSelectedVisual(null);
    return;
  }
  const root = findItemRoot(hits[0]!.object);
  if (!root) return;
  const id = root.userData[USER_ITEM_ID] as string;
  setSelectedVisual(id);
  dragging = true;
  const hitPoint = hits[0]!.point.clone();
  dragPlane.constant = -hitPoint.y;
  dragOffset.copy(root.position).sub(hitPoint);
  e.preventDefault();
  e.stopPropagation();
}

function onPointerMove(e: PointerEvent): void {
  if (!dragging || !selectedId) return;
  const core = getCore();
  if (!core?.cameraManager?.camera || !core.rendererManager || !itemsGroup) return;
  const canvas = core.rendererManager.renderer.domElement;
  const rect = canvas.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, core.cameraManager.camera);
  const hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(dragPlane, hit)) return;
  const root = itemsGroup.children.find((c) => c.userData[USER_ITEM_ID] === selectedId);
  if (!root) return;
  root.position.x = hit.x + dragOffset.x;
  root.position.z = hit.z + dragOffset.z;
}

function onPointerUp(): void {
  if (!dragging || !selectedId) {
    dragging = false;
    return;
  }
  dragging = false;
  const root = itemsGroup?.children.find((c) => c.userData[USER_ITEM_ID] === selectedId);
  if (!root) return;
  const store = roomEngineStore.getState();
  const state = store.roomState;
  if (!state) return;
  const baseY = RoomLevelGeometry.forLevel(state, state.activeLevelId)?.baseElevationM ?? 0;
  const next = CatalogItemManager.move(state, selectedId, {
    x: root.position.x * 1000,
    y: Math.max(0, (root.position.y - baseY) * 1000),
    z: root.position.z * 1000,
  });
  store.setRoomState(next);
}

function onKeyDown(e: KeyboardEvent): void {
  if (!selectedId) return;
  if (roomEngineStore.getState().walkthroughActive) return;
  const target = e.target as HTMLElement | null;
  if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
    return;
  }
  const store = roomEngineStore.getState();
  const state = store.roomState;
  if (!state) return;
  const raw = state.items.find((i) => i.id === selectedId);
  if (!raw) return;

  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && (e.code === "KeyD" || e.key.toLowerCase() === "d")) {
    const next = CatalogItemManager.duplicate(state, selectedId);
    const added = next.items[next.items.length - 1];
    store.setRoomState(next);
    void syncCatalogItems(next);
    if (added) setSelectedVisual(added.id);
    e.preventDefault();
    return;
  }

  if (e.code === "KeyQ" || e.code === "KeyE") {
    const item = toCatalogItemState(raw);
    const delta = e.code === "KeyQ" ? -15 : 15;
    const next = CatalogItemManager.rotate(state, selectedId, item.rotationDeg + delta);
    store.setRoomState(next);
    void syncCatalogItems(next);
    e.preventDefault();
    return;
  }
  if (e.code === "Delete" || e.code === "Backspace") {
    const next = CatalogItemManager.remove(state, selectedId);
    store.setRoomState(next);
    setSelectedVisual(null);
    void syncCatalogItems(next);
    e.preventDefault();
    return;
  }

  const step = e.shiftKey ? 200 : 50;
  let dx = 0;
  let dz = 0;
  if (e.code === "ArrowLeft") dx = -step;
  else if (e.code === "ArrowRight") dx = step;
  else if (e.code === "ArrowUp") dz = -step;
  else if (e.code === "ArrowDown") dz = step;
  else return;

  const item = toCatalogItemState(raw);
  const next = CatalogItemManager.move(state, selectedId, {
    x: item.positionMm.x + dx,
    y: item.positionMm.y,
    z: item.positionMm.z + dz,
  });
  store.setRoomState(next);
  void syncCatalogItems(next);
  e.preventDefault();
}

function attachListeners(canvas: HTMLElement): void {
  if (listenersAttached) return;
  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("keydown", onKeyDown);
  listenersAttached = true;
}

export function getSelectedCatalogItemId(): string | null {
  return selectedId;
}

export function selectCatalogItem(id: string | null): void {
  setSelectedVisual(id);
}

export async function syncCatalogItems(state: RoomState): Promise<void> {
  const core = getCore();
  if (!core?.sceneManager?.scene || !core.rendererManager?.renderer?.domElement) return;
  const group = ensureGroup(core.sceneManager.scene);
  attachListeners(core.rendererManager.renderer.domElement);

  while (group.children.length) {
    const ch = group.children[0]!;
    group.remove(ch);
    disposeObject(ch);
  }

  const activeItems = CatalogItemManager.list(state, state.activeLevelId);
  const baseY = RoomLevelGeometry.forLevel(state, state.activeLevelId)?.baseElevationM ?? 0;

  for (const raw of activeItems) {
    const item = toCatalogItemState(raw);
    const preset = getCatalogPreset(item.catalogId);
    let root: THREE.Object3D | null = null;
    if (item.src) {
      root = await loadGltf(item.src);
    }
    if (!root && preset) {
      root = createPlaceholderMesh(preset);
    }
    if (!root) {
      root = createPlaceholderMesh({
        id: item.catalogId,
        name: item.name,
        type: item.type,
        sizeMm: { width: 600, depth: 600, height: 600 },
        color: "#888888",
      });
    }
    applyTransform(root, item, baseY);
    group.add(root);
  }

  if (selectedId && !activeItems.some((i) => i.id === selectedId)) {
    setSelectedVisual(null);
  } else if (selectedId) {
    setSelectedVisual(selectedId);
  }
}

export function clearCatalogItemsFromScene(): void {
  if (itemsGroup) {
    itemsGroup.parent?.remove(itemsGroup);
    while (itemsGroup.children.length) {
      const ch = itemsGroup.children[0]!;
      itemsGroup.remove(ch);
      disposeObject(ch);
    }
    itemsGroup = null;
  }
  selectedId = null;
  roomEngineStore.getState().setSelectedItemId(null);
}
