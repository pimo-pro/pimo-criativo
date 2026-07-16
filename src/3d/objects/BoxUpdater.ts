import * as THREE from "three";
import type { PanelMaterialOptions } from "./BoxMaterialApplier";
import type { BoxModel, BoxOptions, BoxPanelLayoutSpecs } from "./BoxBuilder";
import type { DoorSpec } from "./DoorFactory";
import type { DrawerSpec } from "./DrawerFactory";
import { resolveDrawerFrontMaterialId } from "../../core/drawers/drawerFrontMaterial";
import type { DoorLayerItem, DrawerLayerItem } from "../../models/BoxLayers";
import type { TechnicalDrillHole } from "../../core/types";
import { isPiBaseCabinetId } from "../../data/moveisUnificados/pi/models";
import {
  computeWardrobeLocalLayout,
  getWardrobeGroupFromBaseCabinetId,
  hasWardrobeLowerDrawers,
} from "../../core/wardrobe/wardrobeRules";
import { getDivSepMeshSpecs } from "../../core/divSep/visualSpecs";
import { resolveNoBackPanelFromOptions } from "../../core/box/backPanelFlags";
import { DISABLE_DRAWER_RENDERING } from "./drawerRenderingFlags";
import type { PanelType } from "./PanelFactory";
import {
  resolveDivisorViewerDrillHoles,
  resolveDivisorViewerPanelType,
} from "../viewer-engine/drill/divSepViewerDrillLookup";

type BoxUpdaterDeps = {
  resolveDimensions: (_options?: BoxOptions) => { width: number; height: number; depth: number };
  getPanelSpecs: (_width: number, _height: number, _depth: number) => BoxPanelLayoutSpecs;
  getShelfSpecs: (
    _width: number,
    _height: number,
    _depth: number,
    _shelves?: number,
    _opts?: BoxOptions
  ) => Array<{ size: [number, number, number]; pos: [number, number, number] }>;
  panelFactory: {
    createPanel: (
      _width: number,
      _height: number,
      _depth: number,
      _name: string,
      _panelType: PanelType,
      _options?: PanelMaterialOptions | null
    ) => THREE.Mesh;
    updatePanelGeometry: (_mesh: THREE.Mesh, _w: number, _h: number, _d: number) => void;
  };
  getFallbackPBRMaterial: () => THREE.Material;
  applyDrillHolesToPanelGeometry: (_panel: THREE.Mesh, _panelType: PanelType, _holes: TechnicalDrillHole[] | undefined) => void;
  buildDoorSpecs: (_items: DoorLayerItem[]) => DoorSpec[];
  buildDrawerSpecs: (
    _items: DrawerLayerItem[],
    _options?: { showDrillingMarkers?: boolean; profundidadeUtilM?: number }
  ) => DrawerSpec[];
  getDoorSpecFingerprint: (_spec: DoorSpec, _materialName?: string) => string;
  getDrawerSpecFingerprint: (_spec: DrawerSpec, _materialName?: string) => string;
  getDrawerStructureFingerprint: (
    _spec: DrawerSpec,
    _materials?: import("./DrawerFactory").DrawerStructureMaterials | string
  ) => string;
  getDrawerMotionKey: (_spec: Pick<DrawerSpec, "isOpen" | "pullDistanceM">) => string;
  syncDrawerLayerMotion: (_drawerLayerGroup: THREE.Object3D, _spec: DrawerSpec) => boolean;
  createDoorObject: (_spec: DoorSpec, _material: THREE.Material, _doorHoles?: TechnicalDrillHole[]) => THREE.Object3D;
  createDrawerObject: (
    _spec: DrawerSpec,
    _materials: import("./DrawerFactory").DrawerObjectMaterials | THREE.Material
  ) => THREE.Object3D;
  getMaterialForOfficialId: (_idOrLabel: string) => THREE.Material;
  getDefaultOfficialMaterialId: () => string;
  thicknessM: number;
  panelNames: readonly string[];
  lastDimsKey: string;
  doorSpecFingerprintKey: string;
  drawerSpecFingerprintKey: string;
};

