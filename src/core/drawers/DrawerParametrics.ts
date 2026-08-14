/**
 * DrawerParametrics
 *
 * Geometria de gavetas internas no módulo:
 * - Frente externa (overlay) mais alta que laterais/costa (delta = rasgo fundo + folga).
 * - Profundidade do corpo = comprimento da corrediça (350–600 mm).
 * - Folgas verticais entre frentes geridas em DrawerGroup / drawerVerticalPosition.
 */
import {
  settingsDefaults,
  type DrawerHandlePosition,
  type DrawerHandleType,
  type DrawerMetalBoxType,
  type DrawerSlideType,
  type SettingsSchema,
} from "../settings/settingsSchema";
import { devLogger } from "../../utils/devLogger";
import {
  isMetalBoxCatalogType,
  pickCompatibleMetalDepth,
  resolveMetalBoxHeightMm,
  resolveMetalBoxProfile,
} from "./drawerMetalBoxCatalog";
import {
  resolveDrawerBodyCenterOffsetYMm,
  resolveDrawerBodyCenterZMm,
} from "./drawerViewerLayout";
import {
  DRAWER_BOTTOM_FRONT_ENTRY_MM,
  DRAWER_BOTTOM_SIDE_ENTRY_MM,
  DRAWER_COSTA_HEIGHT_BELOW_LATERAL_MM,
} from "./drawerGeometryConstants";
import {
  resolveDrawerBodyDeltaForStackRoleMm,
  resolveDrawerBodyElevationForStackRoleMm,
} from "./drawerStackPosition";
import {
  DRAWER_SLIDE_LENGTHS_MM,
  isDrawerSlideLengthMm,
  resolveDrawerSideDepthMm,
  resolveDrawerSlideLength,
  resolveDrawerUsableDepthMm,
} from "./drawerSlideDepth";

export interface DrawerDimensions {
  // Box de referência (dimensões internas)
  boxInternalWidth: number;
  /** Largura externa do módulo (overlay da frente, alinhada à porta). */
  boxExternalWidth: number;
  boxInternalHeight: number;
  /** Profundidade útil interna (P externa − espessura frente − folgas). */
  boxInternalDepth: number;
  boxThickness: number;

  // Altura desta gaveta específica (proporcional ao número de gavetas)
  drawerHeight: number;

  // Número total de gavetas no box (para cálculos proporcionais)
  totalDrawers: number;

  /** Papel no stack — altura das laterais SW (lowest vs mid/top). */
  stackRole?: import("./drawerStackPosition").DrawerStackRole;

  // Tipo de gaveta
  type: "normal" | "pro";
}

export interface DrawerPieceSpec {
  width: number;
  height: number;
  depth: number;
}

export interface DrawerCalculatedSpecs {
  /** Frente interna estrutural (ligação ao corpo / caixa metálica). */
  frontInt: DrawerPieceSpec & { thickness: number };
  /** Frente externa decorativa (overlay + puxador). */
  frontExt: DrawerPieceSpec & { thickness: number };
  /** @deprecated Alias de frontExt — compatibilidade com layers legadas. */
  front: DrawerPieceSpec & { thickness: number };
  
  // Corpo (menor - espaço para corrediças)
  body: {
    width: number;
    height: number;
    depth: number;
  };
  
  // Laterais
  leftSide: DrawerPieceSpec;
  rightSide: DrawerPieceSpec;
  
  // Fundo
  bottom: DrawerPieceSpec & { thickness: number };
  
  // Traseira
  back: DrawerPieceSpec & { thickness: number };
  
  /** Deslocamento vertical do centro do corpo (laterais/costa) para alinhar fundo ao rasgo. */
  bodyCenterOffsetY: number;
  /** Elevação da base do corpo vs base da frente (mm). Gaveta inferior = 18. */
  sideBaseElevationMm: number;
  
  // Posicionamento
  positioning: {
    frontOffsetZ: number;      // +19mm à frente
    bodyOffsetZ: number;       // Centro do fundo (comprimento = corrediça)
    sideOffsetZ: number;       // Centro das laterais (comprimento = corrediça − 10 mm)
    pullDistance: number;      // Distância máxima de abertura
  };

