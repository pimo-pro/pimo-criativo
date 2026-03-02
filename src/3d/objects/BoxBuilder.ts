import * as THREE from "three";
import { createWoodMaterial } from "../materials/WoodMaterial";
import { defaultMaterialSet, getMaterialPreset } from "../materials/MaterialLibrary";
import { SYSTEM_THICKNESS_MM, SYSTEM_BACK_MM } from "../../core/baseCabinets";
import type { DoorLayerItem, DrawerLayerItem } from "../../models/BoxLayers";
import type { BoxPanelIds, TechnicalDrillHole, ViewerDrillMarkersByPanel } from "../../core/types";

/**
 * Camada oficial de fabricação: gera TODAS as peças segundo as regras industriais.
 * Aplica-se a modelos base, caixas manuais, calculadora, duplicadas, templates e personalizadas.
 * Dimensões em cena em metros (1 unidade = 1 m).
 * - Costa (fundo): 10 mm, sempre ATRÁS da caixa; profundidade da caixa NUNCA é reduzida pela costa.
 * - Cima/fundo: largura total × profundidade total × 19 mm.
 * - Laterais: DENTRO; altura = altura - 38 mm, profundidade = total, espessura 19 mm.
 * - Prateleiras: DENTRO; largura = largura - 2 mm, profundidade = profundidade - 10 mm, 19 mm.
 * 
 * GAVETAS:
 * - Cálculos delegados ao domínio: src/core/drawers/
 * - BoxBuilder apenas renderiza LayerItems já calculados
 * - Lógica de dimensões, folgas e movimento está no domínio
 * 
 * updateBoxGroup: apenas atualiza geometria/posição por nome; não recria IDs.
 */
export type BoxOptions = {
  size?: number;
  width?: number;
  height?: number;
  depth?: number;
  index?: number;
  position?: { x: number; y: number; z: number };
  materialName?: string;
  material?: THREE.Material;
  castShadow?: boolean;
  receiveShadow?: boolean;
  /** Ignorado na construção: espessura/costa vêm das constantes do sistema (19 mm / 10 mm). */
  thickness?: number;
  /** Número de prateleiras internas (geradas dentro da caixa). */
  shelves?: number;
  doorLayerItems?: DoorLayerItem[];
  drawerLayerItems?: DrawerLayerItem[];
  drillMarkersByPanel?: ViewerDrillMarkersByPanel;
  panelIds?: BoxPanelIds;
  /** Se true, não cria geometria paramétrica; o grupo serve apenas para o(s) modelo(s) GLB (caixa = GLB). */
  cadOnly?: boolean;
  /** Rotação Y em radianos (manipulação visual). */
  rotationY?: number;
  /** Direção da costa (parte traseira) em radianos: 0 | π/2 | π | -π/2. Auto-rotate alinha costa à parede. */
  costaRotationY?: number;
  /** Se true, o viewer não reposiciona esta caixa no reflow. */
  manualPosition?: boolean;
  /** Tipo de armário para altura automática: inferior (base) ou superior (parede). */
  cabinetType?: "lower" | "upper" | null;
  /** Altura do pé (PE) em cm para caixas inferiores; base da caixa fica a PE cm do piso (default 10). */
  pe_cm?: number;
  /** Ativa/desativa os pés de 10 cm para caixas inferiores. */
  feetEnabled?: boolean;
  /** Se false, o viewer não altera rotation.y (modo manual; botão RODAR). Default true. */
  autoRotateEnabled?: boolean;
};

export type BoxModel = {
  root: THREE.Group;
  panels: {
    left: THREE.Mesh;
    right: THREE.Mesh;
    top: THREE.Mesh;
    bottom: THREE.Mesh;
    back: THREE.Mesh;
  };
  dimensions: {
    width: number;
    height: number;
    depth: number;
    thickness: number;
  };
};

/** Espessura dos painéis em metros (19 mm). */
const THICKNESS_M = SYSTEM_THICKNESS_MM / 1000;
/** Espessura da costa em metros (10 mm). */
const BACK_THICKNESS_M = SYSTEM_BACK_MM / 1000;
/** Folga lateral para prateleiras (1 mm cada lado = 2 mm total). */
const SHELF_WIDTH_CLEARANCE_M = 0.002;
/** Profundidade interna antes da costa (costa 10 mm atrás). */
const SHELF_DEPTH_CLEARANCE_M = SYSTEM_BACK_MM / 1000;
const DOOR_ANIMATION_DURATION_MS = 2000;
const DRAWER_ANIMATION_DURATION_MS = 1500;
const doorOpenState = new Map<string, boolean>();
const doorRotationState = new Map<string, { x: number; y: number }>();
const doorAnimationRaf = new Map<string, number>();
const drawerOpenState = new Map<string, boolean>();
const drawerPositionState = new Map<string, number>();
const drawerAnimationRaf = new Map<string, number>();
const easeInOutCubic = (t: number) => (t < 0.5
  ? 4 * t * t * t
  : 1 - Math.pow(-2 * t + 2, 3) / 2);
const resolveDimensions = (options: BoxOptions = {}) => {
  const size = options.size ?? 1;
  const width = options.width ?? size;
  const height = options.height ?? size;
  const depth = options.depth ?? size;
  return {
    width: Math.max(0.001, width),
    height: Math.max(0.001, height),
    depth: Math.max(0.001, depth),
  };
};

/**
 * Especificação dos painéis segundo regras de marcenaria.
 * - Cima/fundo: largura total × profundidade total × 19 mm.
 * - Laterais: DENTRO; altura = altura - 38 mm, profundidade = total, 19 mm. Posição x dentro das faces.
 * - Costa: ATRÁS da caixa; largura total × altura total × 10 mm; z = -depth/2 - 5 mm.
 * Tamanhos em Three.js: [x_size, y_size, z_size] = [largura, altura, profundidade] para cada painel.
 */