export function dimensionsEqual(a: { width: number; height: number; depth: number }, b: { width: number; height: number; depth: number }): boolean {
  return Math.abs(a.width - b.width) < 1e-9 && Math.abs(a.height - b.height) < 1e-9 && Math.abs(a.depth - b.depth) < 1e-9;
}

const LATERAL_PANEL_NAMES = ["left", "right"] as const;

function disposePanelGeometry(panel: THREE.Mesh): void {
  panel.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      child.geometry.dispose();
    }
  });
}

/** Mantém um único mesh estrutural por nome; remove duplicados do grupo. */
function dedupeStructuralPanel(group: THREE.Group, panelName: string): THREE.Mesh | undefined {
  const matches = group.children.filter(
    (c): c is THREE.Mesh => c instanceof THREE.Mesh && c.name === panelName
  );
  if (matches.length === 0) return undefined;
  const [keeper, ...duplicates] = matches;
  for (const duplicate of duplicates) {
    group.remove(duplicate);
    disposePanelGeometry(duplicate);
  }
  return keeper;
}

function applyLateralPanelLayout(
  panel: THREE.Mesh,
  panelName: (typeof LATERAL_PANEL_NAMES)[number],
  spec: { size: readonly [number, number, number]; pos: readonly [number, number, number] },
  panelFactory: BoxUpdaterDeps["panelFactory"]
): void {
  panelFactory.updatePanelGeometry(panel, spec.size[0], spec.size[1], spec.size[2]);
  panel.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
  panel.rotation.y = panelName === "right" ? Math.PI : 0;
  panel.rotation.z = 0;
  delete (panel.userData as Record<string, unknown>).explodedBasePosition;
  panel.updateMatrix();
}

function ensureLateralPanel(
  group: THREE.Group,
  panelName: (typeof LATERAL_PANEL_NAMES)[number],
  spec: { size: readonly [number, number, number]; pos: readonly [number, number, number] },
  mat: THREE.Material,
  deps: BoxUpdaterDeps
): THREE.Mesh {
  let panel = dedupeStructuralPanel(group, panelName);
  if (!panel) {
    panel = deps.panelFactory.createPanel(
      spec.size[0],
      spec.size[1],
      spec.size[2],
      panelName,
      panelName,
      { singleMaterial: mat }
    );
    group.add(panel);
  }
  applyLateralPanelLayout(panel, panelName, spec, deps.panelFactory);
  return panel;
}

export function updateBoxModelWithDeps(model: BoxModel, options: BoxOptions | undefined, deps: BoxUpdaterDeps): BoxModel {
  const opts = options ?? {};
  const { width, height, depth } = deps.resolveDimensions(opts);
  const material = opts.material ?? model.panels.left.material;
  const specs = deps.getPanelSpecs(width, height, depth);
  const skipBack = resolveNoBackPanelFromOptions(opts);
  const panelKeys: (keyof typeof model.panels)[] = ["left", "right", "top", "bottom", "back"];
  panelKeys.forEach((key) => {
    if (key === "back" && skipBack) {
      if (model.panels.back.parent) model.panels.back.parent.remove(model.panels.back);
      return;
    }
    const [wx, hy, dz] = specs[key].size;
    const [px, py, pz] = specs[key].pos;
    deps.panelFactory.updatePanelGeometry(model.panels[key], wx, hy, dz);
    model.panels[key].position.set(px, py, pz);
    if (key === "right") {
      model.panels[key].rotation.y = Math.PI;
      // Manter Y consistente entre porta e lateral: não inverter no eixo Z.
      model.panels[key].rotation.z = 0;
    } else {
      model.panels[key].rotation.y = 0;
      model.panels[key].rotation.z = 0;
    }
  });
  if (opts.material != null) {
    Object.values(model.panels).forEach((panel) => {
      (panel as THREE.Mesh).material = material as THREE.Material;
    });
  }
  model.dimensions = { width, height, depth, thickness: deps.thicknessM };
  return model;
}

