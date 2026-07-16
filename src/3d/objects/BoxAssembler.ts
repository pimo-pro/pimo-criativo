import * as THREE from "three";
import type { PanelMaterialOptions } from "./BoxMaterialApplier";
import type { BoxModel, BoxOptions, BoxPanelLayoutSpecs } from "./BoxBuilder";
import type { DoorSpec } from "./DoorFactory";
import type { DrawerSpec } from "./DrawerFactory";
import type { DoorLayerItem, DrawerLayerItem } from "../../models/BoxLayers";
import type { TechnicalDrillHole } from "../../core/types";
import { isPiBaseCabinetId } from "../../data/moveisUnificados/pi/models";
import type { PanelType } from "./PanelFactory";
import {
  computeWardrobeLocalLayout,
  getWardrobeGroupFromBaseCabinetId,
  hasWardrobeLowerDrawers,
} from "../../core/wardrobe/wardrobeRules";
import {
  getCornerCabinetConfig,
  resolveCornerSideForBox,
  computeCornerVisualLayout,
} from "../../core/cornerCabinet";
import { getSettings } from "../../core/settings/settingsService";
import { getDivSepMeshSpecs } from "../../core/divSep/visualSpecs";
import { isCaixaFornoBox } from "../../core/moveis/generators/caixaFornoGenerator";
import { renderCaixaForno } from "../../core/moveis/viewer/renderCaixaForno";
import { resolveDrawerFrontMaterialId } from "../../core/drawers/drawerFrontMaterial";
import { resolveNoBackPanelFromOptions } from "../../core/box/backPanelFlags";
import { DISABLE_DRAWER_RENDERING } from "./drawerRenderingFlags";
import {
  resolveDivisorViewerDrillHoles,
  resolveDivisorViewerPanelType,
} from "../viewer-engine/drill/divSepViewerDrillLookup";

type BoxAssemblerDeps = {
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
  };
  getFallbackPBRMaterial: () => THREE.Material;
  getEdgeMaterial: () => THREE.Material;
  applyDrillHolesToPanelGeometry: (_panel: THREE.Mesh, _panelType: PanelType, _holes: TechnicalDrillHole[] | undefined) => void;
  buildDoorSpecs: (_items: DoorLayerItem[]) => DoorSpec[];
  buildDrawerSpecs: (
    _items: DrawerLayerItem[],
    _options?: { showDrillingMarkers?: boolean; profundidadeUtilM?: number }
  ) => DrawerSpec[];
  createDoorObject: (_spec: DoorSpec, _material: THREE.Material, _doorHoles?: TechnicalDrillHole[]) => THREE.Object3D;
  createDrawerObject: (
    _spec: DrawerSpec,
    _materials: import("./DrawerFactory").DrawerObjectMaterials | THREE.Material
  ) => THREE.Object3D;
  getMaterialForOfficialId: (_idOrLabel: string) => THREE.Material;
  getDefaultOfficialMaterialId: () => string;
  thicknessM: number;
};