  slide: {
    type: DrawerSlideType;
    softClose: boolean;
    capacityKg: 30 | 40 | 50 | 70;
    cursoTotalMm: number;
  };

  metalBox: {
    type: DrawerMetalBoxType;
    enabled: boolean;
    height: number;
    compatibleDepths: number[];
    profileId?: string;
  };

  handle: {
    type: DrawerHandleType;
    position: DrawerHandlePosition;
    offsetMm: number;
  };

  validation: {
    warnings: string[];
  };

  /** Profundidade nominal (corrediça) e recuo aplicado (FASE 6). */
  nominalDepthMm: number;
  runnerClearanceMm: number;
  
  // Gaps/folgas
  gaps: {
    frontGap: number;          // 1mm cada lado
    sideGap: number;           // 7mm cada lado (corrediças)
    bottomSlots: {
      front: number;           // 5mm - fundo entra na frente
      sides: number;           // 5mm - fundo entra nas laterais
      back: number;            // 5mm - fundo entra na traseira
    };
  };
}

export type DrawerParametricSettings = SettingsSchema["gavetas"];

/** Overrides por gaveta vindos da UI (drawersLayer.metadata + campos espelhados). */
export type DrawerParametricOverrides = {
  nominalDepthMm?: number;
  slideType?: DrawerSlideType;
  metalBoxType?: DrawerMetalBoxType;
  softClose?: boolean;
  drawerType?: "normal" | "pro";
  /** Altura só da frente (mm); corpo mantém drawerHeight. */
  frontHeightMm?: number;
  metalBoxProfileId?: string;
  metalBoxHeightMm?: number;
  /** Elevação do corpo vs base da frente (mm). Default 17; gaveta inferior = 18. */
  sideBaseElevationMm?: number;
};

const MIN_BODY_DEPTH_MM = DRAWER_SLIDE_LENGTHS_MM[0];
const MIN_MM = 1;
const SOFT_CLOSE_COMPATIBLE_SLIDES = new Set<DrawerSlideType>([
  "Blum Tandem",
  "Blum Movento",
  "Hettich InnoTech",
  "Hettich ArciTech",
  "Hafele Matrix",
]);

function clampMm(value: number, min = MIN_MM): number {
  return Math.max(min, Number.isFinite(value) ? value : min);
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function normalizeDepths(depths: unknown, fallback: number[]): number[] {
  const parsed = Array.isArray(depths)
    ? depths
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item) && item > 0)
        .sort((a, b) => a - b)
    : [];
  return parsed.length > 0 ? parsed : fallback;
}

function resolveDrawerSettings(
  settings?: Partial<DrawerParametricSettings>,
  availableDepths?: number[]
): DrawerParametricSettings {
  const defaults = settingsDefaults.gavetas;
  return {
    ...defaults,
    ...settings,
    gavetaFolgaFrenteMm: normalizePositiveNumber(settings?.gavetaFolgaFrenteMm, defaults.gavetaFolgaFrenteMm),
    gavetaFolgaLateralMm: normalizePositiveNumber(settings?.gavetaFolgaLateralMm, defaults.gavetaFolgaLateralMm),
    gavetaEspessuraFrenteMm: normalizePositiveNumber(settings?.gavetaEspessuraFrenteMm, defaults.gavetaEspessuraFrenteMm),
    gavetaEspessuraLateralMm: normalizePositiveNumber(settings?.gavetaEspessuraLateralMm, defaults.gavetaEspessuraLateralMm),
    gavetaEspessuraTraseiraMm: normalizePositiveNumber(settings?.gavetaEspessuraTraseiraMm, defaults.gavetaEspessuraTraseiraMm),
    gavetaEspessuraFundoMm: normalizePositiveNumber(settings?.gavetaEspessuraFundoMm, defaults.gavetaEspessuraFundoMm),
    gavetaRecuoCorpoMm: normalizePositiveNumber(settings?.gavetaRecuoCorpoMm, defaults.gavetaRecuoCorpoMm),
    gavetaReducaoPercentual: Math.round(
      normalizePositiveNumber(settings?.gavetaReducaoPercentual, defaults.gavetaReducaoPercentual)
    ),
    gavetaRecuoProfundidadeCorredicaMm: normalizePositiveNumber(
      settings?.gavetaRecuoProfundidadeCorredicaMm,
      defaults.gavetaRecuoProfundidadeCorredicaMm
    ),
    gavetaProfundidadesDisponiveisMm: normalizeDepths(
      settings?.gavetaProfundidadesDisponiveisMm ?? availableDepths,
      defaults.gavetaProfundidadesDisponiveisMm
    ),
    gavetaAlturaModoPadrao: settings?.gavetaAlturaModoPadrao ?? defaults.gavetaAlturaModoPadrao,
  };
}

