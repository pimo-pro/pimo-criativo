import * as THREE from "three";
import { getDefaultOfficialMaterial } from "../../core/materials/materials.api";
import { SYSTEM_THICKNESS_MM, SYSTEM_BACK_MM } from "../../core/baseCabinets";
import type { DoorLayerItem, DrawerLayerItem } from "../../models/BoxLayers";
import type { BoxPanelIds, TechnicalDrillHole, ViewerDrillMarkersByPanel } from "../../core/types";
import {
  getEdgeMaterial,
  getFallbackPBRMaterial,
  getMaterialForOfficialId,
  resolvePanelMaterialOptions,
} from "./BoxMaterialApplier";
import { PanelFactory } from "./PanelFactory";
import { applyDrillHolesToPanelGeometry } from "./DrillGeometryBuilder";
import {
  buildDoorSpecs as buildDoorSpecsFromFactory,
  createDoorObject as createDoorObjectFromFactory,
  getDoorSpecFingerprint as getDoorSpecFingerprintFromFactory,
  getDoorSpecFromGroup as getDoorSpecFromGroupFromFactory,
} from "./DoorFactory";
import {
  buildDrawerSpecs as buildDrawerSpecsFromFactory,
  createDrawerObject as createDrawerObjectFromFactory,
  getDrawerSpecFingerprint as getDrawerSpecFingerprintFromFactory,
  getDrawerStructureFingerprint as getDrawerStructureFingerprintFromFactory,
  getDrawerMotionKey as getDrawerMotionKeyFromFactory,
  syncDrawerLayerMotion as syncDrawerLayerMotionFromFactory,
} from "./DrawerFactory";
import { buildBoxGroupWithDeps, buildBoxWithDeps } from "./BoxAssembler";
import {
  updateBoxGeometryWithDeps,
  updateBoxGroupWithDeps,
  updateBoxModelWithDeps,
} from "./BoxUpdater";
import { getWardrobeGroupFromBaseCabinetId, isWardrobeVerticalDividerEnabled } from "../../core/wardrobe/wardrobeRules";
import { getCornerCabinetConfig } from "../../core/cornerCabinet";
import {
  boxUsesDivShelfMode,
  resolveShelfAbsoluteCenterYsForPlan,
  resolveShelfPlacementPlans,
  resolveShelfWidthForPlan,
} from "../../core/divSep/shelfDrilling";
import type { DivSepBoxLike } from "../../core/divSep/types";
import { resolveDivisorCenterX } from "../../core/divSep/dimensions";