function getPanelSpecs(width: number, height: number, depth: number) {
  const sideHeight = height - 2 * THICKNESS_M;
  return {
    top: {
      size: [width, THICKNESS_M, depth] as const,
      pos: [0, height / 2 - THICKNESS_M / 2, 0] as const,
    },
    bottom: {
      size: [width, THICKNESS_M, depth] as const,
      pos: [0, -height / 2 + THICKNESS_M / 2, 0] as const,
    },
    left: {
      size: [THICKNESS_M, sideHeight, depth] as const,
      pos: [-width / 2 + THICKNESS_M / 2, 0, 0] as const,
    },
    right: {
      size: [THICKNESS_M, sideHeight, depth] as const,
      pos: [width / 2 - THICKNESS_M / 2, 0, 0] as const,
    },
    back: {
      size: [width, height, BACK_THICKNESS_M] as const,
      pos: [0, 0, -depth / 2 - BACK_THICKNESS_M / 2] as const,
    },
  };
}

/**
 * Prateleiras: DENTRO da caixa. largura = width - 2 mm, profundidade = depth - 10 mm, espessura 19 mm.
 * Posição z: centrada na profundidade útil (face interior até costa).
 */
function getShelfSpecs(width: number, height: number, depth: number, count: number) {
  const shelfWidth = Math.max(0.001, width - SHELF_WIDTH_CLEARANCE_M);
  const shelfDepth = Math.max(0.001, depth - SHELF_DEPTH_CLEARANCE_M);
  const interiorHeight = Math.max(0.001, height - 2 * THICKNESS_M);
  const centerZ = -depth / 2 + shelfDepth / 2;
  const specs: { size: [number, number, number]; pos: [number, number, number] }[] = [];
  if (count < 1) return specs;
  const spacing = interiorHeight / (count + 1);
  const yMin = -height / 2 + THICKNESS_M + spacing;
  for (let i = 0; i < count; i++) {
    const y = yMin + i * spacing;
    specs.push({
      size: [shelfWidth, THICKNESS_M, shelfDepth],
      pos: [0, y, centerZ],
    });
  }
  return specs;
}

type PanelType = "left" | "right" | "top" | "bottom" | "back" | "front";

type DoorSpec = {
  id: string;
  type: "door";
  groupType?: "simples" | "dupla";
  widthM: number;
  heightM: number;
  thicknessM: number;
  x: number;
  y: number;
  z: number;
  rotY: number;
  openDirection: DoorLayerItem["openDirection"];
  hingeSide: DoorLayerItem["hingeSide"];
  pivot: DoorLayerItem["pivot"];
  isOpen: boolean;
};

type DrawerSpec = {
  id: string;
  type: "drawer";
  // Dimensões da frente (cobre toda a abertura)
  widthM: number;
  heightM: number;
  depthM: number;
  frontThicknessM: number;
  // Dimensões do corpo
  bodyWidthM?: number;
  bodyHeightM?: number;
  bodyDepthM?: number;
  // Dimensões das peças
  leftSideWidthM?: number;
  leftSideHeightM?: number;
  leftSideDepthM?: number;
  rightSideWidthM?: number;
  rightSideHeightM?: number;
  rightSideDepthM?: number;
  backWidthM?: number;
  backHeightM?: number;
  backThicknessM?: number;
  bottomWidthM?: number;
  bottomDepthM?: number;
  bottomThicknessM?: number;
  sideThicknessM?: number;
  // Posicoes locais das pecas
  frontPosX?: number;
  frontPosY?: number;
  frontPosZ?: number;
  leftSidePosX?: number;
  leftSidePosY?: number;
  leftSidePosZ?: number;
  rightSidePosX?: number;
  rightSidePosY?: number;
  rightSidePosZ?: number;
  bottomPosX?: number;
  bottomPosY?: number;
  bottomPosZ?: number;
  backPosX?: number;
  backPosY?: number;
  backPosZ?: number;
  // Posição e estado
  x: number;
  y: number;
  z: number;
  rotY: number;
  isOpen: boolean;
  pullDistanceM: number;
};

function buildDoorSpecs(items: DoorLayerItem[]): DoorSpec[] {
  return items.map((item) => ({
    id: item.id,
    type: "door",
    groupType: item.groupType,
    widthM: Math.max(0.001, item.width / 1000),
    heightM: Math.max(0.001, item.height / 1000),
    thicknessM: Math.max(0.001, item.thickness / 1000),
    x: (item.posX ?? 0) / 1000,
    y: (item.posY ?? 0) / 1000,
    z: (item.posZ ?? 0) / 1000,
    rotY: Number.isFinite(item.rotY) ? item.rotY : 0,
    openDirection: item.openDirection,
    hingeSide: item.hingeSide,
    pivot: item.pivot,
    isOpen: Boolean(item.isOpen),
  }));
}

/**
 * Converte DrawerLayerItem[] para DrawerSpec[] (formato Three.js)
 * 
 * NOTA: Não faz cálculos! Apenas converte mm -> metros.
 * Todos os cálculos de dimensões estão em src/core/drawers/
 */
