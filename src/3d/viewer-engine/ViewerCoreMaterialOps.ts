import * as THREE from "three";
import type { BoxPanelIds, TechnicalDrillHole } from "../../core/types";
import type { DrawerLayerItem } from "../../models/BoxLayers";
import type { LoadedWoodMaterial } from "../materials/WoodMaterial";
import { createDoorObject, getDoorSpecFromGroup } from "../objects/BoxBuilder";
import {
  buildDrawerSpecs,
  createDrawerObject,
  getDrawerSpecFromGroup,
} from "../objects/DrawerFactory";
import { filterTechnicalDrillHolesForViewerMesh } from "./drill/viewerCncDrillFilter";
import {
  disposeLoadedWoodMaterial,
  isDoorOrDrawerFrontNode,
  isDrawerClickTargetGhost,
  isKitchenFeetNode,
} from "./materials/boxMaterialHelpers";
import {
  describeMeshMaterial,
  isDrawerFrontExteriorMesh,
  traceDrawerFrontMaterial,
} from "./materials/drawerFrontMaterialTrace";
import { createClonedMaterialWithDetailMaps } from "./materials/MaterialEngine";
import { applyMeshGrainOrientation } from "./materials/viewerGrainOrientation";
import type { ViewerState } from "./state/ViewerState";
import type { ViewerBoxEntry } from "./types";
import { devLogger } from "../../utils/devLogger";

export type ViewerCoreMaterialOpsDeps = {
  boxes: Map<string, ViewerBoxEntry>;
  loadMaterial: (materialName: string) => LoadedWoodMaterial | null;
  viewerState: ViewerState;
  refreshOutlineTarget: () => void;
  requestRender: () => void;
  appliedRotationByMeshUuid: Map<string, number>;
  applyViewerDrillHoleSceneRules: (root: THREE.Object3D) => void;
  applyPanelIdsToBox: (
    root: THREE.Object3D,
    boxId: string,
    panelIds?: Partial<BoxPanelIds> | null,
    materialPresetId?: string
  ) => void;
  applyPanelVisibilityForObject: (root: THREE.Object3D) => void;
  defaultMaterialName: string;
};

/** Localiza a malha `frente-fixa` filha directa do root da caixa. */
export function findFixedFrontPanelImpl(root: THREE.Object3D): THREE.Mesh | undefined {
  return root.children.find(
    (c) => c instanceof THREE.Mesh && c.name === "frente-fixa"
  ) as THREE.Mesh | undefined;
}

export function updateBoxMaterialImpl(
  deps: ViewerCoreMaterialOpsDeps,
  id: string,
  materialName: string
): void {
  const entry = deps.boxes.get(id);
  if (!entry) return;
  const nextMaterial = deps.loadMaterial(materialName);
  if (!nextMaterial) return;

  entry.materialName = materialName;

  if (entry.mesh instanceof THREE.Group) {
    entry.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (isKitchenFeetNode(child)) return;
        // Click-target legado: nunca matéria do módulo (película fantasma).
        if (isDrawerClickTargetGhost(child)) return;
        // Nunca escrever matéria do módulo em frentes independentes.
        if (isDoorOrDrawerFrontNode(child) || isDrawerFrontExteriorMesh(child)) {
          traceDrawerFrontMaterial("updateBoxMaterial.SKIP_front", {
            boxId: id,
            moduleMaterial: materialName,
            mesh: describeMeshMaterial(child),
          });
          return;
        }
        if (child.userData?.isDrawerFrontExteriorCap === true) return;
        const childName = typeof child.name === "string" ? child.name : "";
        if (
          childName === "frente-fixa" ||
          childName.startsWith("frente-fixa") ||
          childName.startsWith("drawer-front-")
        ) {
          return;
        }
        if (child.userData?.drawerLayerId && child.userData?.drawerPart === "front") {
          return;
        }
        child.material = nextMaterial.material;
      }
    });
  } else if (entry.mesh instanceof THREE.Mesh) {
    if (!isKitchenFeetNode(entry.mesh)) {
      entry.mesh.material = nextMaterial.material;
    }
  }

  if (deps.viewerState.getSelectedBox() === id) {
    deps.refreshOutlineTarget();
  }
  disposeLoadedWoodMaterial(entry.material);
  entry.material = nextMaterial;
  if (deps.viewerState.getSelectedBox() === id) {
    deps.refreshOutlineTarget();
  }
  // Sem sync automático de gaveta/frente-fixa: só updateDrawerMaterial /
  // updateFixedFrontMaterial (escolha do utilizador) controlam essas matérias.
}

/**
 * Aplica um material a uma porta específica (por boxId e doorLayerId).
 * Localiza o grupo door-layer-{doorLayerId}, extrai DoorSpec, remove a porta antiga, cria nova com createDoorObject
 * preservando doorHoles e aplica applyPanelIdsToBox para manter userData.boxId/doorLayerId para seleção e outline.
 */