/**
 * Camada oficial de fabricação: gera TODAS as peças segundo as regras industriais.
 * Aplica-se a modelos base, caixas manuais, calculadora, duplicadas, templates e personalizadas.
 * Dimensões em cena em metros (1 unidade = 1 m).
 * - Profundidade exterior: `depth` (= profundidade externa em m; p.ex. alinhada a `profundidadeExterna` mm).
 * - Costa: espessura padrão 10 mm (SYSTEM_BACK_MM), no interior do volume; não prolonga o bbox em Z.
 * - Cima/fundo: largura total × profundidade total × 19 mm.
 * - Laterais: DENTRO; altura = altura - 38 mm, profundidade = total, espessura 19 mm.
 * - Prateleiras: DENTRO; largura = largura - laterais - 1 mm - 1 mm; profundidade = profundidade - 5 mm (folga frontal), 19 mm.
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
  /**
   * Profundidade da carcaça paramétrica no Viewer (m), alinhada a `getProfundidadeInternaUtilMm`.
   * Se definido, a geometria (laterais, tampo, fundo, prateleiras, costa relativa) usa este valor em vez de `depth`.
   */
  carcassDepthM?: number;
  /**
   * Profundidade externa do módulo (m) para reflow / bbox / pés no ViewerCore.
   * Não altera `resolveDimensions` quando `carcassDepthM` está definido.
   */
  layoutDepthM?: number;
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
  /** Rotação em radianos (manipulação visual 3D). */
  rotationX?: number;
  rotationY?: number;
  rotationZ?: number;
  /** Direção da costa (parte traseira) em radianos: 0 | π/2 | π | -π/2. Auto-rotate alinha costa à parede. */
  costaRotationY?: number;
  /** Se true, o viewer não reposiciona esta caixa no reflow. */
  manualPosition?: boolean;
  /** Tipo de armário para altura automática: inferior (base) ou superior (parede). */
  cabinetType?: "lower" | "upper" | null;
  /** Altura do pé (PE) em cm para caixas inferiores; base da caixa fica a PE cm do piso (default 10). */
  pe_cm?: number;
  /** Altura dos pés em mm (controle do utilizador). */
  feetHeight?: number;
  /** Recuo frontal dos pés em mm (controle do utilizador). */
  feetOffsetFront?: number;
  /** Ativa/desativa os pés de 10 cm para caixas inferiores. */
  feetEnabled?: boolean;
  /** Se false, o viewer não altera rotation.y (modo manual; botão RODAR). Default true. */
  autoRotateEnabled?: boolean;
  /** Se true, a peça não pode ser movida nem transformada (apenas selecionável). */
  locked?: boolean;
  /** Modelo base (ex.: pi-base-600); usado pelo viewer para furação lateral PI sem depender de prateleiras/gavetas. */
  baseCabinetId?: string;
  /** Canto v2: orientação do módulo (frente fixa + porta). */
  orientation?: import("../../core/cornerCabinet/cornerCabinetRules").CornerOrientation;
  /** Debug FASE 5: marcadores visuais de furação nas gavetas. */
  showDrawerDrilling?: boolean;
  /** Sem costa traseira: não gera mesh `back` no viewer. Sincronizado com `costaAtiva`. */
  noBackPanel?: boolean;
  /** @deprecated Preferir `noBackPanel`; mantido para compatibilidade de sync. */
  costaAtiva?: boolean;
  /** Tipo de porta da caixa (contexto industrial DIV/SEP → Pint). */
  portaTipo?: string;
  /** Número de gavetas (contexto industrial DIV/SEP → Pint com frente). */
  gavetas?: number;
  /** Divisórios e separadores dinâmicos (estado da caixa). */
  divisores?: import("../../core/divSep/types").DivisorItem[];
  separadores?: import("../../core/divSep/types").SeparadorItem[];
  /** Opções avançadas de prateleiras (grelha / direcção). */
  shelfOptions?: import("../../core/divSep/types").BoxShelfOptions;
  /** Material industrial do corpo (canonicalId) para painéis com material próprio (costa/separador). */
  bodyMaterialId?: string;
  /** Override de material da COSTA (canonicalId). */
  costaMaterialId?: string;
  /** Override de material dos separadores (canonicalId). */
  separadorMaterialId?: string;
  /** Override de material da frente fixa canto v2 (canonicalId). */
  frenteFixaMaterialId?: string;
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
/** Folga lateral para prateleiras (1 mm + 1 mm). */
const SHELF_WIDTH_CLEARANCE_M = 0.002;
/** Folga frontal da prateleira (5 mm). */
const SHELF_DEPTH_CLEARANCE_M = 0.005;
/** Offset visual (1 mm) para dentro: evita Z-fighting entre prateleiras e paredes internas; não altera medidas/cutlist/CNC. */
const SHELF_VISUAL_INSET_M = 0.001;
const resolveDimensions = (options: BoxOptions = {}) => {
  const size = options.size ?? 1;
  const width = options.width ?? size;
  const height = options.height ?? size;
  const depth = options.carcassDepthM ?? options.depth ?? size;
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
 * - Costa: dentro do volume; largura total × altura total × 10 mm; centro em z = -depth/2 + espessuraCosta/2.
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
      pos: [0, 0, -depth / 2 + BACK_THICKNESS_M / 2] as const,
    },
  };
}

export type BoxPanelLayoutSpecs = ReturnType<typeof getPanelSpecs>;

/**
 * Prateleiras: DENTRO da caixa. largura = width - 2*espessura lateral - 1 mm - 1 mm; profundidade = depth - 5 mm; espessura 19 mm.
 * Posição z: centrada na profundidade da prateleira + SHELF_VISUAL_INSET_M (evita Z-fighting).
 */