function buildDrawerSpecs(items: DrawerLayerItem[]): DrawerSpec[] {
  return items.map((item) => ({
    id: item.id,
    type: "drawer",
    // Frente
    widthM: Math.max(0.001, item.width / 1000),
    heightM: Math.max(0.001, item.height / 1000),
    depthM: Math.max(0.001, item.depth / 1000),
    frontThicknessM: Math.max(0.001, item.frontThickness / 1000),
    // Corpo
    bodyWidthM: item.bodyWidth ? Math.max(0.001, item.bodyWidth / 1000) : undefined,
    bodyHeightM: item.bodyHeight ? Math.max(0.001, item.bodyHeight / 1000) : undefined,
    bodyDepthM: item.bodyDepth ? Math.max(0.001, item.bodyDepth / 1000) : undefined,
    // Laterais
    leftSideWidthM: item.leftSideWidth ? Math.max(0.001, item.leftSideWidth / 1000) : undefined,
    leftSideHeightM: item.leftSideHeight ? Math.max(0.001, item.leftSideHeight / 1000) : undefined,
    leftSideDepthM: item.leftSideDepth ? Math.max(0.001, item.leftSideDepth / 1000) : undefined,
    rightSideWidthM: item.rightSideWidth ? Math.max(0.001, item.rightSideWidth / 1000) : undefined,
    rightSideHeightM: item.rightSideHeight ? Math.max(0.001, item.rightSideHeight / 1000) : undefined,
    rightSideDepthM: item.rightSideDepth ? Math.max(0.001, item.rightSideDepth / 1000) : undefined,
    // Traseira
    backWidthM: item.backWidth ? Math.max(0.001, item.backWidth / 1000) : undefined,
    backHeightM: item.backHeight ? Math.max(0.001, item.backHeight / 1000) : undefined,
    backThicknessM: item.backThickness ? Math.max(0.001, item.backThickness / 1000) : undefined,
    // Fundo
    bottomWidthM: item.bottomWidth ? Math.max(0.001, item.bottomWidth / 1000) : undefined,
    bottomDepthM: item.bottomDepth ? Math.max(0.001, item.bottomDepth / 1000) : undefined,
    bottomThicknessM: item.bottomThickness ? Math.max(0.001, item.bottomThickness / 1000) : undefined,
    // Posicoes locais das pecas
    frontPosX: Number.isFinite(item.frontPosX) ? (item.frontPosX as number) / 1000 : undefined,
    frontPosY: Number.isFinite(item.frontPosY) ? (item.frontPosY as number) / 1000 : undefined,
    frontPosZ: Number.isFinite(item.frontPosZ) ? (item.frontPosZ as number) / 1000 : undefined,
    leftSidePosX: Number.isFinite(item.leftSidePosX) ? (item.leftSidePosX as number) / 1000 : undefined,
    leftSidePosY: Number.isFinite(item.leftSidePosY) ? (item.leftSidePosY as number) / 1000 : undefined,
    leftSidePosZ: Number.isFinite(item.leftSidePosZ) ? (item.leftSidePosZ as number) / 1000 : undefined,
    rightSidePosX: Number.isFinite(item.rightSidePosX) ? (item.rightSidePosX as number) / 1000 : undefined,
    rightSidePosY: Number.isFinite(item.rightSidePosY) ? (item.rightSidePosY as number) / 1000 : undefined,
    rightSidePosZ: Number.isFinite(item.rightSidePosZ) ? (item.rightSidePosZ as number) / 1000 : undefined,
    bottomPosX: Number.isFinite(item.bottomPosX) ? (item.bottomPosX as number) / 1000 : undefined,
    bottomPosY: Number.isFinite(item.bottomPosY) ? (item.bottomPosY as number) / 1000 : undefined,
    bottomPosZ: Number.isFinite(item.bottomPosZ) ? (item.bottomPosZ as number) / 1000 : undefined,
    backPosX: Number.isFinite(item.backPosX) ? (item.backPosX as number) / 1000 : undefined,
    backPosY: Number.isFinite(item.backPosY) ? (item.backPosY as number) / 1000 : undefined,
    backPosZ: Number.isFinite(item.backPosZ) ? (item.backPosZ as number) / 1000 : undefined,
    sideThicknessM: item.sideThickness ? Math.max(0.001, item.sideThickness / 1000) : undefined,
    // Posição
    x: (item.posX ?? 0) / 1000,
    y: (item.posY ?? 0) / 1000,
    z: (item.posZ ?? 0) / 1000,
    rotY: Number.isFinite(item.rotY) ? item.rotY : 0,
    isOpen: Boolean(item.isOpen),
    pullDistanceM: Math.max(0, (item.pullDistanceMm ?? 0) / 1000),
  }));
}