function applyDrawerParametricOverrides(
  settings: DrawerParametricSettings,
  overrides?: DrawerParametricOverrides
): DrawerParametricSettings {
  if (!overrides) return settings;

  const next = { ...settings };
  if (overrides.slideType) next.gavetaTipoCorredica = overrides.slideType;
  if (overrides.metalBoxType) next.gavetaTipoCaixaMetalica = overrides.metalBoxType;
  if (typeof overrides.softClose === "boolean") next.gavetaSoftClose = overrides.softClose;
  if (overrides.metalBoxHeightMm != null && Number.isFinite(overrides.metalBoxHeightMm)) {
    next.gavetaAlturaCaixaMetalicaMm = overrides.metalBoxHeightMm;
  }
  if (overrides.metalBoxProfileId && overrides.metalBoxType && isMetalBoxCatalogType(overrides.metalBoxType)) {
    const profile = resolveMetalBoxProfile(overrides.metalBoxType, overrides.metalBoxProfileId);
    if (profile) {
      next.gavetaTipoCorredica = profile.defaultSlideType;
      next.gavetaProfundidadesCompativeisMm = profile.compatibleDepthsMm;
    }
  }
  return next;
}

function resolveSlideCourse(settings: DrawerParametricSettings, bodyDepth: number): number {
  const override = Number(settings.gavetaCursoTotalMm);
  if (Number.isFinite(override) && override > 0) return Math.min(override, bodyDepth);
  if (settings.gavetaTipoCorredica === "Blum Tandem" || settings.gavetaTipoCorredica === "Blum Movento") {
    return bodyDepth;
  }
  return bodyDepth;
}

/**
 * Profundidade útil para seleção de corrediça (P externa − espessura frente − folgas).
 */
export function resolveDrawerBoxUsableDepthMm(
  boxDepthExternalMm: number,
  boxThicknessMm: number,
  options?: { clearanceMm?: number }
): number {
  const clearance =
    options?.clearanceMm ?? settingsDefaults.gavetas.gavetaRecuoProfundidadeCorredicaMm;
  return resolveDrawerUsableDepthMm(boxDepthExternalMm, boxThicknessMm, clearance);
}

/**
 * Calcula todas as dimensões de uma gaveta
 * baseado em regras reais de marcenaria
 */