function getShelfSpecs(width: number, height: number, depth: number, count: number, opts?: BoxOptions) {
  const shelfWidth = Math.max(0.001, width - 2 * THICKNESS_M - SHELF_WIDTH_CLEARANCE_M);
  const shelfDepth = Math.max(0.001, depth - SHELF_DEPTH_CLEARANCE_M);
  const interiorHeight = Math.max(0.001, height - 2 * THICKNESS_M);
  const centerZ = -depth / 2 + shelfDepth / 2 + SHELF_VISUAL_INSET_M;
  const specs: { size: [number, number, number]; pos: [number, number, number] }[] = [];
  if (count < 1) return specs;

  // Roupeiro: as prateleiras só existem na secção superior; as posições dependem do divisor horizontal e (quando aplicável) do divisor vertical.
  const cornerCfg = getCornerCabinetConfig(opts?.baseCabinetId);
  if (cornerCfg && count >= 1) {
    const extraRecessM = cornerCfg.shelfDepthExtraRecessMm / 1000;
    const shelfDepthCorner = Math.max(0.001, depth - SHELF_DEPTH_CLEARANCE_M - extraRecessM);
    const centerZCorner = -depth / 2 + shelfDepthCorner / 2 + SHELF_VISUAL_INSET_M;
    const interiorHeight = Math.max(0.001, height - 2 * THICKNESS_M);
    const spacing = interiorHeight / (count + 1);
    const yMin = -height / 2 + THICKNESS_M + spacing;
    for (let i = 0; i < count; i++) {
      const y = yMin + i * spacing;
      specs.push({
        size: [shelfWidth, THICKNESS_M, shelfDepthCorner],
        pos: [0, y, centerZCorner],
      });
    }
    return specs;
  }

  const wardrobeGroup = getWardrobeGroupFromBaseCabinetId(opts?.baseCabinetId);
  if (wardrobeGroup) {
    const feetHeightMm = Math.max(40, opts?.feetHeight ?? 100);
    const heightMm = height * 1000;
    const widthMm = width * 1000;
    const thicknessMm = THICKNESS_M * 1000;

    const computeUpperShelfCenterYLocal = (): number => {
      if (wardrobeGroup === "T") return 0;
      const dividerFromFloorMm = wardrobeGroup === "H" ? 1900 : 1600;
      const lowerSectionHeightMm = dividerFromFloorMm - Math.max(0, feetHeightMm);
      const safeLowerSectionHeightMm = Math.max(300, Math.min(heightMm - 300, lowerSectionHeightMm));
      const dividerCenterLocalY_mm = -heightMm / 2 + safeLowerSectionHeightMm;

      const upperInteriorLowerBound_mm = dividerCenterLocalY_mm + thicknessMm / 2;
      const upperInteriorUpperBound_mm = heightMm / 2 - thicknessMm;
      const upperInteriorHeight_mm = Math.max(1, upperInteriorUpperBound_mm - upperInteriorLowerBound_mm);
      const upperShelfCenterYLocal_mm = upperInteriorLowerBound_mm + upperInteriorHeight_mm / 2;
      return upperShelfCenterYLocal_mm / 1000;
    };

    const upperShelfCenterY = computeUpperShelfCenterYLocal();

    if (wardrobeGroup === "T") {
      specs.push({
        size: [shelfWidth, THICKNESS_M, shelfDepth],
        pos: [0, 0, centerZ],
      });
      return specs;
    }

    const verticalDividerEnabled = isWardrobeVerticalDividerEnabled(widthMm);
    const shelfWidthPerSide = Math.max(0.001, (width - 3 * THICKNESS_M) / 2 - SHELF_WIDTH_CLEARANCE_M);
    const leftCompartmentCenterX = -width / 4 + THICKNESS_M / 4;
    const rightCompartmentCenterX = width / 4 - THICKNESS_M / 4;

    // Quando vertical divisor existe (>= 800mm), o catálogo passa count=2 para representar “1 prateleira por lado”.
    if (verticalDividerEnabled && count >= 2) {
      specs.push({
        size: [shelfWidthPerSide, THICKNESS_M, shelfDepth],
        pos: [leftCompartmentCenterX, upperShelfCenterY, centerZ],
      });
      specs.push({
        size: [shelfWidthPerSide, THICKNESS_M, shelfDepth],
        pos: [rightCompartmentCenterX, upperShelfCenterY, centerZ],
      });
      return specs;
    }

    specs.push({
      size: [shelfWidth, THICKNESS_M, shelfDepth],
      pos: [0, upperShelfCenterY, centerZ],
    });
    return specs;
  }

  const spacing = interiorHeight / (count + 1);
  const yMin = -height / 2 + THICKNESS_M + spacing;

  const divShelfBox: DivSepBoxLike | null =
    ((opts?.divisores?.length ?? 0) > 0 || (opts?.separadores?.length ?? 0) > 0) && count >= 1
      ? {
          dimensoes: { largura: width * 1000, altura: height * 1000, profundidade: depth * 1000 },
          espessura: THICKNESS_M * 1000,
          profundidadeExterna: depth * 1000,
          prateleiras: count,
          divisores: opts?.divisores,
          separadores: opts?.separadores,
          shelfOptions: opts?.shelfOptions,
        }
      : null;

  if (divShelfBox && boxUsesDivShelfMode(divShelfBox)) {
    const plans = resolveShelfPlacementPlans(divShelfBox);
    for (const plan of plans) {
      const shelfWidthM = Math.max(0.001, resolveShelfWidthForPlan(divShelfBox, plan) / 1000);
      const absYs = resolveShelfAbsoluteCenterYsForPlan(divShelfBox, plan, count);
      let shelfCenterX = 0;
      if (plan.mode === "short" && plan.div && plan.lado) {
        const divCenterXAbs = resolveDivisorCenterX(divShelfBox, plan.div);
        const divCenterXM = divCenterXAbs / 1000 - width / 2;
        shelfCenterX =
          plan.lado === "esquerda"
            ? -width / 2 + THICKNESS_M + shelfWidthM / 2 + 0.001
            : divCenterXM + THICKNESS_M / 2 + shelfWidthM / 2 + 0.001;
      }
      for (const absY of absYs) {
        const y = absY / 1000 - height / 2;
        specs.push({
          size: [shelfWidthM, THICKNESS_M, shelfDepth],
          pos: [shelfCenterX, y, centerZ],
        });
      }
    }
    if (plans.length > 0) return specs;
  }

  for (let i = 0; i < count; i++) {
    const y = yMin + i * spacing;
    specs.push({
      size: [shelfWidth, THICKNESS_M, shelfDepth],
      pos: [0, y, centerZ],
    });
  }
  return specs;
}

