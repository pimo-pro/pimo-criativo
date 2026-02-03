import * as THREE from "three";
import { createWoodMaterial } from "../materials/WoodMaterial";
import { defaultMaterialSet, getMaterialPreset } from "../materials/MaterialLibrary";

/**
 * Dimensões em unidades de cena (Three.js).
 * Convenção: 1 unidade = 1 metro.
 * Valores vindos da calculadora (mm) devem ser convertidos (÷1000) antes de passar para buildBox/updateBox.
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
  thickness?: number;
  /** Se true, não cria geometria paramétrica; o grupo serve apenas para o(s) modelo(s) GLB (caixa = GLB). */
  cadOnly?: boolean;
  /** Rotação Y em radianos (manipulação visual). */
  rotationY?: number;
  /** Se true, o viewer não reposiciona esta caixa no reflow. */
  manualPosition?: boolean;
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

/** Dimensões padrão para um módulo de armário (cozinha/roupeiro) sem porta, em metros (1 unidade = 1 m). */
export const CABINET_MODULE_PRESET = {
  width: 0.6,
  height: 0.72,
  depth: 0.5,
  thickness: 0.018,
} as const;

/** Opções para gerar um módulo de armário com valores padrão; pode sobrepor com options. */
export function getCabinetModuleOptions(overrides: Partial<BoxOptions> = {}): BoxOptions {
  return {
    width: CABINET_MODULE_PRESET.width,
    height: CABINET_MODULE_PRESET.height,
    depth: CABINET_MODULE_PRESET.depth,
    thickness: CABINET_MODULE_PRESET.thickness,
    ...overrides,
  };
}

const resolveDimensions = (options: BoxOptions = {}) => {
  const size = options.size ?? 1;
  const width = options.width ?? size;
  const height = options.height ?? size;
  const depth = options.depth ?? size;
  const thickness = options.thickness ?? 0.01; // 0.01 m = 10 mm
  return {
    width: Math.max(0.001, width),
    height: Math.max(0.001, height),
    depth: Math.max(0.001, depth),
    thickness: Math.max(0.001, thickness),
  };
};

/** Dimensões e posições de cada painel (X, Y, Z). Única fonte de verdade para buildBox e updateBoxModel. */
function getPanelSpecs(width: number, height: number, depth: number, thickness: number) {
  return {
    left: { size: [thickness, height, depth] as const, pos: [-width / 2 + thickness / 2, 0, 0] as const },
    right: { size: [thickness, height, depth] as const, pos: [width / 2 - thickness / 2, 0, 0] as const },
    top: { size: [width - 2 * thickness, thickness, depth - 2 * thickness] as const, pos: [0, height / 2 - thickness / 2, 0] as const },
    bottom: { size: [width - 2 * thickness, thickness, depth - 2 * thickness] as const, pos: [0, -height / 2 + thickness / 2, 0] as const },
    back: { size: [width - 2 * thickness, height - 2 * thickness, thickness] as const, pos: [0, 0, -depth / 2 + thickness / 2] as const },
  };
}

type PanelType = "left" | "right" | "top" | "bottom" | "back";

let cachedFallbackMaterial: THREE.MeshStandardMaterial | null = null;

/** Material PBR de fallback (MDF Branco) — nunca cor sólida. */
function getFallbackPBRMaterial(): THREE.MeshStandardMaterial {
  if (cachedFallbackMaterial) return cachedFallbackMaterial;
  const preset = getMaterialPreset(defaultMaterialSet, "mdf_branco");
  if (!preset?.maps?.colorMap) {
    throw new Error("MaterialLibrary: mdf_branco preset required");
  }
  const loader = new THREE.TextureLoader();
  const { material } = createWoodMaterial(preset.maps, { ...preset.options, anisotropy: 4 }, loader);
  cachedFallbackMaterial = material;
  return material;
}

let cachedEdgeMaterial: THREE.MeshStandardMaterial | null = null;

/** Material para arestas (corte) — PBR com textura, cor ligeiramente mais escura. */
function getEdgeMaterial(): THREE.MeshStandardMaterial {
  if (cachedEdgeMaterial) return cachedEdgeMaterial;
  const preset = getMaterialPreset(defaultMaterialSet, "mdf_branco");
  if (!preset?.maps?.colorMap) throw new Error("MaterialLibrary: mdf_branco required");
  const loader = new THREE.TextureLoader();
  const { material } = createWoodMaterial(preset.maps, {
    ...preset.options,
    color: "#b8a898",
    anisotropy: 4,
  }, loader);
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
  const { width, height, depth, thickness } = resolveDimensions(opts);
  const useDefaultMDF = opts.material == null;
  const baseMaterial: THREE.Material = opts.material ?? getFallbackPBRMaterial();

  const root = new THREE.Group();
  root.name = "box-model";

  const specs = getPanelSpecs(width, height, depth, thickness);
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

  root.position.set(0, 0, 0);

  return {
    root,
    panels,
    dimensions: { width, height, depth, thickness },
  };
};

export const updateBoxModel = (model: BoxModel, options: BoxOptions = {}): BoxModel => {
  const opts = options ?? {};
  const { width, height, depth, thickness } = resolveDimensions(opts);
  const material = opts.material ?? model.panels.left.material;
  const specs = getPanelSpecs(width, height, depth, thickness);
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

  model.dimensions = { width, height, depth, thickness };
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
 * Atualiza um grupo criado por buildBoxLegacy: geometria e posição de cada painel por nome.
 * Use no Viewer quando entry.mesh for um Group (módulo de armário com painéis).
 */
export function updateBoxGroup(group: THREE.Group, options?: BoxOptions | null): { width: number; height: number; depth: number } {
  const opts = options ?? {};
  const { width, height, depth, thickness } = resolveDimensions(opts);
  const specs = getPanelSpecs(width, height, depth, thickness);

  group.children.forEach((child) => {
    if (!(child instanceof THREE.Mesh) || !child.geometry) return;
    const name = child.name as (typeof PANEL_NAMES)[number];
    if (!PANEL_NAMES.includes(name)) return;
    const spec = specs[name];
    if (!spec) return;
    updatePanelGeometry(child, spec.size[0], spec.size[1], spec.size[2]);
    child.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
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