export function calculateDrawerSpecs(
  dimensions: DrawerDimensions,
  availableDepths: number[],
  drawerSettings?: Partial<DrawerParametricSettings>,
  overrides?: DrawerParametricOverrides
): DrawerCalculatedSpecs {
  const {
    boxInternalWidth,
    boxExternalWidth,
    boxInternalDepth,
    drawerHeight,
    type,
  } = dimensions;
  const baseSettings = resolveDrawerSettings(drawerSettings, availableDepths);
  const settings = applyDrawerParametricOverrides(baseSettings, overrides);
  const drawerType = overrides?.drawerType ?? type;
  const frontGap = settings.gavetaFolgaFrenteMm;
  const sideGap = settings.gavetaFolgaLateralMm;
  const bodyThickness =
    Number.isFinite(dimensions.boxThickness) && dimensions.boxThickness > 0
      ? dimensions.boxThickness
      : settings.gavetaEspessuraFrenteMm;
  const frontThickness = bodyThickness;
  const sideThickness = settings.gavetaEspessuraLateralMm;
  const bottomThickness = settings.gavetaEspessuraFundoMm;
  const backThickness = settings.gavetaEspessuraTraseiraMm;
  const runnerClearanceMm = settings.gavetaRecuoProfundidadeCorredicaMm;
  const metalBoxEnabled = settings.gavetaTipoCaixaMetalica !== "Nenhuma" || drawerType === "pro";
  const metalBoxType = metalBoxEnabled
    ? settings.gavetaTipoCaixaMetalica !== "Nenhuma"
      ? settings.gavetaTipoCaixaMetalica
      : "Genérica"
    : "Nenhuma";
  const metalProfile = metalBoxEnabled
    ? resolveMetalBoxProfile(
        metalBoxType,
        overrides?.metalBoxProfileId,
        overrides?.metalBoxHeightMm ?? settings.gavetaAlturaCaixaMetalicaMm
      )
    : null;
  const resolvedMetalHeight =
    metalProfile != null
      ? resolveMetalBoxHeightMm(
          metalProfile,
          overrides?.metalBoxHeightMm ?? settings.gavetaAlturaCaixaMetalicaMm
        )
      : 0;
  const depthRules =
    metalProfile != null
      ? metalProfile.compatibleDepthsMm.filter((d) =>
          (DRAWER_SLIDE_LENGTHS_MM as readonly number[]).includes(d)
        )
      : settings.gavetaValidarProfundidadeCompativel
        ? settings.gavetaProfundidadesCompativeisMm
        : DRAWER_SLIDE_LENGTHS_MM;
  const resolvedSlideLength = (() => {
    if (
      overrides?.nominalDepthMm != null &&
      Number.isFinite(overrides.nominalDepthMm) &&
      overrides.nominalDepthMm > 0
    ) {
      const capped = Math.min(overrides.nominalDepthMm, boxInternalDepth);
      return isDrawerSlideLengthMm(capped) ? capped : resolveDrawerSlideLength(capped);
    }
    const fromUsable = resolveDrawerSlideLength(boxInternalDepth);
    return metalProfile
      ? pickCompatibleMetalDepth(metalProfile, fromUsable)
      : fromUsable;
  })();
  const nominalDepth = resolvedSlideLength;
  const warnings: string[] = [];

  // ===== FRENTE =====
  // Frente overlay externa: largura do módulo com folga industrial (como porta), 1 mm por lado.
  const externalWidth =
    Number.isFinite(boxExternalWidth) && boxExternalWidth > 0
      ? boxExternalWidth
      : boxInternalWidth + 2 * dimensions.boxThickness;
  const frontWidth = clampMm(externalWidth - 2 * frontGap);
  const frontHeightOverride =
    overrides?.frontHeightMm != null &&
    Number.isFinite(overrides.frontHeightMm) &&
    overrides.frontHeightMm > 0
      ? overrides.frontHeightMm
      : undefined;
  const frontHeight = clampMm(frontHeightOverride ?? drawerHeight);

  // ===== CORPO (gavita 8) =====
  // lateral = frente − delta(role); costa = lateral − 23; elevação = 48.
  // Stack B0/gap e folga frente ficam para Diff 3/4.
  const stackRole = dimensions.stackRole ?? "middle";
  const woodBodyHeight = clampMm(
    Math.max(1, frontHeight - resolveDrawerBodyDeltaForStackRoleMm(stackRole))
  );
  const bodyHeight =
    metalBoxEnabled && resolvedMetalHeight > 0 ? resolvedMetalHeight : woodBodyHeight;
  const sideElev =
    overrides?.sideBaseElevationMm != null && Number.isFinite(overrides.sideBaseElevationMm)
      ? overrides.sideBaseElevationMm
      : resolveDrawerBodyElevationForStackRoleMm(stackRole, dimensions.boxThickness);
  const bodyCenterOffsetY = resolveDrawerBodyCenterOffsetYMm(
    frontHeight,
    woodBodyHeight,
    sideElev
  );
  const bodyWidth = clampMm(boxInternalWidth - 2 * sideGap);
  const bodyDepth = clampMm(nominalDepth);

  const needsStructuralFrontInt = metalBoxEnabled;
  const internalFrontWidth = needsStructuralFrontInt ? bodyWidth : 0;
  // Frente interna segue a altura madeira das laterais, não a altura metal.
  const internalFrontHeight = needsStructuralFrontInt ? woodBodyHeight : 0;
  const internalFrontThickness = needsStructuralFrontInt ? sideThickness : 0;
  const externalFrontWidth = frontWidth;
  const externalFrontHeight = frontHeight;
  const externalFrontThickness = frontThickness;
  const combinedFrontThickness =
    externalFrontThickness + (needsStructuralFrontInt ? internalFrontThickness : 0);

  // ===== LATERAIS =====
  const woodSideDepth = metalBoxEnabled ? 0 : resolveDrawerSideDepthMm(bodyDepth);
  const leftSideWidth = metalBoxEnabled ? 0 : sideThickness;
  const leftSideHeight = metalBoxEnabled ? 0 : bodyHeight;
  const leftSideDepth = woodSideDepth;

  const rightSideWidth = metalBoxEnabled ? 0 : sideThickness;
  const rightSideHeight = metalBoxEnabled ? 0 : bodyHeight;
  const rightSideDepth = woodSideDepth;

  // ===== TRASEIRA =====
  // Largura = vão entre laterais; altura = laterais − 23 (SSOT industrial).
  const backWidth = clampMm(bodyWidth - 2 * sideThickness);
  const backHeight = clampMm(
    Math.max(1, woodBodyHeight - DRAWER_COSTA_HEIGHT_BELOW_LATERAL_MM)
  );

  // ===== FUNDO =====
  // Vão entre laterais × comprimento das laterais + entradas industriais:
  // largura  = vão + 10 + 10 (cada lateral)
  // profundidade = sideDepth + 10 (frente) + espessura_costa
  // sideDepth = bodyDepth − 10 (mesmo critério das laterais)
  const effectiveBottomThickness = metalBoxEnabled ? sideThickness : bottomThickness;
  const internalWidth = backWidth;
  const sideDepthForBottom = resolveDrawerSideDepthMm(bodyDepth);
  const bottomWidth = clampMm(
    internalWidth + DRAWER_BOTTOM_SIDE_ENTRY_MM + DRAWER_BOTTOM_SIDE_ENTRY_MM
  );
  const bottomDepth = clampMm(
    sideDepthForBottom + DRAWER_BOTTOM_FRONT_ENTRY_MM + backThickness
  );

  // ===== POSICIONAMENTO =====
  // Frente flush na face frontal do módulo; corpo recuado para trás da frente.
  const frontOffsetZ = 0;
  const bodyOffsetZ = resolveDrawerBodyCenterZMm(combinedFrontThickness, bodyDepth);
  const sideOffsetZ =
    woodSideDepth > 0
      ? resolveDrawerBodyCenterZMm(combinedFrontThickness, woodSideDepth)
      : bodyOffsetZ;
  const pullDistance = resolveSlideCourse(settings, bodyDepth);

  if (frontHeight < settings.gavetaAlturaMinimaMm) {
    warnings.push(`Altura da frente abaixo do minimo (${settings.gavetaAlturaMinimaMm}mm).`);
  }
  if (frontHeight > settings.gavetaAlturaMaximaMm) {
    warnings.push(`Altura da frente acima do maximo (${settings.gavetaAlturaMaximaMm}mm).`);
  }
  if (settings.gavetaValidarSoftCloseCompativel && settings.gavetaSoftClose && !SOFT_CLOSE_COMPATIBLE_SLIDES.has(settings.gavetaTipoCorredica)) {
    warnings.push(`Soft-close nao validado para ${settings.gavetaTipoCorredica}.`);
  }
  if (metalBoxEnabled && resolvedMetalHeight > 0 && frontHeight < resolvedMetalHeight) {
    warnings.push(`Frente abaixo da altura da caixa metalica (${resolvedMetalHeight}mm).`);
  }
  if (
    overrides?.nominalDepthMm != null &&
    overrides.nominalDepthMm > boxInternalDepth
  ) {
    warnings.push(
      `Profundidade nominal ${overrides.nominalDepthMm}mm excede profundidade interna (${boxInternalDepth}mm).`
    );
  }
  if (bodyDepth < MIN_BODY_DEPTH_MM) {
    warnings.push(
      `Profundidade do corpo (${bodyDepth}mm) abaixo do minimo industrial (${MIN_BODY_DEPTH_MM}mm).`
    );
  }
  if (
    settings.gavetaValidarProfundidadeCompativel &&
    !(depthRules as readonly number[]).includes(nominalDepth)
  ) {
    warnings.push(`Profundidade nominal ${nominalDepth}mm incompativel com caixa metalica/corredica.`);
  }

  return {
    frontInt: {
      width: internalFrontWidth,
      height: internalFrontHeight,
      depth: internalFrontThickness,
      thickness: internalFrontThickness,
    },
    frontExt: {
      width: externalFrontWidth,
      height: externalFrontHeight,
      depth: externalFrontThickness,
      thickness: externalFrontThickness,
    },
    front: {
      width: externalFrontWidth,
      height: externalFrontHeight,
      depth: externalFrontThickness,
      thickness: externalFrontThickness,
    },
    body: {
      width: bodyWidth,
      height: bodyHeight,
      depth: bodyDepth,
    },
    bodyCenterOffsetY,
    sideBaseElevationMm: sideElev,
    leftSide: {
      width: leftSideWidth,
      height: leftSideHeight,
      depth: leftSideDepth,
    },
    rightSide: {
      width: rightSideWidth,
      height: rightSideHeight,
      depth: rightSideDepth,
    },
    bottom: {
      width: bottomWidth,
      height: bottomDepth,
      depth: effectiveBottomThickness,
      thickness: effectiveBottomThickness,
    },
    back: {
      width: backWidth,
      height: backHeight,
      depth: backThickness,
      thickness: backThickness,
    },
    positioning: {
      frontOffsetZ,
      bodyOffsetZ,
      sideOffsetZ,
      pullDistance,
    },
    slide: {
      type: settings.gavetaTipoCorredica,
      softClose: settings.gavetaSoftClose,
      capacityKg: settings.gavetaCapacidadeCargaKg,
      cursoTotalMm: pullDistance,
    },
    metalBox: {
      type: metalBoxType,
      enabled: metalBoxEnabled,
      height: resolvedMetalHeight,
      compatibleDepths: metalProfile?.compatibleDepthsMm ?? settings.gavetaProfundidadesCompativeisMm,
      profileId: metalProfile?.id,
    },
    handle: {
      type: settings.gavetaTipoHandle,
      position: settings.gavetaPosicaoHandle,
      offsetMm: settings.gavetaOffsetHandleMm,
    },
    validation: {
      warnings,
    },
    nominalDepthMm: nominalDepth,
    runnerClearanceMm: runnerClearanceMm,
    gaps: {
      frontGap,
      sideGap,
      bottomSlots: {
        front: DRAWER_BOTTOM_FRONT_ENTRY_MM,
        sides: DRAWER_BOTTOM_SIDE_ENTRY_MM,
        back: backThickness,
      },
    },
  };
}