function createDoorObject(spec: DoorSpec, material: THREE.Material): THREE.Object3D {
  if (import.meta.env.DEV) {
    console.log("[BoxLayers][BoxBuilder.createDoorObject] create", {
      id: spec.id,
      type: spec.type,
      widthM: spec.widthM,
      heightM: spec.heightM,
      thicknessM: spec.thicknessM,
      x: spec.x,
      y: spec.y,
      z: spec.z,
      openDirection: spec.openDirection,
      isOpen: spec.isOpen,
    });
  }
  const mesh = createPanel(
    spec.widthM,
    spec.heightM,
    spec.thicknessM,
    `door-leaf-${spec.id}`,
    "front",
    { singleMaterial: material }
  );

  const pivot = new THREE.Group();
  pivot.name = `door-layer-${spec.id}`;
  const resolvedOpenDirection =
    spec.openDirection === "left" ||
    spec.openDirection === "right" ||
    spec.openDirection === "up" ||
    spec.openDirection === "down"
      ? spec.openDirection
      : "left";
  const resolvedHingeSide =
    spec.hingeSide === "left" || spec.hingeSide === "right"
      ? spec.hingeSide
      : spec.openDirection === "right"
        ? "right"
        : "left";
  if (spec.pivot === "top-edge" || resolvedOpenDirection === "up") {
    mesh.position.set(0, -spec.heightM / 2, 0);
  } else if (spec.pivot === "bottom-edge" || resolvedOpenDirection === "down") {
    mesh.position.set(0, spec.heightM / 2, 0);
  } else if (spec.pivot === "left-edge" || resolvedHingeSide === "left") {
    mesh.position.set(spec.widthM / 2, 0, 0);
  } else if (spec.pivot === "right-edge" || resolvedHingeSide === "right") {
    mesh.position.set(-spec.widthM / 2, 0, 0);
  } else {
    mesh.position.set(spec.openDirection === "left" ? spec.widthM / 2 : -spec.widthM / 2, 0, 0);
  }
  pivot.position.set(spec.x, spec.y, spec.z);
  if (spec.rotY !== 0) pivot.rotation.y = spec.rotY;
  const baseRotationY = pivot.rotation.y;
  const baseRotationX = pivot.rotation.x;
  const targetRotation = {
    x:
      resolvedOpenDirection === "up"
        ? (spec.isOpen ? baseRotationX - Math.PI / 2 : baseRotationX)
        : resolvedOpenDirection === "down"
          ? (spec.isOpen ? baseRotationX + Math.PI / 2 : baseRotationX)
          : baseRotationX,
    y:
      resolvedOpenDirection === "left" || resolvedOpenDirection === "right"
        ? (spec.isOpen
            ? baseRotationY + (resolvedHingeSide === "right" ? 1 : -1) * (Math.PI / 2)
            : baseRotationY)
        : baseRotationY,
  };
  const prevIsOpen = doorOpenState.get(spec.id);
  const prevRotation = doorRotationState.get(spec.id);
  const startRotation = prevRotation ?? { x: baseRotationX, y: baseRotationY };
  const shouldAnimate = prevIsOpen === undefined ? spec.isOpen : prevIsOpen !== spec.isOpen;

  if (prevRotation) {
    pivot.rotation.x = startRotation.x;
    pivot.rotation.y = startRotation.y;
  }

  if (shouldAnimate) {
    const existingRaf = doorAnimationRaf.get(spec.id);
    if (existingRaf != null) cancelAnimationFrame(existingRaf);
    const start = performance.now();
    console.log("door animation start", { id: spec.id, targetRotation });
    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / DOOR_ANIMATION_DURATION_MS);
      const eased = easeInOutCubic(t);
      pivot.rotation.x = startRotation.x + (targetRotation.x - startRotation.x) * eased;
      pivot.rotation.y = startRotation.y + (targetRotation.y - startRotation.y) * eased;
      if (t < 1) {
        doorAnimationRaf.set(spec.id, requestAnimationFrame(animate));
      } else {
        doorAnimationRaf.delete(spec.id);
        console.log("door animation end", { id: spec.id, targetRotation });
      }
    };
    doorAnimationRaf.set(spec.id, requestAnimationFrame(animate));
  } else {
    pivot.rotation.x = targetRotation.x;
    pivot.rotation.y = targetRotation.y;
  }

  doorOpenState.set(spec.id, spec.isOpen);
  doorRotationState.set(spec.id, targetRotation);
  pivot.userData.doorLayerId = spec.id;
  pivot.userData.openDirection = resolvedOpenDirection;
  pivot.userData.hingeSide = resolvedHingeSide;
  mesh.userData.doorLayerId = spec.id;
  mesh.userData.openDirection = resolvedOpenDirection;
  mesh.userData.hingeSide = resolvedHingeSide;
  pivot.add(mesh);
  if (import.meta.env.DEV) {
    const finalCenter = new THREE.Vector3()
      .copy(mesh.position)
      .applyEuler(pivot.rotation)
      .add(pivot.position);
    console.log("[BoxLayers][BoxBuilder.createDoorObject] final", {
      id: spec.id,
      type: spec.groupType ?? "door",
      posX: finalCenter.x,
      posY: finalCenter.y,
      posZ: finalCenter.z,
      width: spec.widthM,
      height: spec.heightM,
      depth: spec.thicknessM,
    });
  }
  if (import.meta.env.DEV) {
    console.log("[BoxLayers][BoxBuilder.createDoorObject] hinge-Y final position", {
      id: spec.id,
      pivotPosition: pivot.position.toArray(),
      meshLocalPosition: mesh.position.toArray(),
    });
  }
  return pivot;
}

/**
 * Renderiza uma gaveta no Three.js
 * 
 * NOTA: Não faz cálculos de dimensões! Apenas renderiza.
 * - Cálculos de folgas, gaps e dimensões: src/core/drawers/DrawerParametrics
 * - Lógica de movimento: src/core/drawers/DrawerMotionService
 * - Geração: src/core/drawers/DrawerGenerationService
 * 
 * Esta função apenas:
 * 1. Cria geometrias Three.js
 * 2. Posiciona peças
 * 3. Anima com requestAnimationFrame
 */