export function updateBoxGroupWithDeps(group: THREE.Group, options: BoxOptions | undefined, deps: BoxUpdaterDeps): { width: number; height: number; depth: number } {
  const opts = options ?? {};
  const { width, height, depth } = deps.resolveDimensions(opts);
  const dims = { width, height, depth };
  const lastDims = (group.userData as Record<string, unknown>)[deps.lastDimsKey] as { width: number; height: number; depth: number } | undefined;
  const dimensionsUnchanged = lastDims != null && dimensionsEqual(lastDims, dims);
  (group.userData as Record<string, unknown>)[deps.lastDimsKey] = dims;

  const specs = deps.getPanelSpecs(width, height, depth);
  const skipBack = resolveNoBackPanelFromOptions(opts);
  const baseMaterial = group.children[0] instanceof THREE.Mesh ? (group.children[0] as THREE.Mesh).material : deps.getFallbackPBRMaterial();
  const mat = Array.isArray(baseMaterial) ? baseMaterial[0] : baseMaterial;

  let backPanel = group.children.find((c) => c instanceof THREE.Mesh && c.name === "back") as THREE.Mesh | undefined;
  if (skipBack) {
    if (backPanel) group.remove(backPanel);
    backPanel = undefined;
  } else if (!backPanel) {
    backPanel = deps.panelFactory.createPanel(
      specs.back.size[0],
      specs.back.size[1],
      specs.back.size[2],
      "back",
      "back",
      { singleMaterial: mat as THREE.Material }
    );
    group.add(backPanel);
  }

  const drillMap = opts.drillMarkersByPanel ?? { cima: [], fundo: [], lateral_esquerda: [], lateral_direita: [], porta: [], frente_fixa: [] };
  const shelfCountForDrill = Math.max(0, Math.floor(opts.shelves ?? 0));
  // Roupeiro: prateleiras existem na zona superior mesmo que existam gavetas na zona inferior.
  const useLateralShelfHoles = shelfCountForDrill > 0;
  const hasLateralDrillMarkers =
    (drillMap.lateral_esquerda?.length ?? 0) > 0 || (drillMap.lateral_direita?.length ?? 0) > 0;
  const forcePiLateralDrillGeometry = isPiBaseCabinetId(opts.baseCabinetId);
  const applyLateralDrillHoles =
    forcePiLateralDrillGeometry || hasLateralDrillMarkers || useLateralShelfHoles;
  const lateralLeftHoles = applyLateralDrillHoles
    ? drillMap.lateral_esquerda
    : [];
  const lateralRightHoles = applyLateralDrillHoles
    ? drillMap.lateral_direita
    : [];

  const leftPanel = ensureLateralPanel(group, "left", specs.left, mat as THREE.Material, deps);
  const rightPanel = ensureLateralPanel(group, "right", specs.right, mat as THREE.Material, deps);

  if (!dimensionsUnchanged) {
    for (const panelName of deps.panelNames) {
      if (panelName === "back" && skipBack) continue;
      if (panelName === "left" || panelName === "right") continue;
      const child = group.children.find((c) => c.name === panelName);
      if (!(child instanceof THREE.Mesh) || !child.geometry) continue;
      const spec = specs[panelName as keyof BoxPanelLayoutSpecs];
      if (!spec) continue;
      deps.panelFactory.updatePanelGeometry(child, spec.size[0], spec.size[1], spec.size[2]);
      child.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
      child.rotation.y = 0;
      child.rotation.z = 0;
      delete (child.userData as Record<string, unknown>).explodedBasePosition;
      child.updateMatrix();
    }
  }

  const topPanel = group.children.find((c) => c instanceof THREE.Mesh && c.name === "top") as THREE.Mesh | undefined;
  const bottomPanel = group.children.find((c) => c instanceof THREE.Mesh && c.name === "bottom") as THREE.Mesh | undefined;
  if (topPanel) deps.applyDrillHolesToPanelGeometry(topPanel, "top", drillMap.cima);
  if (bottomPanel) deps.applyDrillHolesToPanelGeometry(bottomPanel, "bottom", drillMap.fundo);
  if (leftPanel) deps.applyDrillHolesToPanelGeometry(leftPanel, "left", lateralLeftHoles);
  if (rightPanel) deps.applyDrillHolesToPanelGeometry(rightPanel, "right", lateralRightHoles);

  const ffPanel = group.children.find(
    (c) => c instanceof THREE.Mesh && c.name === "frente-fixa"
  ) as THREE.Mesh | undefined;
  const ffHoles = drillMap.frente_fixa ?? [];
  const ffMaterialId =
    typeof opts.frenteFixaMaterialId === "string" && opts.frenteFixaMaterialId.trim().length > 0
      ? opts.frenteFixaMaterialId.trim()
      : typeof opts.bodyMaterialId === "string" && opts.bodyMaterialId.trim().length > 0
        ? opts.bodyMaterialId.trim()
        : typeof opts.materialName === "string" && opts.materialName.trim().length > 0
          ? opts.materialName.trim()
          : deps.getDefaultOfficialMaterialId();
  if (ffPanel) {
    const ffUserData = ffPanel.userData as Record<string, unknown>;
    if (ffUserData.frenteFixaMaterialId !== ffMaterialId) {
      const ffMat = deps.getMaterialForOfficialId(ffMaterialId) as THREE.Material;
      ffPanel.material = ffMat;
      ffUserData.frenteFixaMaterialId = ffMaterialId;
    }
    if (ffHoles.length > 0) {
      deps.applyDrillHolesToPanelGeometry(ffPanel, "front", ffHoles);
    }
  }

  const doorLayerItems = Array.isArray(opts.doorLayerItems) ? opts.doorLayerItems : [];
  const doorSpecs = deps.buildDoorSpecs(doorLayerItems);
  const requiredDoorIds = new Set(doorSpecs.map((s) => s.id));
  for (const c of group.children.filter((c) => c.name.startsWith("door-layer-"))) {
    const id = c.name.replace("door-layer-", "");
    if (!requiredDoorIds.has(id)) group.remove(c);
  }
  doorSpecs.forEach((spec, doorIndex) => {
    const item = doorLayerItems[doorIndex];
    const materialName = item?.material ?? item?.materialId ?? deps.getDefaultOfficialMaterialId();
    const newFingerprint = deps.getDoorSpecFingerprint(spec, materialName);
    const existingDoor = group.children.find((c) => c.name === `door-layer-${spec.id}`) as THREE.Object3D | undefined;
    const doorUserData = existingDoor?.userData as Record<string, unknown> | undefined;
    if (doorUserData?.[deps.doorSpecFingerprintKey] === newFingerprint) return;
    if (existingDoor) group.remove(existingDoor);
    const doorMaterial = deps.getMaterialForOfficialId(materialName);
    const newDoor = deps.createDoorObject(spec, doorMaterial as THREE.Material, drillMap.portaPerDoor?.[doorIndex] ?? drillMap.porta);
    (newDoor.userData as Record<string, unknown>)[deps.doorSpecFingerprintKey] = newFingerprint;
    group.add(newDoor);
  });

  const drawerLayerItems = Array.isArray(opts.drawerLayerItems) ? opts.drawerLayerItems : [];
  if (DISABLE_DRAWER_RENDERING) {
    for (const c of group.children.filter((child) => child.name.startsWith("drawer-layer-"))) {
      group.remove(c);
    }
  } else {
    const drawerSpecs = deps.buildDrawerSpecs(drawerLayerItems, {
      showDrillingMarkers: opts.showDrawerDrilling === true,
      profundidadeUtilM: opts.carcassDepthM ?? depth,
    });
    const requiredDrawerIds = new Set(drawerSpecs.map((s) => s.id));
    for (const c of group.children.filter((c) => c.name.startsWith("drawer-layer-"))) {
      const id = c.name.replace("drawer-layer-", "");
      if (!requiredDrawerIds.has(id)) group.remove(c);
    }
    drawerSpecs.forEach((spec, drawerIndex) => {
      const drawerItem = drawerLayerItems[drawerIndex];
      const defaultMaterialId = deps.getDefaultOfficialMaterialId();
      const bodyMaterialId =
        typeof opts.materialName === "string" && opts.materialName.trim().length > 0
          ? opts.materialName.trim()
          : defaultMaterialId;
      const frontMaterialId = resolveDrawerFrontMaterialId(drawerItem, bodyMaterialId);
      const structureFingerprint = deps.getDrawerStructureFingerprint(spec, {
        frontMaterial: frontMaterialId,
        bodyMaterial: bodyMaterialId,
      });
      const motionKey = deps.getDrawerMotionKey(spec);
      const existingDrawer = group.children.find((c) => c.name === `drawer-layer-${spec.id}`) as THREE.Object3D | undefined;
      const drawerUserData = existingDrawer?.userData as Record<string, unknown> | undefined;
      if (existingDrawer && drawerUserData?.[deps.drawerSpecFingerprintKey] === structureFingerprint) {
        if (drawerUserData?.drawerMotionKey !== motionKey) {
          deps.syncDrawerLayerMotion(existingDrawer, spec);
          drawerUserData.drawerMotionKey = motionKey;
        }
        return;
      }
      if (existingDrawer) group.remove(existingDrawer);
      const frontMaterial = deps.getMaterialForOfficialId(frontMaterialId);
      const bodyMaterial = deps.getMaterialForOfficialId(bodyMaterialId);
      const newDrawer = deps.createDrawerObject(spec, {
        front: frontMaterial as THREE.Material,
        body: bodyMaterial as THREE.Material,
        frontMaterialId,
      });
      const newUserData = newDrawer.userData as Record<string, unknown>;
      newUserData[deps.drawerSpecFingerprintKey] = structureFingerprint;
      newUserData.drawerMotionKey = motionKey;
      group.add(newDrawer);
      newDrawer.traverse((child) => {
        if (
          child instanceof THREE.Mesh &&
          (child as THREE.Mesh & { userData: { drawerPart?: string } }).userData?.drawerPart === "front"
        ) {
          child.userData.drawerFrontMaterialId = frontMaterialId;
        }
      });
    });
  }

  const shelfCount = Math.max(0, Math.floor(opts.shelves ?? 0));
  const shelfSpecs = deps.getShelfSpecs(width, height, depth, shelfCount, opts);
  group.children.filter((c) => /^shelf-\d+$/.test(c.name)).forEach((obj) => group.remove(obj));
  shelfSpecs.forEach((spec, i) => {
    const shelfMat = mat as THREE.Material;
    const mesh = deps.panelFactory.createPanel(spec.size[0], spec.size[1], spec.size[2], `shelf-${i}`, "top", { singleMaterial: shelfMat });
    mesh.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
    mesh.userData.shelfIndex = i;
    group.add(mesh);
  });

  group.children.filter((c) => c.name.startsWith("divsep-")).forEach((obj) => group.remove(obj));
  const divSepBoxLike = {
    dimensoes: {
      largura: width * 1000,
      altura: height * 1000,
      profundidade: (opts.layoutDepthM ?? depth) * 1000,
    },
    espessura: deps.thicknessM * 1000,
    profundidadeExterna: (opts.layoutDepthM ?? depth) * 1000,
    divisores: opts.divisores ?? [],
    separadores: opts.separadores ?? [],
  };
  let divSepDivIndex = 0;
  getDivSepMeshSpecs(divSepBoxLike, width, height, depth, deps.thicknessM).forEach((spec) => {
    const mesh = deps.panelFactory.createPanel(
      spec.size[0],
      spec.size[1],
      spec.size[2],
      spec.name,
      "top",
      { singleMaterial: mat as THREE.Material }
    );
    mesh.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
    mesh.userData.divSepId = spec.name;
    if (spec.name.startsWith("divsep-sep-")) {
      mesh.userData.divSepKind = "sep";
      const sepItemId = spec.name.slice("divsep-sep-".length);
      mesh.userData.divSepItemId = sepItemId;
      const sepHoles = drillMap.separadoresById?.[sepItemId];
      if (sepHoles?.length) {
        deps.applyDrillHolesToPanelGeometry(mesh, "top", sepHoles);
      }
    } else if (spec.name.startsWith("divsep-div-")) {
      mesh.userData.divSepKind = "div";
      const divItemId = spec.name.slice("divsep-div-".length);
      const divIndex = divSepDivIndex;
      divSepDivIndex += 1;
      mesh.userData.divSepItemId = divItemId;
      mesh.userData.divSepIndex = divIndex;
      const divHoles = resolveDivisorViewerDrillHoles(drillMap.divisoresById, {
        divItemId,
        divIndex,
        panelIds: opts.panelIds,
      });
      const lado = opts.divisores?.[divIndex]?.prateleiraLado;
      const drillPanelType = resolveDivisorViewerPanelType(lado);
      if (divHoles.length) {
        deps.applyDrillHolesToPanelGeometry(mesh, drillPanelType, divHoles);
      }
    }
    group.add(mesh);
  });

  // Roupeiro (H/J): reconstruir divisores e varões de cabides na renderização incremental.
  const wardrobeGroup = getWardrobeGroupFromBaseCabinetId(opts.baseCabinetId);
  if (wardrobeGroup && wardrobeGroup !== "T") {
    group.children
      .filter((c) => c.name.startsWith("wardrobe-divider-") || c.name.startsWith("wardrobe-rail-"))
      .forEach((c) => group.remove(c));

    const feetHeightMm = Math.max(40, opts.feetHeight ?? (opts.pe_cm ?? 10) * 10);
    const widthMm = width * 1000;
    const heightMm = height * 1000;
    const depthMm = depth * 1000;

    const layout = computeWardrobeLocalLayout({
      baseCabinetId: opts.baseCabinetId,
      widthMm,
      heightMm,
      depthMm,
      feetHeightMm,
    });

    const dividerMat = mat as THREE.Material;

    if (layout.horizontalDividerCenterY_mm != null) {
      const dividerH = new THREE.Mesh(
        new THREE.BoxGeometry(width, deps.thicknessM, depth),
        dividerMat
      );
      dividerH.name = "wardrobe-divider-horizontal";
      dividerH.position.set(0, layout.horizontalDividerCenterY_mm / 1000, 0);
      group.add(dividerH);
    }

    if (layout.verticalDividerEnabled) {
      const dividerV = new THREE.Mesh(
        new THREE.BoxGeometry(deps.thicknessM, height, depth),
        dividerMat
      );
      dividerV.name = "wardrobe-divider-vertical";
      dividerV.position.set((layout.verticalDividerCenterX_mm ?? 0) / 1000, 0, 0);
      group.add(dividerV);
    }

    const hasDrawersLower = hasWardrobeLowerDrawers(opts.baseCabinetId);
    const railThicknessM = 6 / 1000;
    const railRadiusM = Math.max(0.001, railThicknessM / 2);
    const railZ = layout.shelfAndRailCenterZ_mm / 1000;
    const railY = layout.lowerCabideCenterY_mm != null ? layout.lowerCabideCenterY_mm / 1000 : -height / 4;

    const createRail = (name: string, x: number, lengthM: number) => {
      const cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(railRadiusM, railRadiusM, Math.max(0.001, lengthM), 12),
        dividerMat
      );
      cyl.name = name;
      cyl.position.set(x, railY, railZ);
      cyl.rotation.z = Math.PI / 2;
      group.add(cyl);
    };

    if (layout.verticalDividerEnabled) {
      const leftX = layout.leftCompartmentCenterX_mm / 1000;
      const rightX = layout.rightCompartmentCenterX_mm / 1000;
      const lenLeft = layout.railWidthPerSide_mm / 1000;
      const lenRight = layout.railWidthPerSide_mm / 1000;
      if (hasDrawersLower) {
        createRail("wardrobe-rail-left", leftX, lenLeft);
      } else {
        createRail("wardrobe-rail-left", leftX, lenLeft);
        createRail("wardrobe-rail-right", rightX, lenRight);
      }
    } else {
      createRail("wardrobe-rail-center", 0, layout.railWidthFull_mm / 1000);
    }
  } else {
    group.children
      .filter((c) => c.name.startsWith("wardrobe-divider-") || c.name.startsWith("wardrobe-rail-"))
      .forEach((c) => group.remove(c));
  }

  group.updateMatrixWorld(true);
  return { width, height, depth };
}

export function updateBoxGeometryWithDeps(mesh: THREE.Mesh, options: BoxOptions | undefined, deps: BoxUpdaterDeps): { width: number; height: number; depth: number } {
  const { width, height, depth } = deps.resolveDimensions(options);
  mesh.geometry.dispose();
  const geometry = new THREE.BoxGeometry(width, height, depth);
  if (!geometry.attributes.uv2 && geometry.attributes.uv) geometry.setAttribute("uv2", geometry.attributes.uv);
  mesh.geometry = geometry;
  return { width, height, depth };
}