export function updateDoorMaterialImpl(
  deps: ViewerCoreMaterialOpsDeps,
  boxId: string,
  doorLayerId: string,
  materialName: string
): void {
  if (import.meta.env.DEV) {
    devLogger.debug("[DOOR-MAT] ViewerCore.updateDoorMaterial", { boxId, doorLayerId, materialName });
  }
  const entry = deps.boxes.get(boxId);
  if (!entry) return;
  const nextMaterial = deps.loadMaterial(materialName);
  if (!nextMaterial) return;
  const boxGroup = entry.mesh;
  if (!(boxGroup instanceof THREE.Group)) return;

  const doorLayerNames = boxGroup.children
    .filter((c) => c.name.startsWith("door-layer-"))
    .map((c) => c.name);
  const expectedName = `door-layer-${doorLayerId}`;
  const oldDoorGroup = boxGroup.children.find(
    (c) => c.name === expectedName
  ) as THREE.Group | undefined;

  if (import.meta.env.DEV) {
    devLogger.debug("[updateDoorMaterial] diagnóstico", {
      boxId,
      doorLayerIdRecebido: doorLayerId,
      gruposDoorLayerNoBox: doorLayerNames,
      nomeEsperado: expectedName,
      encontrouGrupo: Boolean(oldDoorGroup),
      meshUuidAntes: oldDoorGroup
        ? (() => {
            let u: string | null = null;
            oldDoorGroup.traverse((n) => {
              if (n instanceof THREE.Mesh) u = n.uuid;
            });
            return u;
          })()
        : null,
    });
  }

  if (!oldDoorGroup) return;
  const spec = getDoorSpecFromGroup(oldDoorGroup);
  if (!spec) return;
  let doorHoles: TechnicalDrillHole[] | undefined;
  oldDoorGroup.traverse((node) => {
    if (node instanceof THREE.Mesh && deps.appliedRotationByMeshUuid.has(node.uuid)) {
      deps.appliedRotationByMeshUuid.delete(node.uuid);
    }
    const ud = (node as THREE.Object3D & { userData: { doorHolesEffective?: TechnicalDrillHole[] } }).userData;
    if (Array.isArray(ud?.doorHolesEffective)) doorHoles = ud.doorHolesEffective;
  });
  boxGroup.remove(oldDoorGroup);
  const doorMat = (nextMaterial.material as THREE.Material).clone();
  const newDoor = createDoorObject(
    spec,
    doorMat,
    filterTechnicalDrillHolesForViewerMesh(doorHoles)
  );
  boxGroup.add(newDoor);
  newDoor.traverse((n) => {
    if (n instanceof THREE.Mesh) {
      applyMeshGrainOrientation(n, materialName, () => deps.requestRender());
    }
  });
  deps.applyViewerDrillHoleSceneRules(newDoor);
  if (import.meta.env.DEV) {
    devLogger.debug("[DOOR-MAT] Material aplicado independentemente:", {
      id: doorLayerId,
      material: (doorMat as THREE.Material).uuid,
      textura: materialName,
    });
  }
  deps.applyPanelIdsToBox(boxGroup, boxId, undefined, entry.materialName ?? deps.defaultMaterialName);
  deps.applyPanelVisibilityForObject(boxGroup);
  if (import.meta.env.DEV) {
    let newMeshUuid: string | null = null;
    newDoor.traverse((n) => {
      if (n instanceof THREE.Mesh) newMeshUuid = n.uuid;
    });
    devLogger.debug("[updateDoorMaterial] porta reconstruída", {
      boxId,
      doorLayerId,
      newMeshUuid,
      groupName: newDoor.name,
      groupUserDataDoorLayerId: (newDoor as THREE.Object3D & { userData: { doorLayerId?: string } }).userData?.doorLayerId,
    });
  }
  if (deps.viewerState.getSelectedBox() === boxId) deps.refreshOutlineTarget();
}

/**
 * Aplica um material à frente de uma gaveta (por boxId e drawerLayerId).
 * Paridade com updateDoorMaterial: rebuild do grupo.
 * Mapas PBR: createClonedMaterialWithDetailMaps (clone + re-apply async no clone —
 * material.clone() antes do Promise dos mapas deixa a frente sem textura e vulnerável
 * a ser confundida/substituída quando os mapas do módulo chegam).
 */
