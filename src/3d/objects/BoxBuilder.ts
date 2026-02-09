import * as THREE from "three";
import { createWoodMaterial } from "../materials/WoodMaterial";
import { defaultMaterialSet, getMaterialPreset } from "../materials/MaterialLibrary";
import { SYSTEM_THICKNESS_MM, SYSTEM_BACK_MM } from "../../core/baseCabinets";

/**
 * Camada oficial de fabricação: gera TODAS as peças segundo as regras industriais.
 * Aplica-se a modelos base, caixas manuais, calculadora, duplicadas, templates e personalizadas.
 * Dimensões em cena em metros (1 unidade = 1 m).
 * - Costa (fundo): 10 mm, sempre ATRÁS da caixa; profundidade da caixa NUNCA é reduzida pela costa.
 * - Cima/fundo: largura total × profundidade total × 19 mm.
 * - Laterais: DENTRO; altura = altura - 38 mm, profundidade = total, espessura 19 mm.
 * - Prateleiras: DENTRO; largura = largura - 2 mm, profundidade = profundidade - 10 mm, 19 mm.
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
  /** Número de portas (0, 1 ou 2). */
  doors?: number;
  /** Tipo de dobradiça (futuro uso). */
  hingeType?: string;
  /** Número de gavetas (0+). */
  drawers?: number;
  /** Tipo de corrediça (futuro uso). */
  runnerType?: string;
  /** Se true, não cria geometria paramétrica; o grupo serve apenas para o(s) modelo(s) GLB (caixa = GLB). */
  cadOnly?: boolean;
  /** Rotação Y em radianos (manipulação visual). */
  rotationY?: number;
  /** Direção da costa (parte traseira) em radianos: 0 | π/2 | π | -π/2. Auto-rotate alinha costa à parede. */
  costaRotationY?: number;
  /** Se true, o viewer não reposiciona esta caixa no reflow. */
  manualPosition?: boolean;
  /** Tipo de armário para altura automática: inferior (base) ou superior (parede). */
  cabinetType?: "lower" | "upper";
  /** Altura do pé (PE) em cm para caixas inferiores; base da caixa fica a PE cm do piso (default 10). */
  pe_cm?: number;
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

type PanelSpec = { size: [number, number, number]; pos: [number, number, number] };

/** Portas: SEMPRE fora da caixa; largura = largura do vão; altura = altura total; espessura 19 mm. */
function getDoorSpecs(width: number, height: number, depth: number, count: number): PanelSpec[] {
  const doorCount = Math.max(0, Math.floor(count));
  if (doorCount < 1) return [];
  const openingWidth = Math.max(0.001, width - 2 * THICKNESS_M);
  const doorWidth = doorCount === 2 ? openingWidth / 2 : openingWidth;
  const z = depth / 2 + THICKNESS_M / 2;
  const specs: PanelSpec[] = [];
  for (let i = 0; i < doorCount; i++) {
    const x = doorCount === 2 ? (i === 0 ? -doorWidth / 2 : doorWidth / 2) : 0;
    specs.push({
      size: [doorWidth, height, THICKNESS_M],
      pos: [x, 0, z],
    });
  }
  return specs;
}