const panelFactory = new PanelFactory({ resolvePanelMaterialOptions });

/**
 * Especificação de porta para o Viewer 3D (derivada de DoorLayerItem).
 * Única fonte de verdade para dados é DoorLayerItem; DoorSpec é a projeção em metros para render.
 * buildDoorSpecs() converte DoorLayerItem[] → DoorSpec[].
 */
export type DoorSpec = {
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

/** Converte o modelo de porta (DoorLayerItem) para especificação de render (DoorSpec). Ordem preservada. */
function buildDoorSpecs(items: DoorLayerItem[]): DoorSpec[] {
  return buildDoorSpecsFromFactory(items);
}

/** Fingerprint do spec da porta para detectar alterações e recriar apenas a porta alterada. */
const DOOR_SPEC_FINGERPRINT_KEY = "doorSpecFingerprint";

function getDoorSpecFingerprint(spec: DoorSpec, materialName?: string): string {
  return getDoorSpecFingerprintFromFactory(spec, materialName);
}

/** Fingerprint do spec da gaveta para detectar alterações (ex.: isOpen); quando muda, recriamos só essa gaveta. */
const DRAWER_SPEC_FINGERPRINT_KEY = "drawerSpecFingerprint";

function getDrawerSpecFingerprint(spec: DrawerSpec, materialName?: string): string {
  return getDrawerSpecFingerprintFromFactory(spec, materialName);
}

function getDrawerStructureFingerprint(
  spec: DrawerSpec,
  materials?: import("./DrawerFactory").DrawerStructureMaterials | string
): string {
  return getDrawerStructureFingerprintFromFactory(spec, materials);
}

function getDrawerMotionKey(spec: Pick<DrawerSpec, "isOpen" | "pullDistanceM">): string {
  return getDrawerMotionKeyFromFactory(spec);
}

/**
 * Converte DrawerLayerItem[] para DrawerSpec[] (formato Three.js)
 * 
 * NOTA: Não faz cálculos! Apenas converte mm -> metros.
 * Todos os cálculos de dimensões estão em src/core/drawers/
 */
function buildDrawerSpecs(items: DrawerLayerItem[], options?: { showDrillingMarkers?: boolean }): DrawerSpec[] {
  return buildDrawerSpecsFromFactory(items, options);
}

/**
 * Cria o objeto 3D da porta (grupo pivot + mesh do painel + furos).
 * Todos os nós recebem userData.doorLayerId para seleção, context menu e outline.
 * O ViewerCore deve chamar applyPanelIdsToBox no boxGroup após adicionar a porta, para definir userData.boxId.
 */
export function createDoorObject(spec: DoorSpec, material: THREE.Material, doorHoles?: TechnicalDrillHole[]): THREE.Object3D {
  return createDoorObjectFromFactory(spec, material, doorHoles);
}

/**
 * Extrai um DoorSpec a partir de um grupo de porta existente (door-layer-*).
 * Usado pelo ViewerCore para reconstruir a porta com novo material (novo uuid) e evitar cache de rotação.
 */
export function getDoorSpecFromGroup(group: THREE.Group): DoorSpec | null {
  return getDoorSpecFromGroupFromFactory(group);
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
function createDrawerObject(
  spec: DrawerSpec,
  materials: import("./DrawerFactory").DrawerObjectMaterials | THREE.Material
): THREE.Object3D {
  return createDrawerObjectFromFactory(spec, materials);
}

function getAssemblerDeps() {
  return {
    resolveDimensions,
    getPanelSpecs,
    getShelfSpecs,
    panelFactory,
    getFallbackPBRMaterial,
    getEdgeMaterial,
    applyDrillHolesToPanelGeometry,
    buildDoorSpecs,
    buildDrawerSpecs,
    createDoorObject,
    createDrawerObject,
    getMaterialForOfficialId,
    getDefaultOfficialMaterialId: () => getDefaultOfficialMaterial().canonicalId,
    thicknessM: THICKNESS_M,
  };
}

export const buildBox = (options: BoxOptions = {}): BoxModel => {
  return buildBoxWithDeps(options, getAssemblerDeps());
};

export const updateBoxModel = (model: BoxModel, options: BoxOptions = {}): BoxModel => {
  return updateBoxModelWithDeps(model, options, getUpdaterDeps());
};
/** Compatível com o Viewer: devolve o grupo raiz do módulo (CIMA, FUNDO, LAT ESQ, LAT DIR, COSTA). */
export const buildBoxGroup = (options?: BoxOptions | null) => {
  return buildBoxGroupWithDeps(options, getAssemblerDeps());
};

// Alias de compatibilidade interna para chamadas antigas em outros módulos.
export const buildBoxLegacy = buildBoxGroup;

const PANEL_NAMES = ["left", "right", "top", "bottom", "back"] as const;

/** Dimensões aplicadas na última chamada a updateBoxGroup (para evitar rebuild completo quando só portas/gavetas mudam). */
const LAST_DIMS_KEY = "lastUpdateBoxGroupDimensions";

function getUpdaterDeps() {
  return {
    resolveDimensions,
    getPanelSpecs,
    getShelfSpecs,
    panelFactory,
    getFallbackPBRMaterial,
    applyDrillHolesToPanelGeometry,
    buildDoorSpecs,
    buildDrawerSpecs,
    getDoorSpecFingerprint,
    getDrawerSpecFingerprint,
    getDrawerStructureFingerprint,
    getDrawerMotionKey,
    syncDrawerLayerMotion: syncDrawerLayerMotionFromFactory,
    createDoorObject,
    createDrawerObject,
    getMaterialForOfficialId,
    getDefaultOfficialMaterialId: () => getDefaultOfficialMaterial().canonicalId,
    thicknessM: THICKNESS_M,
    panelNames: PANEL_NAMES,
    lastDimsKey: LAST_DIMS_KEY,
    doorSpecFingerprintKey: DOOR_SPEC_FINGERPRINT_KEY,
    drawerSpecFingerprintKey: DRAWER_SPEC_FINGERPRINT_KEY,
  };
}

/**
 * Atualiza um grupo criado por buildBoxGroup: geometria e posição de cada painel por nome.
 * Atualização incremental: só altera painéis estruturais quando as dimensões mudam; para portas,
 * gavetas e prateleiras remove apenas os que deixaram de ser necessários e adiciona apenas os novos,
 * evitando loops com useCalculadoraSync e storms de efeitos passivos.
 */
export function updateBoxGroup(group: THREE.Group, options?: BoxOptions | null): { width: number; height: number; depth: number } {
  return updateBoxGroupWithDeps(group, options, getUpdaterDeps());
}

/** Atualiza um único Mesh (caixa sólida); compatibilidade com caixas não modulares. */
export const updateBoxGeometry = (mesh: THREE.Mesh, options: BoxOptions = {}) => {
  return updateBoxGeometryWithDeps(mesh, options, getUpdaterDeps());
};