export function updateDrawerMaterialImpl(
  deps: ViewerCoreMaterialOpsDeps,
  boxId: string,
  drawerLayerId: string,
  materialName: string,
  drawerLayerItems?: DrawerLayerItem[]
): void {
  traceDrawerFrontMaterial("updateDrawerMaterial.ENTER", { boxId, drawerLayerId, materialName });
  if (import.meta.env.DEV) {
    devLogger.debug("[DRAWER-MAT] ViewerCore.updateDrawerMaterial", { boxId, drawerLayerId, materialName });
  }
  const entry = deps.boxes.get(boxId);
  if (!entry) return;
  const frontMat = createClonedMaterialWithDetailMaps(materialName, {
    onMapsApplied: () => {
      traceDrawerFrontMaterial("updateDrawerMaterial.MAPS_APPLIED", {
        boxId,
        drawerLayerId,
        materialName,
      });
      deps.requestRender();
    },
  });
  if (!frontMat) return;
  const boxGroup = entry.mesh;
  if (!(boxGroup instanceof THREE.Group)) return;

  const expectedName = `drawer-layer-${drawerLayerId}`;
  const oldDrawerGroup = boxGroup.children.find(
    (c) => c.name === expectedName
  ) as THREE.Group | undefined;

  if (import.meta.env.DEV) {
    devLogger.debug("[updateDrawerMaterial] diagnóstico", {
      boxId,
      drawerLayerIdRecebido: drawerLayerId,
      nomeEsperado: expectedName,
      encontrouGrupo: Boolean(oldDrawerGroup),
    });
  }

  if (!oldDrawerGroup) return;
  let spec = getDrawerSpecFromGroup(oldDrawerGroup);
  if (!spec && drawerLayerItems?.length) {
    const fromItems = buildDrawerSpecs(drawerLayerItems).find((s) => s.id === drawerLayerId);
    if (fromItems) spec = fromItems;
  }
  if (!spec) return;

  oldDrawerGroup.traverse((node) => {
    if (node instanceof THREE.Mesh && deps.appliedRotationByMeshUuid.has(node.uuid)) {
      deps.appliedRotationByMeshUuid.delete(node.uuid);
    }
  });
  boxGroup.remove(oldDrawerGroup);

  const bodyMaterialName = entry.materialName ?? deps.defaultMaterialName;
  const bodyLoaded = deps.loadMaterial(bodyMaterialName);
  const bodyMat = bodyLoaded
    ? (bodyLoaded.material as THREE.Material).clone()
    : frontMat.clone();

  const newDrawer = createDrawerObject(spec, {
    front: frontMat,
    body: bodyMat,
    frontMaterialId: materialName,
  });
  boxGroup.add(newDrawer);
  newDrawer.traverse((n) => {
    if (
      n instanceof THREE.Mesh &&
      (n.userData as { drawerPart?: string }).drawerPart === "front"
    ) {
      traceDrawerFrontMaterial("updateDrawerMaterial.FRONT_ASSIGNED", {
        boxId,
        drawerLayerId,
        materialName,
        mesh: describeMeshMaterial(n),
      });
      applyMeshGrainOrientation(n, materialName, () => deps.requestRender());
    }
  });
  deps.applyViewerDrillHoleSceneRules(newDrawer);
  if (import.meta.env.DEV) {
    devLogger.debug("[DRAWER-MAT] Material aplicado independentemente:", {
      id: drawerLayerId,
      material: frontMat.uuid,
      textura: materialName,
    });
  }
  deps.applyPanelIdsToBox(boxGroup, boxId, undefined, entry.materialName ?? deps.defaultMaterialName);
  deps.applyPanelVisibilityForObject(boxGroup);
  if (deps.viewerState.getSelectedBox() === boxId) deps.refreshOutlineTarget();
  deps.requestRender();
}

/**
 * Facade unificada para matérias de frente (porta / gaveta / frente fixa).
 * Delega nos updaters existentes — sem novo pipeline.
 */
export function updateFrontMaterialImpl(
  deps: ViewerCoreMaterialOpsDeps,
  partType: "door" | "drawer-front" | "fixed-front",
  boxId: string,
  materialName: string,
  layerId?: string,
  drawerLayerItems?: DrawerLayerItem[]
): void {
  if (partType === "door") {
    if (!layerId) return;
    updateDoorMaterialImpl(deps, boxId, layerId, materialName);
    return;
  }
  if (partType === "drawer-front") {
    if (!layerId) return;
    updateDrawerMaterialImpl(deps, boxId, layerId, materialName, drawerLayerItems);
    return;
  }
  updateFixedFrontMaterialImpl(deps, boxId, materialName);
}

/** Aplica material independente à peça frente-fixa (canto v2). */
export function updateFixedFrontMaterialImpl(
  deps: ViewerCoreMaterialOpsDeps,
  boxId: string,
  materialName: string
): void {
  const entry = deps.boxes.get(boxId);
  if (!entry) return;
  const ffPanel = findFixedFrontPanelImpl(entry.mesh);
  if (!ffPanel) return;
  const nextMaterial = deps.loadMaterial(materialName);
  if (!nextMaterial) return;
  ffPanel.material = (nextMaterial.material as THREE.Material).clone();
  applyMeshGrainOrientation(ffPanel, materialName, () => deps.requestRender());
  (ffPanel.userData as Record<string, unknown>).frenteFixaMaterialId = materialName;
  entry.frenteFixaMaterialId = materialName;
  deps.requestRender();
  if (deps.viewerState.getSelectedBox() === boxId) deps.refreshOutlineTarget();
}
