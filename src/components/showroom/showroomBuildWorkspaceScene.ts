/**
 * Constrói um THREE.Group com a mesma geometria paramétrica que o Viewer (buildBoxLegacy + drillMarkers).
 * Usado apenas no showroom (sem ViewerCore).
 */

import * as THREE from "three";
import type { ProjectState } from "../../context/projectTypes";
import type { WorkspaceBox } from "../../core/types";
import { convertWorkspaceToBox } from "../../context/projectState";
import { buildBoxLegacy, type BoxOptions } from "../../3d/objects/BoxBuilder";
import { filterViewerDrillMarkersForMesh } from "../../3d/viewer-engine/drill/viewerCncDrillFilter";
import { cutlistComPrecoFromBox } from "../../core/manufacturing/cutlistFromBoxes";
import { buildViewerDrillMarkersByPanel } from "../../modules/drilling/drillingAdapter";
import { getViewerMaterialId } from "../../core/materials/service";
import { isPiBaseCabinetId } from "../../data/moveisUnificados/pi/models";
import { mmToM } from "../../utils/units";
import { getBoxPositionAndRotation } from "../../hooks/useCalculadoraSync";
import { getProfundidadeInternaUtilMm } from "../../core/box/boxDepthHelpers";
import { resolveCostaThicknessMm } from "../../core/materials/materials.api";
import { resolveCostaAtivaForBox, resolveNoBackPanel } from "../../core/box/backPanelFlags";
import { buildCornerDoorLayerItems, getCornerCabinetConfig, migrateCornerDireitaInferiorBoxToV2, syncCornerWorkspaceBoxDoorsLayer } from "../../core/cornerCabinet";
import { doorLayerItemsForViewer } from "../../core/box/doorLayerItemsForViewer";
import { attachKitchenFeetIfNeeded } from "./kitchenFeetVisual";

export function disposeShowroomObject3D(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose();
      const m = child.material;
      if (Array.isArray(m)) {
        m.forEach((x) => x.dispose?.());
      } else {
        (m as THREE.Material | undefined)?.dispose?.();
      }
    }
  });
}

function buildCadOnlyFallbackGroup(wsBox: WorkspaceBox): THREE.Group {
  const w = Math.max(0.05, mmToM(wsBox.dimensoes?.largura ?? 600));
  const h = Math.max(0.05, mmToM(wsBox.dimensoes?.altura ?? 720));
  const d = Math.max(0.05, mmToM(wsBox.dimensoes?.profundidade ?? 560));
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({
      color: "#7a8faf",
      metalness: 0.12,
      roughness: 0.55,
      transparent: true,
      opacity: 0.42,
    })
  );
  mesh.userData.showroomCadFallback = true;
  const g = new THREE.Group();
  g.name = `showroom-cad-${wsBox.id}`;
  g.add(mesh);
  return g;
}

function applyTransformFromWorkspace(wsBox: WorkspaceBox, target: THREE.Object3D): void {
  const pr = getBoxPositionAndRotation(wsBox);
  if (pr.position) {
    target.position.set(pr.position.x, pr.position.y, pr.position.z);
  } else {
    const altMm = wsBox.dimensoes?.altura ?? 800;
    target.position.set(
      mmToM(wsBox.posicaoX_mm ?? 0),
      mmToM(altMm / 2),
      mmToM(wsBox.posicaoZ_mm ?? 0)
    );
  }
  const rx = wsBox.rotacaoX ?? 0;
  const ry = wsBox.rotacaoY ?? (wsBox.rotacaoY_90 ? Math.PI / 2 : 0);
  const rz = wsBox.rotacaoZ ?? 0;
  target.rotation.set(rx, ry, rz);
  if (wsBox.costaRotationY != null && Number.isFinite(wsBox.costaRotationY)) {
    target.userData.costaRotationY = wsBox.costaRotationY;
  }
  target.userData.boxId = wsBox.id;
}

function applyBoxIdToSubtree(root: THREE.Object3D, boxId: string): void {
  root.traverse((node) => {
    node.userData.boxId = boxId;
  });
}

/**
 * Um grupo por caixa do workspace, com posição/rotação alinhadas ao viewer.
 */