export function buildBoxWithDeps(options: BoxOptions | undefined, deps: BoxAssemblerDeps): BoxModel {
  const opts = options ?? {};
  if (isCaixaFornoBox({ baseCabinetId: opts.baseCabinetId, catalogItemId: opts.baseCabinetId })) {
    const baseMaterial: THREE.Material = opts.material ?? deps.getFallbackPBRMaterial();
    return renderCaixaForno(opts, {
      panelFactory: deps.panelFactory,
      buildDoorSpecs: deps.buildDoorSpecs,
      createDoorObject: deps.createDoorObject,
      getMaterialForOfficialId: deps.getMaterialForOfficialId,
      getDefaultOfficialMaterialId: deps.getDefaultOfficialMaterialId,
      baseMaterial,
      resolveDimensions: deps.resolveDimensions,
      applyDrillHolesToPanelGeometry: deps.applyDrillHolesToPanelGeometry,
    });
  }

  const { width, height, depth } = deps.resolveDimensions(opts);
  const useDefaultMDF = opts.material == null;
  const baseMaterial: THREE.Material = opts.material ?? deps.getFallbackPBRMaterial();

  const root = new THREE.Group();
  root.name = "box-model";
  const specs = deps.getPanelSpecs(width, height, depth);
  const panelTypes = ["left", "top", "bottom", "right", "back"] as const;
  const getMaterial = (_panelType: PanelType) => baseMaterial;
  const panelOptions = (panelType: PanelType) =>
    useDefaultMDF
      ? { edgeMaterial: deps.getEdgeMaterial(), faceMaterial: getMaterial(panelType) }
      : { singleMaterial: getMaterial(panelType) };

  const panels = {
    left: deps.panelFactory.createPanel(specs.left.size[0], specs.left.size[1], specs.left.size[2], "left", "left", panelOptions("left")),
    right: deps.panelFactory.createPanel(specs.right.size[0], specs.right.size[1], specs.right.size[2], "right", "right", panelOptions("right")),
    top: deps.panelFactory.createPanel(specs.top.size[0], specs.top.size[1], specs.top.size[2], "top", "top", panelOptions("top")),
    bottom: deps.panelFactory.createPanel(specs.bottom.size[0], specs.bottom.size[1], specs.bottom.size[2], "bottom", "bottom", panelOptions("bottom")),
    back: deps.panelFactory.createPanel(specs.back.size[0], specs.back.size[1], specs.back.size[2], "back", "back", panelOptions("back")),
  };

  const skipBack = resolveNoBackPanelFromOptions(opts);
  (panelTypes as readonly string[]).forEach((key) => {
    const k = key as keyof typeof panels;
    if (k === "back" && skipBack) return;
    const p = panels[k];
    const pos = specs[k].pos;
    p.position.set(pos[0], pos[1], pos[2]);
    if (k === "right") {
      p.rotation.y = Math.PI;
      p.rotation.z = 0;
    } else {
      p.rotation.y = 0;
      p.rotation.z = 0;
    }
    root.add(p);
  });

  const drillMap = opts.drillMarkersByPanel ?? { cima: [], fundo: [], lateral_esquerda: [], lateral_direita: [], porta: [] };
  const shelfCount = Math.max(0, Math.floor(opts.shelves ?? 0));
  // Roupeiro (e gavetas em zona inferior): as prateleiras continuam a existir na zona superior; permitir furos de prateleira mesmo quando h├í gavetas.
  const useLateralShelfHoles = shelfCount > 0;
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
  deps.applyDrillHolesToPanelGeometry(panels.top, "top", drillMap.cima);
  deps.applyDrillHolesToPanelGeometry(panels.bottom, "bottom", drillMap.fundo);
  deps.applyDrillHolesToPanelGeometry(panels.left, "left", lateralLeftHoles);
  deps.applyDrillHolesToPanelGeometry(panels.right, "right", lateralRightHoles);

  if (shelfCount > 0) {
    deps.getShelfSpecs(width, height, depth, shelfCount, opts).forEach((spec, i) => {
      const shelfMat = baseMaterial;
      const mesh = deps.panelFactory.createPanel(spec.size[0], spec.size[1], spec.size[2], `shelf-${i}`, "top", { singleMaterial: shelfMat });
      mesh.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
      mesh.userData.shelfIndex = i;
      root.add(mesh);
    });
  }

  const divSepBoxLike = {
    dimensoes: {
      largura: width * 1000,
      altura: height * 1000,
      profundidade: (opts?.layoutDepthM ?? depth) * 1000,
    },
    espessura: deps.thicknessM * 1000,
    profundidadeExterna: (opts?.layoutDepthM ?? depth) * 1000,
    divisores: opts?.divisores ?? [],
    separadores: opts?.separadores ?? [],
  };
  let divSepDivIndex = 0;
  getDivSepMeshSpecs(divSepBoxLike, width, height, depth, deps.thicknessM).forEach((spec) => {
    const mesh = deps.panelFactory.createPanel(
      spec.size[0],
      spec.size[1],
      spec.size[2],
      spec.name,
      "top",
      { singleMaterial: baseMaterial }
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
    root.add(mesh);
  });

  // Roupeiro (H/J): divisores internos e var├Áes de cabides (geometry visual).
  const wardrobeGroup = getWardrobeGroupFromBaseCabinetId(opts.baseCabinetId);
  if (wardrobeGroup && wardrobeGroup !== "T") {
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

    // Divisor horizontal: separa ÔÇ£zona inferiorÔÇØ (gavetas/var├úo) e ÔÇ£zona superiorÔÇØ (prateleira).
    if (layout.horizontalDividerCenterY_mm != null) {
      const dividerMat = baseMaterial;
      const dividerH = new THREE.Mesh(
        new THREE.BoxGeometry(width, deps.thicknessM, depth),
        dividerMat
      );
      dividerH.name = "wardrobe-divider-horizontal";
      dividerH.position.set(0, layout.horizontalDividerCenterY_mm / 1000, 0);
      root.add(dividerH);
    }

    // Divisor vertical: obrigat├│rio quando largura >= 800mm.
    if (layout.verticalDividerEnabled) {
      const dividerMat = baseMaterial;
      const dividerV = new THREE.Mesh(
        new THREE.BoxGeometry(deps.thicknessM, height, depth),
        dividerMat
      );
      dividerV.name = "wardrobe-divider-vertical";
      dividerV.position.set((layout.verticalDividerCenterX_mm ?? 0) / 1000, 0, 0);
      root.add(dividerV);
    }

    // Var├úo de cabides (posi├º├úo e lado dependem de cfg7/cfg8).
    const hasDrawersLower = hasWardrobeLowerDrawers(opts.baseCabinetId);
    const railThicknessM = 6 / 1000; // paridade com regras
    const railRadiusM = Math.max(0.001, railThicknessM / 2);
    const railZ = layout.shelfAndRailCenterZ_mm / 1000;
    const railY = layout.lowerCabideCenterY_mm != null ? layout.lowerCabideCenterY_mm / 1000 : -height / 4;

    const createRail = (name: string, x: number, lengthM: number) => {
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(railRadiusM, railRadiusM, Math.max(0.001, lengthM), 12), baseMaterial);
      cyl.name = name;
      cyl.position.set(x, railY, railZ);
      // CylinderGeometry gera eixo em Y; rodar para alinhar ao eixo X (var├úo atravessando a largura).
      cyl.rotation.z = Math.PI / 2;
      root.add(cyl);
    };

    if (layout.verticalDividerEnabled) {
      const leftX = layout.leftCompartmentCenterX_mm / 1000;
      const rightX = layout.rightCompartmentCenterX_mm / 1000;
      const leftLen = layout.railWidthPerSide_mm / 1000;
      const rightLen = layout.railWidthPerSide_mm / 1000;
      if (hasDrawersLower) {
        createRail("wardrobe-rail-left", leftX, leftLen);
      } else {
        createRail("wardrobe-rail-left", leftX, leftLen);
        createRail("wardrobe-rail-right", rightX, rightLen);
      }
    } else {
      // Sem divisor vertical: um ├║nico var├úo
      createRail("wardrobe-rail-center", 0, layout.railWidthFull_mm / 1000);
    }
  }

  const doorLayerItems = Array.isArray(opts.doorLayerItems) ? opts.doorLayerItems : [];
  const doorSpecs = deps.buildDoorSpecs(doorLayerItems);
  const cornerCfg = getCornerCabinetConfig(opts.baseCabinetId);
  const cornerSide = cornerCfg
    ? resolveCornerSideForBox({
        baseCabinetId: opts.baseCabinetId,
        orientation: opts.orientation,
        rotacaoY: opts.rotationY,
      })
    : null;
  const portasSettings = getSettings().portas;

  doorSpecs.forEach((spec, doorIndex) => {
    const item = doorLayerItems[doorIndex];
    const materialId = item?.material ?? item?.materialId ?? deps.getDefaultOfficialMaterialId();
    const doorMaterial = deps.getMaterialForOfficialId(materialId);
    const doorObj = deps.createDoorObject(
      spec,
      doorMaterial as THREE.Material,
      drillMap.portaPerDoor?.[doorIndex] ?? drillMap.porta
    );
    if (cornerCfg && cornerCfg.doorFrameVisualMm > 0) {
      const frameInset = cornerCfg.doorFrameVisualMm / 1000;
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(
          spec.widthM + frameInset * 2,
          spec.heightM + frameInset * 2,
          Math.max(0.002, spec.thicknessM * 0.35)
        ),
        doorMaterial as THREE.Material
      );
      frame.name = `door-frame-${spec.id}`;
      frame.position.z = -spec.thicknessM * 0.2;
      doorObj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh && child.name.startsWith("door-leaf")) {
          child.add(frame);
        }
      });
    }
    root.add(doorObj);
  });

  if (cornerCfg && cornerSide) {
    const visual = computeCornerVisualLayout({
      widthM: width,
      heightM: height,
      depthM: depth,
      thicknessM: deps.thicknessM,
      side: cornerSide,
      config: cornerCfg,
      gapVerticalMm: portasSettings.portaGapVerticalMm,
      gapHorizontalMm: portasSettings.portaGapHorizontalMm,
      doorFixedGapMm: portasSettings.portaGapDuplaMm,
      doorPosZOffsetMm: portasSettings.portaPosZOffsetMm,
    });
    const ffMaterialId =
      typeof opts.frenteFixaMaterialId === "string" && opts.frenteFixaMaterialId.trim().length > 0
        ? opts.frenteFixaMaterialId.trim()
        : typeof opts.bodyMaterialId === "string" && opts.bodyMaterialId.trim().length > 0
          ? opts.bodyMaterialId.trim()
          : typeof opts.materialName === "string" && opts.materialName.trim().length > 0
            ? opts.materialName.trim()
            : deps.getDefaultOfficialMaterialId();
    const ffMat = deps.getMaterialForOfficialId(ffMaterialId) as THREE.Material;
    const ff = deps.panelFactory.createPanel(
      visual.fixedFront.size[0],
      visual.fixedFront.size[1],
      visual.fixedFront.size[2],
      "frente-fixa",
      "front",
      { singleMaterial: ffMat }
    );
    ff.name = "frente-fixa";
    ff.position.set(...visual.fixedFront.pos);
    (ff.userData as Record<string, unknown>).frenteFixaMaterialId = ffMaterialId;
    const ffHoles = drillMap.frente_fixa ?? [];
    if (ffHoles.length > 0) {
      deps.applyDrillHolesToPanelGeometry(ff, "front", ffHoles);
    }
    root.add(ff);
  }

  const drawerLayerItems = Array.isArray(opts.drawerLayerItems) ? opts.drawerLayerItems : [];
  if (!DISABLE_DRAWER_RENDERING) {
    const drawerSpecs = deps.buildDrawerSpecs(drawerLayerItems, {
      showDrillingMarkers: opts.showDrawerDrilling === true,
      profundidadeUtilM: opts.carcassDepthM ?? depth,
    });
    drawerSpecs.forEach((spec, drawerIndex) => {
      const drawerItem = drawerLayerItems[drawerIndex];
      const defaultMaterialId = deps.getDefaultOfficialMaterialId();
      const bodyMaterialId =
        typeof opts.materialName === "string" && opts.materialName.trim().length > 0
          ? opts.materialName.trim()
          : defaultMaterialId;
      const frontMaterialId = resolveDrawerFrontMaterialId(drawerItem, bodyMaterialId);
      const frontMaterial = deps.getMaterialForOfficialId(frontMaterialId);
      const bodyMaterial = deps.getMaterialForOfficialId(bodyMaterialId);
      const drawerGroup = deps.createDrawerObject(spec, {
        front: frontMaterial as THREE.Material,
        body: bodyMaterial as THREE.Material,
        frontMaterialId,
      });
      drawerGroup.traverse((child) => {
        if (
          child instanceof THREE.Mesh &&
          (child as THREE.Mesh & { userData: { drawerPart?: string } }).userData?.drawerPart === "front"
        ) {
          child.userData.drawerFrontMaterialId = frontMaterialId;
        }
      });
      root.add(drawerGroup);
    });
  }

  root.position.set(0, 0, 0);
  return { root, panels, dimensions: { width, height, depth, thickness: deps.thicknessM } };
}

export function buildBoxGroupWithDeps(options: BoxOptions | undefined, deps: BoxAssemblerDeps): THREE.Group {
  return buildBoxWithDeps(options ?? {}, deps).root;
}