/** Gavetas: largura interna; profundidade = depth − 10 mm; espessura 19 mm (placeholder). */
function getDrawerSpecs(width: number, height: number, depth: number, count: number): PanelSpec[] {
  const drawerCount = Math.max(0, Math.floor(count));
  if (drawerCount < 1) return [];
  const openingWidth = Math.max(0.001, width - 2 * THICKNESS_M);
  const drawerDepth = Math.max(0.001, depth - BACK_THICKNESS_M);
  const interiorHeight = Math.max(0.001, height - 2 * THICKNESS_M);
  const drawerHeight = interiorHeight / drawerCount;
  const yStart = -height / 2 + THICKNESS_M + drawerHeight / 2;
  const z = depth / 2 - drawerDepth / 2;
  const specs: PanelSpec[] = [];
  for (let i = 0; i < drawerCount; i++) {
    const y = yStart + i * drawerHeight;
    specs.push({
      size: [openingWidth, drawerHeight, drawerDepth],
      pos: [0, y, z],
    });
  }
  return specs;
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

  const doorCount = Math.max(0, Math.floor(opts.doors ?? 0));
  if (doorCount > 0) {
    const doorSpecs = getDoorSpecs(width, height, depth, doorCount);
    const doorMat = baseMaterial;
    doorSpecs.forEach((spec, i) => {
      const mesh = createPanel(spec.size[0], spec.size[1], spec.size[2], `door-${i}`, "front", { singleMaterial: doorMat });
      mesh.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
      if (opts.hingeType) mesh.userData.hingeType = opts.hingeType;
      root.add(mesh);
    });
  }

  const drawerCount = Math.max(0, Math.floor(opts.drawers ?? 0));
  if (drawerCount > 0) {
    const drawerSpecs = getDrawerSpecs(width, height, depth, drawerCount);
    const drawerMat = baseMaterial;
    drawerSpecs.forEach((spec, i) => {
      const mesh = createPanel(spec.size[0], spec.size[1], spec.size[2], `drawer-${i}`, "front", { singleMaterial: drawerMat });
      mesh.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
      if (opts.runnerType) mesh.userData.runnerType = opts.runnerType;
      root.add(mesh);
    });
  }

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
export const buildBoxLegacy = (options?: BoxOptions | null) => {
  const opts = options ?? {};
  const model = buildBox(opts);
  return model.root;
};

const PANEL_NAMES = ["left", "right", "top", "bottom", "back"] as const;

/**
 * Atualiza um grupo criado por buildBoxLegacy: geometria e posição de cada painel por nome (regras de marcenaria).
 * Sincroniza também prateleiras (shelf-0, shelf-1, ...) quando options.shelves é fornecido.
 */
export function updateBoxGroup(group: THREE.Group, options?: BoxOptions | null): { width: number; height: number; depth: number } {
  const opts = options ?? {};
  const { width, height, depth } = resolveDimensions(opts);
  const specs = getPanelSpecs(width, height, depth);

  const toRemove: THREE.Object3D[] = [];
  group.children.forEach((child) => {
    if (!(child instanceof THREE.Mesh) || !child.geometry) return;
    const name = child.name;
    if (PANEL_NAMES.includes(name as (typeof PANEL_NAMES)[number])) {
      const spec = specs[name as keyof typeof specs];
      if (spec) {
        updatePanelGeometry(child, spec.size[0], spec.size[1], spec.size[2]);
        child.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
      }
      return;
    }
    if (name.startsWith("shelf-") || name.startsWith("door-") || name.startsWith("drawer-")) {
      toRemove.push(child);
    }
  });

  toRemove.forEach((c) => group.remove(c));
  const shelfCount = Math.max(0, Math.floor(opts.shelves ?? 0));
  const shelfSpecs = getShelfSpecs(width, height, depth, shelfCount);
  const baseMaterial = group.children[0] instanceof THREE.Mesh ? (group.children[0] as THREE.Mesh).material : getFallbackPBRMaterial();
  const mat = Array.isArray(baseMaterial) ? baseMaterial[0] : baseMaterial;
  shelfSpecs.forEach((spec, i) => {
    const mesh = createPanel(spec.size[0], spec.size[1], spec.size[2], `shelf-${i}`, "top", { singleMaterial: mat as THREE.Material });
    mesh.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
    group.add(mesh);
  });

  const doorCount = Math.max(0, Math.floor(opts.doors ?? 0));
  const doorSpecs = getDoorSpecs(width, height, depth, doorCount);
  doorSpecs.forEach((spec, i) => {
    const mesh = createPanel(spec.size[0], spec.size[1], spec.size[2], `door-${i}`, "front", { singleMaterial: mat as THREE.Material });
    mesh.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
    if (opts.hingeType) mesh.userData.hingeType = opts.hingeType;
    group.add(mesh);
  });

  const drawerCount = Math.max(0, Math.floor(opts.drawers ?? 0));
  const drawerSpecs = getDrawerSpecs(width, height, depth, drawerCount);
  drawerSpecs.forEach((spec, i) => {
    const mesh = createPanel(spec.size[0], spec.size[1], spec.size[2], `drawer-${i}`, "front", { singleMaterial: mat as THREE.Material });
    mesh.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
    if (opts.runnerType) mesh.userData.runnerType = opts.runnerType;
    group.add(mesh);
  });

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