export function buildShowroomWorkspaceSceneGroup(project: ProjectState): THREE.Group {
  const root = new THREE.Group();
  root.name = "showroom-workspace-root";
  const boxById = new Map(project.boxes.map((b) => [b.id, b]));

  for (const wsBox of project.workspaceBoxes ?? []) {
    const boxModule = boxById.get(wsBox.id);
    const cadOnly =
      !isPiBaseCabinetId(wsBox.baseCabinetId) &&
      (wsBox.models?.length ?? 0) > 0 &&
      wsBox.prateleiras === 0 &&
      wsBox.gavetas === 0;

    const boxGroup = new THREE.Group();
    boxGroup.name = `showroom-box-wrap-${wsBox.id}`;
    applyTransformFromWorkspace(wsBox, boxGroup);

    if (cadOnly) {
      const fallback = buildCadOnlyFallbackGroup(wsBox);
      boxGroup.add(fallback);
      root.add(boxGroup);
      continue;
    }

    const widthMm = Number.isFinite(wsBox.dimensoes?.largura) ? wsBox.dimensoes.largura : 600;
    const heightMm = Number.isFinite(wsBox.dimensoes?.altura) ? wsBox.dimensoes.altura : 720;
    const depthMm = Number.isFinite(wsBox.dimensoes?.profundidade) ? wsBox.dimensoes.profundidade : 560;
    const width = mmToM(widthMm);
    const height = mmToM(heightMm);
    const depth = mmToM(depthMm);
    const thicknessMm = Number.isFinite(wsBox.espessura) ? wsBox.espessura : 19;
    const thickness = mmToM(thicknessMm);

    const profundidadeExternaMm = Number(wsBox.profundidadeExterna ?? depthMm) || depthMm;
    const espessuraCostaMm = resolveCostaThicknessMm(wsBox);
    const profundidadeInternaUtilMm = getProfundidadeInternaUtilMm(
      {
        dimensoes: { profundidade: profundidadeExternaMm },
        espessura: wsBox.espessura,
        portaTipo: wsBox.portaTipo,
        doorsLayer: wsBox.doorsLayer,
        drawersLayer: wsBox.drawersLayer,
        gavetas: wsBox.gavetas,
        costaAtiva: resolveCostaAtivaForBox(wsBox),
      },
      espessuraCostaMm
    );
    const layoutDepthM = mmToM(profundidadeExternaMm);
    const carcassDepthM = mmToM(profundidadeInternaUtilMm);
    const wsBoxSynced = migrateCornerDireitaInferiorBoxToV2(syncCornerWorkspaceBoxDoorsLayer(wsBox));
    const resolvedDoors =
      getCornerCabinetConfig(wsBoxSynced.baseCabinetId) && wsBoxSynced.portaTipo === "porta_simples"
        ? buildCornerDoorLayerItems(wsBoxSynced, wsBoxSynced.doorsLayer)
        : wsBoxSynced.doorsLayer ?? [];
    const doorLayerItems = doorLayerItemsForViewer(
      resolvedDoors,
      profundidadeExternaMm,
      profundidadeInternaUtilMm
    );

    const effectiveMaterial =
      wsBox.material ?? boxModule?.material ?? project.materialId ?? project.material?.tipo ?? "mdf_branco";
    const resolvedMaterialName = getViewerMaterialId(effectiveMaterial);

    const effectiveBox = boxModule ?? convertWorkspaceToBox(wsBoxSynced);
    const cutListForBox = project.rules ? cutlistComPrecoFromBox(effectiveBox, project.rules) : [];
    const drillMarkersByPanel = filterViewerDrillMarkersForMesh(buildViewerDrillMarkersByPanel(cutListForBox));

    const shelves = Number.isFinite(wsBox.prateleiras) ? Math.max(0, wsBox.prateleiras) : 0;
    const cabinetType =
      wsBox.cabinetType === "lower" || wsBox.cabinetType === "upper" ? wsBox.cabinetType : undefined;
    const feetHeight = Math.max(40, wsBox.feetHeight ?? (wsBox.pe_cm ?? 10) * 10);
    const feetOffsetFront = Math.max(0, wsBox.feetOffsetFront ?? 100);
    const pe_cm = feetHeight / 10;
    const feetEnabled = wsBox.feetEnabled ?? cabinetType === "lower";
    const useCabinetLock = cabinetType === "lower" && feetEnabled;

    const cabinetOpts: Partial<BoxOptions> = useCabinetLock
      ? { cabinetType, pe_cm, feetEnabled, feetHeight, feetOffsetFront }
      : { cabinetType: null, pe_cm, feetEnabled, feetHeight, feetOffsetFront };

    const extra: Partial<BoxOptions> = {};
    if (wsBox.autoRotateEnabled === false) {
      extra.autoRotateEnabled = false;
    }
    if (wsBox.baseCabinetId) {
      extra.baseCabinetId = wsBox.baseCabinetId;
    }

    const boxOptions: BoxOptions = {
      width,
      height,
      depth,
      layoutDepthM,
      carcassDepthM,
      thickness,
      panelIds: wsBox.panelIds,
      shelves,
      materialName: resolvedMaterialName,
      doorLayerItems,
      drawerLayerItems: wsBox.drawersLayer ?? [],
      drillMarkersByPanel,
      divisores: wsBox.divisores,
      separadores: wsBox.separadores,
      shelfOptions: wsBox.shelfOptions,
      noBackPanel: resolveNoBackPanel(wsBox),
      costaMaterialId: wsBox.costaMaterialId,
      separadorMaterialId: wsBox.separadorMaterialId,
      locked: wsBox.locked === true,
      ...cabinetOpts,
      ...extra,
    };

    const parametric = buildBoxLegacy(boxOptions);
    parametric.name = wsBox.id;
    parametric.userData.boxId = wsBox.id;
    applyBoxIdToSubtree(parametric, wsBox.id);
    if (wsBox.costaRotationY != null && Number.isFinite(wsBox.costaRotationY)) {
      parametric.userData.costaRotationY = wsBox.costaRotationY;
    }
    attachKitchenFeetIfNeeded(
      parametric,
      width,
      height,
      depth,
      feetEnabled,
      mmToM(feetHeight),
      mmToM(feetOffsetFront)
    );
    boxGroup.add(parametric);
    root.add(boxGroup);
  }

  return root;
}