function createDrawerObject(spec: DrawerSpec, material: THREE.Material): THREE.Object3D {
  // Grupo principal (posição base da gaveta - no centro do box)
  const group = new THREE.Group();
  group.name = `drawer-layer-${spec.id}`;
  group.position.set(spec.x, spec.y, spec.z);
  if (spec.rotY !== 0) {
    group.rotation.y = spec.rotY;
  }

  // ===== GRUPO MÓVEL (FRENTE + CORPO) =====
  // TUDO se move junto ao abrir/fechar
  const drawerGroup = new THREE.Group();
  drawerGroup.name = `drawer-body-${spec.id}`;
  
  // Animação suave do deslocamento ao abrir
  const targetPullOffset = spec.isOpen ? spec.pullDistanceM : 0;
  const prevIsOpen = drawerOpenState.get(spec.id);
  const prevPosition = drawerPositionState.get(spec.id);
  const startPosition = Number.isFinite(prevPosition) ? (prevPosition as number) : 0;
  const shouldAnimate = prevIsOpen === undefined ? spec.isOpen : prevIsOpen !== spec.isOpen;

  if (Number.isFinite(prevPosition)) {
    drawerGroup.position.set(0, 0, startPosition);
  } else {
    drawerGroup.position.set(0, 0, targetPullOffset);
  }

  if (shouldAnimate) {
    const existingRaf = drawerAnimationRaf.get(spec.id);
    if (existingRaf != null) cancelAnimationFrame(existingRaf);
    const start = performance.now();
    const targetPosition = targetPullOffset;
    console.log("drawer animation start", { id: spec.id, targetPosition, startPosition });
    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / DRAWER_ANIMATION_DURATION_MS);
      const eased = easeInOutCubic(t);
      drawerGroup.position.z = startPosition + (targetPosition - startPosition) * eased;
      if (t < 1) {
        drawerAnimationRaf.set(spec.id, requestAnimationFrame(animate));
      } else {
        drawerAnimationRaf.delete(spec.id);
        console.log("drawer animation end", { id: spec.id, finalPosition: drawerGroup.position.z });
      }
    };
    drawerAnimationRaf.set(spec.id, requestAnimationFrame(animate));
  } else {
    drawerGroup.position.z = targetPullOffset;
  }

  drawerOpenState.set(spec.id, spec.isOpen);
  drawerPositionState.set(spec.id, drawerGroup.position.z);

  drawerGroup.userData.drawerLayerId = spec.id;
  drawerGroup.userData.drawerPart = "body";

  // ===== FRENTE DA GAVETA =====
  // A frente fica colada ao corpo e flush no plano frontal
  const front = createPanel(
    spec.widthM,
    spec.heightM,
    spec.frontThicknessM,
    `drawer-front-${spec.id}`,
    "front",
    { singleMaterial: material }
  );
  if (
    Number.isFinite(spec.frontPosX) &&
    Number.isFinite(spec.frontPosY) &&
    Number.isFinite(spec.frontPosZ)
  ) {
    front.position.set(spec.frontPosX as number, spec.frontPosY as number, spec.frontPosZ as number);
  } else {
    front.position.set(0, 0, spec.frontThicknessM / 2);
  }
  front.userData.drawerLayerId = spec.id;
  front.userData.drawerPart = "front";
  drawerGroup.add(front);

  // ===== CORPO DA GAVETA =====
  if (spec.bodyWidthM && spec.bodyHeightM && spec.bodyDepthM) {
    const bodyOffsetZ = -(spec.bodyDepthM / 2 + spec.frontThicknessM);

    
    // ===== LATERAL ESQUERDA =====
    if (spec.leftSideWidthM && spec.leftSideHeightM && spec.leftSideDepthM) {
      const leftSide = createPanel(
        spec.leftSideWidthM,
        spec.leftSideHeightM,
        spec.leftSideDepthM,
        `drawer-left-${spec.id}`,
        "left",
        { singleMaterial: material }
      );
      if (
        Number.isFinite(spec.leftSidePosX) &&
        Number.isFinite(spec.leftSidePosY) &&
        Number.isFinite(spec.leftSidePosZ)
      ) {
        leftSide.position.set(
          spec.leftSidePosX as number,
          spec.leftSidePosY as number,
          spec.leftSidePosZ as number
        );
      } else {
        leftSide.position.set(
          -spec.bodyWidthM / 2 + spec.leftSideWidthM / 2,
          0,
          bodyOffsetZ
        );
      }
      leftSide.userData.drawerPart = "left-side";
      drawerGroup.add(leftSide);
    }

    // ===== LATERAL DIREITA =====
    if (spec.rightSideWidthM && spec.rightSideHeightM && spec.rightSideDepthM) {
      const rightSide = createPanel(
        spec.rightSideWidthM,
        spec.rightSideHeightM,
        spec.rightSideDepthM,
        `drawer-right-${spec.id}`,
        "right",
        { singleMaterial: material }
      );
      if (
        Number.isFinite(spec.rightSidePosX) &&
        Number.isFinite(spec.rightSidePosY) &&
        Number.isFinite(spec.rightSidePosZ)
      ) {
        rightSide.position.set(
          spec.rightSidePosX as number,
          spec.rightSidePosY as number,
          spec.rightSidePosZ as number
        );
      } else {
        rightSide.position.set(
          spec.bodyWidthM / 2 - spec.rightSideWidthM / 2,
          0,
          bodyOffsetZ
        );
      }
      rightSide.userData.drawerPart = "right-side";
      drawerGroup.add(rightSide);
    }

    // ===== FUNDO =====
    if (spec.bottomWidthM && spec.bottomDepthM && spec.bottomThicknessM) {
      const bottom = createPanel(
        spec.bottomWidthM,
        spec.bottomThicknessM,
        spec.bottomDepthM,
        `drawer-bottom-${spec.id}`,
        "bottom",
        { singleMaterial: material }
      );
      if (
        Number.isFinite(spec.bottomPosX) &&
        Number.isFinite(spec.bottomPosY) &&
        Number.isFinite(spec.bottomPosZ)
      ) {
        bottom.position.set(
          spec.bottomPosX as number,
          spec.bottomPosY as number,
          spec.bottomPosZ as number
        );
      } else {
        bottom.position.set(
          0,
          -spec.bodyHeightM / 2 + spec.bottomThicknessM / 2,
          bodyOffsetZ
        );
      }
      bottom.userData.drawerPart = "bottom";
      drawerGroup.add(bottom);
    }

    // ===== TRASEIRA =====
    if (spec.backWidthM && spec.backHeightM && spec.backThicknessM) {
      const back = createPanel(
        spec.backWidthM,
        spec.backHeightM,
        spec.backThicknessM,
        `drawer-back-${spec.id}`,
        "back",
        { singleMaterial: material }
      );
      if (
        Number.isFinite(spec.backPosX) &&
        Number.isFinite(spec.backPosY) &&
        Number.isFinite(spec.backPosZ)
      ) {
        back.position.set(
          spec.backPosX as number,
          spec.backPosY as number,
          spec.backPosZ as number
        );
      } else {
        back.position.set(
          0,
          0,
          bodyOffsetZ - spec.bodyDepthM / 2 + spec.backThicknessM / 2
        );
      }
      back.userData.drawerPart = "back";
      drawerGroup.add(back);
    }
  }

  group.add(drawerGroup);

  group.userData.drawerLayerId = spec.id;

  if (import.meta.env.DEV) {
    console.log("[BoxLayers][BoxBuilder.createDrawerObject] final", {
      id: spec.id,
      type: "drawer",
      posX: group.position.x,
      posY: group.position.y,
      posZ: group.position.z,
      frontWidth: spec.widthM,
      frontHeight: spec.heightM,
      bodyWidth: spec.bodyWidthM,
      bodyDepth: spec.bodyDepthM,
      isOpen: spec.isOpen,
      pullDistance: spec.pullDistanceM,
    });
  }

  return group;
}