/**
 * Valida se as dimensões calculadas são válidas
 */
export function validateDrawerSpecs(specs: DrawerCalculatedSpecs): boolean {
  if (specs.frontExt.width <= specs.body.width) {
    devLogger.warn("DrawerParametrics: frente externa deve ser mais larga que o corpo (overlay lateral)");
    return false;
  }

  if (specs.frontExt.height <= specs.body.height + 0.01) {
    devLogger.warn("DrawerParametrics: frente externa deve ser mais alta que o corpo (laterais/costa)");
    return false;
  }

  if (specs.metalBox.enabled && (specs.frontInt.height <= 0 || specs.frontInt.width <= 0)) {
    devLogger.warn("DrawerParametrics: frente interna invalida para caixa metalica");
    return false;
  }

  if (specs.body.depth <= 0 || specs.positioning.pullDistance > specs.body.depth) {
    devLogger.warn("DrawerParametrics: curso de abertura invalido");
    return false;
  }

  if (!specs.metalBox.enabled && specs.leftSide.width <= 0) {
    devLogger.warn("DrawerParametrics: laterais invalidas para gaveta de madeira");
    return false;
  }

  if (specs.bottom.thickness <= 0 || specs.back.thickness <= 0 || specs.bottom.width <= 0) {
    devLogger.warn("DrawerParametrics: fundo ou costa invalidos");
    return false;
  }

  return true;
}

/**
 * Calcula bounding box total da gaveta (fechada)
 */
export function getDrawerBoundingBox(specs: DrawerCalculatedSpecs): {
  width: number;
  height: number;
  depth: number;
} {
  return {
    width: specs.frontExt.width,
    height: specs.frontExt.height,
    depth: specs.frontExt.thickness + (specs.metalBox.enabled ? specs.frontInt.thickness : 0) + specs.body.depth,
  };
}
