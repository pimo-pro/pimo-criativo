import { SYSTEM_THICKNESS_MM } from "../baseCabinets";

export type WardrobeGroup = "H" | "J" | "T";

export function getWardrobeGroupFromBaseCabinetId(baseCabinetId?: string | null): WardrobeGroup | null {
  if (!baseCabinetId) return null;
  if (baseCabinetId.includes("roupeiro-h-2400")) return "H";
  if (baseCabinetId.includes("roupeiro-j-2000")) return "J";
  if (baseCabinetId.includes("roupeiro-t-600")) return "T";
  return null;
}

export function getWardrobeCfgNumber(baseCabinetId?: string | null): number | null {
  const m = typeof baseCabinetId === "string" ? baseCabinetId.match(/cfg(\d+)/) : null;
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function isWardrobeModel(baseCabinetId?: string | null): boolean {
  return getWardrobeGroupFromBaseCabinetId(baseCabinetId) != null;
}

export function isWardrobeVerticalDividerEnabled(widthMm: number): boolean {
  return Number.isFinite(widthMm) && widthMm >= 800;
}

export function getWardrobeDoorCountForWidth(widthMm: number): number {
  if (!Number.isFinite(widthMm)) return 1;
  if (widthMm >= 1800) return 3; // obrigatório
  if (widthMm >= 1400) return 3; // regra de 3 folhas para larguras grandes
  if (widthMm >= 1200) return 2;
  if (widthMm >= 800) return 2;
  if (widthMm >= 700) return 2;
  return 1;
}

export function getWardrobeVerticalDividerFromLeftMm(widthMm: number, doorCount: number): number | null {
  if (!isWardrobeVerticalDividerEnabled(widthMm)) return null;
  if (doorCount === 3) {
    // Alinhar divisor com lado de dobradiça da porta 1:
    // - 1800 => 600mm da esquerda
    // - 1400 => ~466.67mm da esquerda
    return widthMm / 3;
  }
  return widthMm / 2;
}

export function getWardrobeHorizontalDividerFromFloorMm(group: Exclude<WardrobeGroup, "T">): number {
  return group === "H" ? 1900 : 1600;
}

export function hasWardrobeLowerDrawers(baseCabinetId?: string | null): boolean {
  const cfg = getWardrobeCfgNumber(baseCabinetId);
  return cfg === 7 || cfg === 8;
}

export type WardrobeDrawerSide = "left" | "right";

/** Fase C — gavetas internas num lado + SEP parcial até DIV. */
export function hasWardrobeSideDrawerBox(baseCabinetId?: string | null): boolean {
  if (!baseCabinetId) return false;
  return (
    baseCabinetId.includes("wardrobe_sep_parcial_gavetas") ||
    baseCabinetId.includes("sep_parcial_gavetas")
  );
}

export function getWardrobeSideDrawerSide(
  baseCabinetId?: string | null
): WardrobeDrawerSide {
  const id = baseCabinetId ?? "";
  if (
    id.includes("_esq") ||
    id.includes("-esq") ||
    id.includes("_left") ||
    id.includes("-left")
  ) {
    return "left";
  }
  return "right";
}

export type WardrobeWardrobeLocalLayout = {
  group: WardrobeGroup;
  verticalDividerEnabled: boolean;
  /** Centro X do divisor vertical no sistema local do box. */
  verticalDividerCenterX_mm: number | null;
  /** Distância do divisor vertical em mm a partir da aresta esquerda externa. */
  verticalDividerFromLeftMm: number | null;
  horizontalDividerEnabled: boolean;
  /** Centro do divisor horizontal em coordenadas locais (y=0 = centro da caixa). */
  horizontalDividerCenterY_mm: number | null;
  /** Centro da prateleira (ou prateleiras por lado). */
  upperShelfCenterY_mm: number | null;
  /** Centro do varão de cabides no(s) compartimento(s) inferiores. */
  lowerCabideCenterY_mm: number | null;
  /** Z das prateleiras/varões (centro do volume visual). */
  shelfAndRailCenterZ_mm: number;
  /** Centro X dos compartimentos para montagem por lado. */
  leftCompartmentCenterX_mm: number;
  rightCompartmentCenterX_mm: number;
  /** Largura (X) das prateleiras/varões por compartimento e sem divisor. */
  shelfWidthFull_mm: number;
  shelfWidthPerSide_mm: number;
  railWidthFull_mm: number;
  railWidthPerSide_mm: number;
  /** Largura “boxWidth” a passar ao DrawerGenerationService para o compartimento da direita. */
  drawerCompartmentBoxWidthForGen_mm: number | null;
  /** Altura “boxHeight” a passar ao DrawerGenerationService para o compartimento inferior. */
  drawerCompartmentBoxHeightForGen_mm: number | null;
  /** Origin local do conjunto de gavetas no eixo X (para posição dos layer items). */
  drawerOriginXLocal_mm: number | null;
  /** Origin local do conjunto de gavetas no eixo Y (para posição dos layer items). */
  drawerOriginYLocal_mm: number | null;
};

const SHELF_WIDTH_CLEARANCE_MM = 2; // 1 mm + 1 mm (folgas laterais da prateleira)
const SHELF_DEPTH_CLEARANCE_MM = 5; // folga frontal (paridade com BoxBuilder / industrial)
const SHELF_VISUAL_INSET_MM = 1; // inset visual
const RAIL_THICKNESS_MM = 6; // dimensão visual (não usado para cutlist)

export function computeWardrobeLocalLayout(params: {
  baseCabinetId?: string | null;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  feetHeightMm: number;
}): WardrobeWardrobeLocalLayout {
  const { baseCabinetId, widthMm, heightMm, depthMm, feetHeightMm } = params;
  const group = getWardrobeGroupFromBaseCabinetId(baseCabinetId);
  if (!group) {
    throw new Error("computeWardrobeLocalLayout called with non-wardrobe baseCabinetId");
  }

  const thicknessMm = SYSTEM_THICKNESS_MM;
  const verticalDividerEnabled = group !== "T" && isWardrobeVerticalDividerEnabled(widthMm);
  const doorCountForWidth = getWardrobeDoorCountForWidth(widthMm);
  const verticalDividerFromLeftMm =
    group === "T" ? null : getWardrobeVerticalDividerFromLeftMm(widthMm, doorCountForWidth);
  const verticalDividerCenterX_mm =
    verticalDividerFromLeftMm == null ? null : -widthMm / 2 + verticalDividerFromLeftMm;
  const horizontalDividerEnabled = group === "H" || group === "J";

  const shelfAndRailCenterZ_mm = (() => {
    const shelfDepthMm = Math.max(1, depthMm - SHELF_DEPTH_CLEARANCE_MM);
    return -depthMm / 2 + shelfDepthMm / 2 + SHELF_VISUAL_INSET_MM;
  })();

  // Centros de compartimento no sistema local:
  // - divider em x=0 com espessura thicknessMm
  // - outer panels no limite (±width/2). Aproximação por geometria local.
  const leftCompartmentCenterX_mm = -widthMm / 4 + thicknessMm / 4;
  const rightCompartmentCenterX_mm = widthMm / 4 - thicknessMm / 4;

  const shelfWidthFull_mm = Math.max(1, widthMm - 2 * thicknessMm - SHELF_WIDTH_CLEARANCE_MM);
  const compartmentInternalWidth_mm = (widthMm - 3 * thicknessMm) / 2;
  const shelfWidthPerSide_mm = Math.max(1, compartmentInternalWidth_mm - SHELF_WIDTH_CLEARANCE_MM);

  // Varão/rail usa a mesma largura efetiva da prateleira para encaixe visual.
  const railWidthFull_mm = shelfWidthFull_mm;
  const railWidthPerSide_mm = shelfWidthPerSide_mm;

  if (group === "T") {
    // Unidade superior: prateleira no centro (y=0), sem div. internos.
    return {
      group,
      verticalDividerEnabled: false,
      verticalDividerCenterX_mm: null,
      verticalDividerFromLeftMm: null,
      horizontalDividerEnabled: false,
      horizontalDividerCenterY_mm: null,
      upperShelfCenterY_mm: 0,
      lowerCabideCenterY_mm: null,
      shelfAndRailCenterZ_mm,
      leftCompartmentCenterX_mm,
      rightCompartmentCenterX_mm,
      shelfWidthFull_mm,
      shelfWidthPerSide_mm,
      railWidthFull_mm,
      railWidthPerSide_mm,
      drawerCompartmentBoxWidthForGen_mm: null,
      drawerCompartmentBoxHeightForGen_mm: null,
      drawerOriginXLocal_mm: null,
      drawerOriginYLocal_mm: null,
    };
  }

  // H/J: divisor horizontal a partir do piso (não depende do modelo cfg).
  const dividerFromFloorMm = getWardrobeHorizontalDividerFromFloorMm(group);
  const lowerSectionHeightMm = dividerFromFloorMm - Math.max(0, feetHeightMm);
  // Evitar inversões geométricas.
  const safeLowerSectionHeightMm = Math.max(300, Math.min(heightMm - 300, lowerSectionHeightMm));

  // local y:
  // - bottom face local = -heightMm/2
  // - divider center local = bottom + lowerSectionHeight
  const horizontalDividerCenterY_mm = -heightMm / 2 + safeLowerSectionHeightMm;

  const upperInteriorLowerBound_mm = horizontalDividerCenterY_mm + thicknessMm / 2;
  const upperInteriorUpperBound_mm = heightMm / 2 - thicknessMm;
  const upperInteriorHeight_mm = Math.max(1, upperInteriorUpperBound_mm - upperInteriorLowerBound_mm);

  // 1 prateleira por compartimento => centro no “meio” da zona superior útil.
  const upperShelfCenterY_mm = upperInteriorLowerBound_mm + upperInteriorHeight_mm / 2;

  const lowerInteriorBottomBound_mm = -heightMm / 2 + thicknessMm;
  const lowerInteriorTopBound_mm = horizontalDividerCenterY_mm - thicknessMm / 2;
  const lowerInteriorHeight_mm = Math.max(1, lowerInteriorTopBound_mm - lowerInteriorBottomBound_mm);
  const lowerCabideCenterY_mm = lowerInteriorBottomBound_mm + lowerInteriorHeight_mm / 2;

  // Compartimento inferior para geração das gavetas (cfg7/8 = direita; Fase C = lado escolhido).
  const drawerCompartmentBoxHeightForGen_mm = safeLowerSectionHeightMm;
  const drawerCompartmentBoxWidthForGen_mm = (widthMm + thicknessMm) / 2;
  const sideDrawer = hasWardrobeSideDrawerBox(baseCabinetId);
  const drawerSide = getWardrobeSideDrawerSide(baseCabinetId);
  const drawerOriginXLocal_mm = sideDrawer
    ? drawerSide === "left"
      ? leftCompartmentCenterX_mm
      : rightCompartmentCenterX_mm
    : rightCompartmentCenterX_mm;
  const drawerOriginYLocal_mm = -heightMm / 2 + safeLowerSectionHeightMm / 2;

  return {
    group,
    verticalDividerEnabled,
    verticalDividerCenterX_mm,
    verticalDividerFromLeftMm,
    horizontalDividerEnabled,
    horizontalDividerCenterY_mm,
    upperShelfCenterY_mm,
    lowerCabideCenterY_mm,
    shelfAndRailCenterZ_mm,
    leftCompartmentCenterX_mm,
    rightCompartmentCenterX_mm,
    shelfWidthFull_mm,
    shelfWidthPerSide_mm,
    railWidthFull_mm,
    railWidthPerSide_mm,
    drawerCompartmentBoxWidthForGen_mm,
    drawerCompartmentBoxHeightForGen_mm,
    drawerOriginXLocal_mm,
    drawerOriginYLocal_mm,
  };
}

// Exposição apenas para pads visuais (evita “magic number” espalhado).
export function getWardrobeRailThicknessMm(): number {
  return RAIL_THICKNESS_MM;
}