function createDrillMarker(radiusM: number, depthM: number, color = "#2563eb"): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(Math.max(0.0004, radiusM), Math.max(0.0004, radiusM), Math.max(0.001, depthM), 10);
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "drill-marker";
  return mesh;
}

function addDrillMarkersToPanel(panel: THREE.Mesh, panelType: string, holes: TechnicalDrillHole[] | undefined) {
  if (!holes || holes.length === 0) return;
  const size = new THREE.Vector3();
  new THREE.Box3().setFromObject(panel).getSize(size);
  const panelW = panelType === "left" || panelType === "right" ? size.z : size.x;
  const panelH = panelType === "top" || panelType === "bottom" ? size.z : size.y;
  for (const h of holes) {
    const r = Math.max(0.0005, h.diametro / 2000);
    const d = Math.max(0.001, h.profundidade / 1000);
    const marker = createDrillMarker(r, d);
    const lx = (h.x / 1000) - panelW / 2;
    const ly = panelH / 2 - (h.y / 1000);
    if (panelType === "top" || panelType === "bottom") {
      marker.rotation.x = Math.PI / 2;
      marker.position.set(lx, 0, ly);
    } else if (panelType === "left" || panelType === "right") {
      marker.rotation.z = Math.PI / 2;
      marker.position.set(0, ly, lx);
    } else {
      marker.position.set(lx, ly, 0);
    }
    marker.userData.isDrillMarker = true;
    panel.add(marker);
  }
}

let cachedFallbackMaterial: THREE.MeshStandardMaterial | null = null;

/** Material PBR de fallback (MDF Branco) — cor sólida, sem texturas. */
function getFallbackPBRMaterial(): THREE.MeshStandardMaterial {
  if (cachedFallbackMaterial) return cachedFallbackMaterial;
  const preset = getMaterialPreset(defaultMaterialSet, "mdf_branco");
  if (!preset?.options) throw new Error("MaterialLibrary: mdf_branco preset required");
  const { material } = createWoodMaterial({}, { ...preset.options });
  cachedFallbackMaterial = material;
  return material;
}

let cachedEdgeMaterial: THREE.MeshStandardMaterial | null = null;

/** Material para arestas (corte) — cor ligeiramente mais escura, sem texturas. */
function getEdgeMaterial(): THREE.MeshStandardMaterial {
  if (cachedEdgeMaterial) return cachedEdgeMaterial;
  const preset = getMaterialPreset(defaultMaterialSet, "mdf_branco");
  if (!preset?.options) throw new Error("MaterialLibrary: mdf_branco required");
  const { material } = createWoodMaterial({}, {
    ...preset.options,
    color: "#b8a898",
  });
  cachedEdgeMaterial = material;
  return material;
}

/**
 * Eixo da espessura do painel: 0 = X (left/right), 1 = Y (top/bottom), 2 = Z (back).
 * BoxGeometry: faces 0,1 = ±X; 2,3 = ±Y; 4,5 = ±Z. Cada face = 6 índices.
 */
function getThinAxisForPanel(panelType: PanelType): 0 | 1 | 2 {
  if (panelType === "left" || panelType === "right") return 0;
  if (panelType === "top" || panelType === "bottom") return 1;
  return 2;
}

function createBoxGeometryWithEdgeGroups(
  width: number,
  height: number,
  depth: number,
  thinAxis: 0 | 1 | 2
): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  if (!geometry.attributes.uv2 && geometry.attributes.uv) {
    geometry.setAttribute("uv2", geometry.attributes.uv.clone());
  }
  geometry.clearGroups();
  const edgeFaces = thinAxis === 0 ? [0, 1] : thinAxis === 1 ? [2, 3] : [4, 5];
  for (let i = 0; i < 6; i++) {
    const materialIndex = edgeFaces.includes(i) ? 0 : 1;
    geometry.addGroup(i * 6, 6, materialIndex);
  }
  return geometry;
}

export const buildBox = (options: BoxOptions = {}): BoxModel => {
  const opts = options ?? {};
  const { width, height, depth } = resolveDimensions(opts);
  const useDefaultMDF = opts.material == null;
  const baseMaterial: THREE.Material = opts.material ?? getFallbackPBRMaterial();

  const root = new THREE.Group();
  root.name = "box-model";

  const specs = getPanelSpecs(width, height, depth);
  const panelTypes = ["left", "top", "bottom", "right", "back"] as const;

  const getMaterial = (_panelType: PanelType) => baseMaterial;

  const panelOptions = (panelType: PanelType): PanelMaterialOptions =>
    useDefaultMDF
      ? { edgeMaterial: getEdgeMaterial(), faceMaterial: getMaterial(panelType) }
      : { singleMaterial: getMaterial(panelType) };

  const panels = {
    left: createPanel(specs.left.size[0], specs.left.size[1], specs.left.size[2], "left", "left", panelOptions("left")),
    right: createPanel(specs.right.size[0], specs.right.size[1], specs.right.size[2], "right", "right", panelOptions("right")),
    top: createPanel(specs.top.size[0], specs.top.size[1], specs.top.size[2], "top", "top", panelOptions("top")),
    bottom: createPanel(specs.bottom.size[0], specs.bottom.size[1], specs.bottom.size[2], "bottom", "bottom", panelOptions("bottom")),
    back: createPanel(specs.back.size[0], specs.back.size[1], specs.back.size[2], "back", "back", panelOptions("back")),
  };

  (panelTypes as readonly string[]).forEach((key) => {
    const k = key as keyof typeof panels;
    const p = panels[k];
    const pos = specs[k].pos;
    p.position.set(pos[0], pos[1], pos[2]);
    root.add(p);
  });
  const drillMap: ViewerDrillMarkersByPanel = opts.drillMarkersByPanel ?? {
    cima: [],
    fundo: [],
    lateral_esquerda: [],
    lateral_direita: [],
  };
  addDrillMarkersToPanel(panels.top, "top", drillMap.cima);
  addDrillMarkersToPanel(panels.bottom, "bottom", drillMap.fundo);
  addDrillMarkersToPanel(panels.left, "left", drillMap.lateral_esquerda);
  addDrillMarkersToPanel(panels.right, "right", drillMap.lateral_direita);

  const shelfCount = Math.max(0, Math.floor(opts.shelves ?? 0));
  if (shelfCount > 0) {
    const shelfSpecs = getShelfSpecs(width, height, depth, shelfCount);
    const shelfMat = baseMaterial;
    shelfSpecs.forEach((spec, i) => {
      const mesh = createPanel(spec.size[0], spec.size[1], spec.size[2], `shelf-${i}`, "top", { singleMaterial: shelfMat });
      mesh.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
      root.add(mesh);
    });
  }

  const doorSpecs = buildDoorSpecs(Array.isArray(opts.doorLayerItems) ? opts.doorLayerItems : []);
  const drawerSpecs = buildDrawerSpecs(Array.isArray(opts.drawerLayerItems) ? opts.drawerLayerItems : []);
  doorSpecs.forEach((spec) => root.add(createDoorObject(spec, baseMaterial)));
  drawerSpecs.forEach((spec) => root.add(createDrawerObject(spec, baseMaterial)));

  root.position.set(0, 0, 0);

  return {
    root,
    panels,
    dimensions: { width, height, depth, thickness: THICKNESS_M },
  };
};

export const updateBoxModel = (model: BoxModel, options: BoxOptions = {}): BoxModel => {
  const opts = options ?? {};
  const { width, height, depth } = resolveDimensions(opts);
  const material = opts.material ?? model.panels.left.material;
  const specs = getPanelSpecs(width, height, depth);
  const panelKeys: (keyof typeof model.panels)[] = ["left", "right", "top", "bottom", "back"];

  panelKeys.forEach((key) => {
    const [wx, hy, dz] = specs[key].size;
    const [px, py, pz] = specs[key].pos;
    updatePanelGeometry(model.panels[key], wx, hy, dz);
    model.panels[key].position.set(px, py, pz);
  });

  if (opts.material != null) {
    Object.values(model.panels).forEach(panel => {
      panel.material = material;
    });
  }

  model.dimensions = { width, height, depth, thickness: THICKNESS_M };
  return model;
};

type PanelMaterialOptions =
  | { singleMaterial: THREE.Material }
  | { edgeMaterial: THREE.Material; faceMaterial: THREE.Material };

/** Garante que options tem sempre material/edgeMaterial válidos; nunca usa 'in' em undefined. */
function resolvePanelMaterialOptions(
  options: PanelMaterialOptions | null | undefined,
  _panelType: PanelType
): PanelMaterialOptions {
  if (options != null && typeof options === "object") {
    const hasEdge = "edgeMaterial" in options && options.edgeMaterial != null && options.faceMaterial != null;
    if (hasEdge) return { edgeMaterial: options.edgeMaterial, faceMaterial: options.faceMaterial };
    const single = "singleMaterial" in options ? options.singleMaterial : null;
    if (single != null) return { singleMaterial: single };
  }
  return {
    edgeMaterial: getEdgeMaterial(),
    faceMaterial: getFallbackPBRMaterial(),
  };
}

function createPanel(
  width: number,
  height: number,
  depth: number,
  name: string,
  panelType: PanelType,
  options?: PanelMaterialOptions | null
): THREE.Mesh {
  const resolved = resolvePanelMaterialOptions(options, panelType);
  const isEdgeFace = "edgeMaterial" in resolved;
  const geometry = isEdgeFace
    ? createBoxGeometryWithEdgeGroups(width, height, depth, getThinAxisForPanel(panelType))
    : (() => {
        const g = new THREE.BoxGeometry(width, height, depth);
        if (!g.attributes.uv2 && g.attributes.uv) {
          g.setAttribute("uv2", g.attributes.uv.clone());
        }
        return g;
      })();
  const material = isEdgeFace
    ? [resolved.edgeMaterial, resolved.faceMaterial]
    : resolved.singleMaterial;
  const mesh = new THREE.Mesh(geometry, material as THREE.Material);
  mesh.name = name;
  mesh.userData.panelType = panelType;
  mesh.userData.thinAxis = getThinAxisForPanel(panelType);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function updatePanelGeometry(panel: THREE.Mesh, width: number, height: number, depth: number) {
  panel.geometry.dispose();
  const thinAxis = panel.userData.thinAxis as 0 | 1 | 2 | undefined;
  const useEdgeGroups = Array.isArray(panel.material) && panel.material.length === 2 && thinAxis !== undefined;
  const geometry = useEdgeGroups
    ? createBoxGeometryWithEdgeGroups(width, height, depth, thinAxis)
    : (() => {
        const g = new THREE.BoxGeometry(width, height, depth);
        if (!g.attributes.uv2 && g.attributes.uv) {
          g.setAttribute("uv2", g.attributes.uv.clone());
        }
        return g;
      })();
  panel.geometry = geometry;
}

/** Compatível com o Viewer: devolve o grupo raiz do módulo (CIMA, FUNDO, LAT ESQ, LAT DIR, COSTA). */
export const buildBoxGroup = (options?: BoxOptions | null) => {
  const opts = options ?? {};
  const model = buildBox(opts);
  return model.root;
};

// Alias de compatibilidade interna para chamadas antigas em outros módulos.
export const buildBoxLegacy = buildBoxGroup;

const PANEL_NAMES = ["left", "right", "top", "bottom", "back"] as const;

/**
 * Atualiza um grupo criado por buildBoxGroup: geometria e posição de cada painel por nome (regras de marcenaria).
 * Todas as peças estruturais (laterais, base, tampo, fundo) são recalculadas a partir das dimensões atuais.
 * Sincroniza também prateleiras (shelf-0, shelf-1, ...) quando options.shelves é fornecido.
 */
export function updateBoxGroup(group: THREE.Group, options?: BoxOptions | null): { width: number; height: number; depth: number } {
  const opts = options ?? {};
  const { width, height, depth } = resolveDimensions(opts);
  if (import.meta.env.DEV) {
    console.warn("[BoxBuilder.updateBoxGroup] chamado — dimensões", { width, height, depth, childNames: group.children.map((c) => c.name) });
  }
  const specs = getPanelSpecs(width, height, depth);

  const toRemove: THREE.Object3D[] = [];
  const isGeneratedLayerName = (name: string) =>
    name.startsWith("shelf-") ||
    name.startsWith("door-leaf-") ||
    name.startsWith("door-layer-") ||
    name.startsWith("drawer-layer-") ||
    name.startsWith("drawer-front-") ||
    name.startsWith("drawer-body-");

  // Marcar e remover elementos gerados (prateleiras, portas, gavetas) para recriar depois
  group.children.forEach((child) => {
    if (isGeneratedLayerName(child.name)) toRemove.push(child);
  });
  toRemove.forEach((c) => group.remove(c));

  // Atualizar cada painel estrutural explicitamente por nome: geometria e posição sempre derivadas das dimensões atuais
  for (const panelName of PANEL_NAMES) {
    const child = group.children.find((c) => c.name === panelName);
    if (!(child instanceof THREE.Mesh) || !child.geometry) continue;
    const spec = specs[panelName];
    if (!spec) continue;
    updatePanelGeometry(child, spec.size[0], spec.size[1], spec.size[2]);
    child.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
    // Limpar base da vista explodida para que o Viewer use esta nova posição (evita que applyExplodedViewForObject restaure posição antiga).
    delete (child.userData as Record<string, unknown>).explodedBasePosition;
    child.updateMatrix();
    const oldMarkers = child.children.filter((c) => c.userData?.isDrillMarker);
    oldMarkers.forEach((m) => child.remove(m));
  }
  const shelfCount = Math.max(0, Math.floor(opts.shelves ?? 0));
  const shelfSpecs = getShelfSpecs(width, height, depth, shelfCount);
  const baseMaterial = group.children[0] instanceof THREE.Mesh ? (group.children[0] as THREE.Mesh).material : getFallbackPBRMaterial();
  const mat = Array.isArray(baseMaterial) ? baseMaterial[0] : baseMaterial;
  const drillMap: ViewerDrillMarkersByPanel = opts.drillMarkersByPanel ?? {
    cima: [],
    fundo: [],
    lateral_esquerda: [],
    lateral_direita: [],
  };
  const topPanel = group.children.find((c) => c instanceof THREE.Mesh && c.name === "top") as THREE.Mesh | undefined;
  const bottomPanel = group.children.find((c) => c instanceof THREE.Mesh && c.name === "bottom") as THREE.Mesh | undefined;
  const leftPanel = group.children.find((c) => c instanceof THREE.Mesh && c.name === "left") as THREE.Mesh | undefined;
  const rightPanel = group.children.find((c) => c instanceof THREE.Mesh && c.name === "right") as THREE.Mesh | undefined;
  if (topPanel) addDrillMarkersToPanel(topPanel, "top", drillMap.cima);
  if (bottomPanel) addDrillMarkersToPanel(bottomPanel, "bottom", drillMap.fundo);
  if (leftPanel) addDrillMarkersToPanel(leftPanel, "left", drillMap.lateral_esquerda);
  if (rightPanel) addDrillMarkersToPanel(rightPanel, "right", drillMap.lateral_direita);
  shelfSpecs.forEach((spec, i) => {
    const mesh = createPanel(spec.size[0], spec.size[1], spec.size[2], `shelf-${i}`, "top", { singleMaterial: mat as THREE.Material });
    mesh.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
    group.add(mesh);
  });

  const doorSpecs = buildDoorSpecs(Array.isArray(opts.doorLayerItems) ? opts.doorLayerItems : []);
  const drawerSpecs = buildDrawerSpecs(Array.isArray(opts.drawerLayerItems) ? opts.drawerLayerItems : []);
  doorSpecs.forEach((spec) => group.add(createDoorObject(spec, mat as THREE.Material)));
  drawerSpecs.forEach((spec) => group.add(createDrawerObject(spec, mat as THREE.Material)));

  group.updateMatrixWorld(true);
  return { width, height, depth };
}

/** Atualiza um único Mesh (caixa sólida); compatibilidade com caixas não modulares. */
export const updateBoxGeometry = (mesh: THREE.Mesh, options: BoxOptions = {}) => {
  const { width, height, depth } = resolveDimensions(options);
  mesh.geometry.dispose();
  const geometry = new THREE.BoxGeometry(width, height, depth);
  if (!geometry.attributes.uv2 && geometry.attributes.uv) {
    geometry.setAttribute("uv2", geometry.attributes.uv);
  }
  mesh.geometry = geometry;
  return { width, height, depth };
};
