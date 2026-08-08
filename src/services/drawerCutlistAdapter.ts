/**
 * Conversão: DrawerLayerItem[] → CutListItem[]
 *
 * Extrai todas as subpeças das gavetas (frente, laterais, fundo, traseira) para a cutlist.
 * Taxonomia unificada (docs/matriz-faces-A-B-FINAL.md): gaveta_frente, gaveta_lat_esq,
 * gaveta_lat_dir, gaveta_fundo, gaveta_traseira.
 */

import {
  resolveMetalBoxProfile,
} from "../core/drawers/drawerMetalBoxCatalog";
import type { CutListItem } from "../core/types";
import {
  resolveDrawerExternalFrontHeightMm,
  resolveDrawerInternalFrontHeightMm,
  resolveDrawerPieceIndustrialLabel,
} from "../core/drawers/drawerLayerCustomization";
import { resolveDrawerStackRole } from "../core/drawers/drawerStackPosition";
import { resolveIndustrialGrainCode } from "../core/materials/grainDirection";
import { buildCutlistRotationMetadata } from "../core/manufacturing/cutlistRotationMetadata";
import type { DrawerLayerItem } from "../models/BoxLayers";
import { resolveActiveDrawersLayer } from "../core/drawers/drawerModeloAGate";
import {
  resolveIndustrialBoxId,
  assertIndustrialMaterial,
} from "../core/industrial/industrialValidation";
import { IndustrialError, buildIndustrialPieceId } from "../core/industrial/IndustrialError";
import {
  DRAWER_SIDE_THICKNESS_MM,
  resolveDrawerBottomMaterial,
  resolveDrawerSideMaterial,
  resolveMaterial,
} from "../core/materials/materials.api";
import { resolveIndustrialMaterialKey } from "../core/materials/service";
import {
  A1_DRAWER_TIPO_TO_TOKEN,
  buildA1DrawerIndustrialLabel,
} from "../core/innerCabinet/a1Naming";

/** Convenção industrial unificada (FASE 2): uma corrediça por lado. */
export const DRAWER_SLIDES_PER_DRAWER = 2;

export const DRAWER_PIECE_TIPOS = [
  "gaveta_frente_int",
  "gaveta_frente_ext",
  "gaveta_frente",
  "gaveta_lat_esq",
  "gaveta_lat_dir",
  "gaveta_fundo",
  "gaveta_traseira",
] as const;

export type DrawerPieceTipo = (typeof DRAWER_PIECE_TIPOS)[number];

export function isDrawerPieceTipo(tipo: string): tipo is DrawerPieceTipo {
  return (DRAWER_PIECE_TIPOS as readonly string[]).includes(tipo);
}

export function isDrawerFrontExtPieceTipo(tipo: string): boolean {
  return tipo === "gaveta_frente_ext" || tipo === "gaveta_frente";
}

export function isDrawerFrontIntPieceTipo(tipo: string): boolean {
  return tipo === "gaveta_frente_int";
}

export function isDrawerFrontFamilyPieceTipo(tipo: string): boolean {
  return isDrawerFrontExtPieceTipo(tipo) || isDrawerFrontIntPieceTipo(tipo);
}

export function isDrawerSideOrBackPieceTipo(tipo: string): boolean {
  return tipo === "gaveta_lat_esq" || tipo === "gaveta_lat_dir" || tipo === "gaveta_traseira";
}

export function boxUsesModernDrawerPipeline(box: { drawersLayer?: DrawerLayerItem[] | null }): boolean {
  return resolveActiveDrawersLayer(box).length > 0;
}

export type DrawerHardwareSummary = {
  drawerId: string;
  drawerIndex: number;
  boxId: string;
  slideType: string;
  slideQuantity: number;
  slideLengthMm?: number;
  softClose: boolean;
  metalBoxType?: string;
  metalBoxProfileId?: string;
  metalBoxHeightMm?: number;
  handleType?: string;
};

/**
 * Ferragens por gaveta a partir de drawersLayer (BOM unificado com cutlist).
 */
export function extractDrawerHardwareSummaryFromLayerItems(
  layerItems: DrawerLayerItem[]
): DrawerHardwareSummary[] {
  return layerItems.map((item, index) => ({
    drawerId: item.id,
    drawerIndex: index + 1,
    boxId: item.parentBoxId,
    slideType: item.slideType ?? "Hettich ArciTech",
    slideQuantity: DRAWER_SLIDES_PER_DRAWER,
    slideLengthMm: item.bodyDepth ?? item.depth,
    softClose: Boolean(item.softClose),
    metalBoxType: item.metalBoxType,
    metalBoxProfileId: item.metadata?.metalBoxProfileId,
    metalBoxHeightMm: item.metadata?.metalBoxHeightMm,
    handleType: item.handleType,
  }));
}

export type DrawerIndustrialBom = {
  pieces: CutListItem[];
  hardware: DrawerHardwareSummary[];
};

export const DRAWER_FRONT_USES_BODY_THICKNESS = true;
export const DRAWER_BACK_THICKNESS_MM = 16;
export const DRAWER_BOTTOM_THICKNESS_MM = 10;
export const DRAWER_METAL_BOTTOM_THICKNESS_MM = 16;

function resolveDrawerExternalFrontThicknessMm(item: DrawerLayerItem): number {
  const fromLayer = Number(item.frontThickness);
  if (Number.isFinite(fromLayer) && fromLayer > 0) return fromLayer;
  return 19;
}

function resolveDrawerInternalFrontThicknessMm(item: DrawerLayerItem): number {
  const fromLayer = Number(item.frontIntThickness ?? item.sideThickness);
  if (Number.isFinite(fromLayer) && fromLayer > 0) return fromLayer;
  return DRAWER_SIDE_THICKNESS_MM;
}

function resolveDrawerInternalFrontWidthMm(item: DrawerLayerItem): number {
  const w = Number(item.frontIntWidth ?? item.bodyWidth);
  if (Number.isFinite(w) && w > 0) return w;
  return item.width;
}

function withDrawerIndustrialMeta(
  piece: CutListItem,
  item: DrawerLayerItem,
  boxName: string,
  drawerIndex1Based: number
): CutListItem {
  const tipo = piece.tipo as DrawerPieceTipo;
  const a1Meta = item.metadata as
    | { innerCabinetId?: string; a1Drawer?: boolean }
    | undefined;
  const isA1Drawer = a1Meta?.innerCabinetId === "a_1" || a1Meta?.a1Drawer === true;
  const a1Token = isA1Drawer ? A1_DRAWER_TIPO_TO_TOKEN[tipo] : undefined;
  const industrialLabel =
    a1Token != null
      ? buildA1DrawerIndustrialLabel(boxName, drawerIndex1Based, a1Token)
      : resolveDrawerPieceIndustrialLabel(item, boxName, tipo, drawerIndex1Based);
  const rotationMeta = buildCutlistRotationMetadata({
    allowPieceRotation: item.allowPieceRotation,
    lockWoodGrain: item.lockWoodGrain,
    materialId: piece.materialId,
  });
  return {
    ...piece,
    nome: industrialLabel,
    metadata: {
      ...(piece.metadata ?? {}),
      industrialLabel,
      drawerIndex: drawerIndex1Based,
      drawerGroupName: item.metadata?.drawerGroupName,
      frontPieceName: item.metadata?.frontPieceName,
      frontIntPieceName: item.metadata?.frontIntPieceName,
      frontExtPieceName: item.metadata?.frontExtPieceName,
      panelId: piece.id,
      ...(isA1Drawer
        ? {
            innerCabinetId: "a_1",
            a1Drawer: true,
          }
        : {}),
      ...rotationMeta,
    },
  };
}

export type DrawerCutlistMaterialContext = {
  bodyMaterialId: string;
};

function normalizeDrawerMaterialContext(
  bodyMaterialIdOrLegacyLabel?: string
): DrawerCutlistMaterialContext {
  return { bodyMaterialId: resolveIndustrialMaterialKey(bodyMaterialIdOrLegacyLabel) };
}

/**
 * BOM industrial unificado: peças (cutlist) + ferragens por gaveta.
 */
export function extractDrawerIndustrialBomFromLayerItems(
  layerItems: DrawerLayerItem[],
  bodyMaterialIdOrLegacyLabel?: string
): DrawerIndustrialBom {
  return {
    pieces: extractDrawerCutlistFromLayerItems(layerItems, bodyMaterialIdOrLegacyLabel),
    hardware: extractDrawerHardwareSummaryFromLayerItems(layerItems),
  };
}

/**
 * Converte uma DrawerLayerItem em múltiplas CutListItems
 * (uma para cada peça: frente, lateral esq, lateral dir, fundo, traseira)
 */
export function drawerLayerItemToCutList(
  item: DrawerLayerItem,
  drawerIndex: number,
  bodyMaterialIdOrLegacyLabel?: string,
  boxName?: string,
  drawerCount?: number
): CutListItem[] {
  const materialContext = normalizeDrawerMaterialContext(bodyMaterialIdOrLegacyLabel);
  const drawerIndex1Based = drawerIndex + 1;
  const stackCount = Math.max(1, Number(drawerCount) || drawerIndex1Based);
  const stackRole = resolveDrawerStackRole(drawerIndex, stackCount);
  const safeBoxName = boxName?.trim() || resolveIndustrialBoxId({ id: item.parentBoxId, nome: undefined });
  const boxId = safeBoxName;
  const boxRef = { id: item.parentBoxId, nome: safeBoxName };

  const bodyW = Number(item.bodyWidth ?? item.width) || 0;
  const bodyH = Number(item.bodyHeight ?? item.height) || 0;
  const bodyD = Number(item.bodyDepth ?? item.depth) || 0;
  if (bodyW <= 0 || bodyH <= 0 || bodyD <= 0) {
    throw IndustrialError.invalidMeasure({
      boxId,
      pieceId: buildIndustrialPieceId(boxId, `GAVETA_${drawerIndex1Based}`),
      detail: `Volume da gaveta ${drawerIndex1Based} inválido (${bodyW}×${bodyH}×${bodyD} mm).`,
    });
  }

  assertIndustrialMaterial(boxRef, `GAVETA_${drawerIndex1Based}_CORPO`, materialContext.bodyMaterialId);

  const sideMaterial = resolveDrawerSideMaterial(materialContext.bodyMaterialId);
  const sideThickness = DRAWER_SIDE_THICKNESS_MM;
  const backThickness = DRAWER_BACK_THICKNESS_MM;
  const hasMetalBox = item.metalBoxType != null && item.metalBoxType !== "Nenhuma";
  const bottomThickness = hasMetalBox
    ? DRAWER_METAL_BOTTOM_THICKNESS_MM
    : Number.isFinite(item.bottomThickness) && (item.bottomThickness ?? 0) > 0
      ? Number(item.bottomThickness)
      : DRAWER_BOTTOM_THICKNESS_MM;
  const bottomMaterial = resolveDrawerBottomMaterial(
    materialContext.bodyMaterialId,
    bottomThickness
  );
  const frontMaterialId = resolveIndustrialMaterialKey(
    item.materialId,
    materialContext.bodyMaterialId
  );
  assertIndustrialMaterial(boxRef, `GAVETA_${drawerIndex1Based}_FRENTE`, frontMaterialId);
  const frontOfficial = resolveMaterial(frontMaterialId)!;
  const frontMaterialLabel = frontOfficial.label;

  const pieces: CutListItem[] = [];

  const baseId = `${item.parentBoxId}-drawer-${drawerIndex}`;
  const metalProfile = hasMetalBox
    ? resolveMetalBoxProfile(
        item.metalBoxType,
        item.metadata?.metalBoxProfileId,
        item.metadata?.metalBoxHeightMm
      )
    : null;
  const drawerHardware = [
    {
      tipo: "corredica",
      nome: item.slideType ?? "Hettich ArciTech",
      quantidade: DRAWER_SLIDES_PER_DRAWER,
      softClose: Boolean(item.softClose),
      capacidadeCargaKg: item.capacityKg ?? 40,
    },
    ...(hasMetalBox
      ? [{
          tipo: "caixa_metalica",
          nome: item.metalBoxType,
          quantidade: 1,
          profileId: metalProfile?.id ?? item.metadata?.metalBoxProfileId,
          heightMm: item.metadata?.metalBoxHeightMm ?? metalProfile?.allowedHeightsMm[0],
          fixationCount: metalProfile?.fixationCount ?? 2,
        }]
      : []),
    ...(item.handleType && item.handleType !== "Nenhum"
      ? [{
          tipo: "handle",
          nome: item.handleType,
          posicao: item.handlePosition ?? "Centro",
          offsetMm: item.handleOffsetMm ?? 0,
          offsetXMm: item.metadata?.handleOffsetXMm ?? 0,
          offsetYMm: item.metadata?.handleOffsetYMm ?? item.handleOffsetMm ?? 0,
          centerDistanceMm: item.metadata?.handleCenterDistanceMm,
          profileId: item.metadata?.handleProfileId,
          quantidade: 1,
        }]
      : []),
  ];

  const externalFrontHeightMm = resolveDrawerExternalFrontHeightMm(item);
  const internalFrontHeightMm = resolveDrawerInternalFrontHeightMm(item);
  const externalFrontThicknessMm = resolveDrawerExternalFrontThicknessMm(item);
  const internalFrontThicknessMm = resolveDrawerInternalFrontThicknessMm(item);
  const internalFrontWidthMm = resolveDrawerInternalFrontWidthMm(item);

  const gpsMeta = item.metadata as { gavetaPortaSep?: boolean; frontHeightMm?: number } | undefined;
  const isGavetaPortaSep = Boolean(gpsMeta?.gavetaPortaSep);
  const resolvedFrontWidthMm = isGavetaPortaSep
    ? Math.max(1, Number(item.width) || 0)
    : item.width;
  const resolvedFrontHeightMm = isGavetaPortaSep
    ? Math.max(
        1,
        Number(gpsMeta?.frontHeightMm) > 0
          ? Number(gpsMeta?.frontHeightMm)
          : externalFrontHeightMm
      )
    : externalFrontHeightMm;

  const structuralDrawerRules = {
    slideType: item.slideType ?? "Hettich ArciTech",
    softClose: Boolean(item.softClose),
    metalBoxType: item.metalBoxType ?? "Nenhuma",
    metalBoxProfileId: item.metadata?.metalBoxProfileId,
    metalBoxHeightMm: item.metadata?.metalBoxHeightMm,
    sideHeightMm: item.leftSideHeight ?? item.rightSideHeight ?? item.bodyHeight,
    bodyWidthMm: item.bodyWidth,
    sideThicknessMm: sideThickness,
    bottomThicknessMm: bottomMaterial.thicknessMm,
    stackRole,
    drawerCount: stackCount,
    frontHeightMm: resolvedFrontHeightMm,
  };

  const decorativeDrawerRules = {
    handleType: item.handleType ?? "Nenhum",
    handleProfileId: item.metadata?.handleProfileId,
    handleCenterDistanceMm: item.metadata?.handleCenterDistanceMm,
    handlePosition: item.handlePosition ?? "Centro",
    handlePositionPercent: item.metadata?.handlePositionPercent,
    handleOffsetXMm: item.metadata?.handleOffsetXMm,
    handleOffsetYMm: item.metadata?.handleOffsetYMm ?? item.handleOffsetMm,
    handleOffsetMm: item.handleOffsetMm ?? 0,
    slideType: item.slideType ?? "Hettich ArciTech",
    softClose: Boolean(item.softClose),
    metalBoxType: item.metalBoxType ?? "Nenhuma",
    sideHeightMm: item.leftSideHeight ?? item.rightSideHeight ?? item.bodyHeight,
    bodyWidthMm: item.bodyWidth,
    sideThicknessMm: sideThickness,
    bottomThicknessMm: bottomMaterial.thicknessMm,
    stackRole,
    drawerCount: stackCount,
    frontHeightMm: resolvedFrontHeightMm,
  };

  const externalFrontPiece = withDrawerIndustrialMeta(
    {
      id: `${baseId}-front-ext`,
      nome: `Gaveta ${drawerIndex1Based} - Frente Externa`,
      quantidade: 1,
      dimensoes: {
        largura: resolvedFrontWidthMm,
        altura: resolvedFrontHeightMm,
        profundidade: externalFrontThicknessMm,
      },
      espessura: externalFrontThicknessMm,
      material: frontMaterialLabel,
      tipo: "gaveta_frente_ext",
      sourceType: "parametric",
      boxId: item.parentBoxId,
      materialId: frontOfficial.canonicalId,
      grainDirection: resolveIndustrialGrainCode({ tipo: "gaveta_frente_ext" }),
      metadata: {
        drawerHardware,
        drawerRules: decorativeDrawerRules,
      },
    },
    item,
    safeBoxName,
    drawerIndex1Based
  );

  const internalFrontPiece = withDrawerIndustrialMeta(
    {
      id: `${baseId}-front-int`,
      nome: `Gaveta ${drawerIndex1Based} - Frente Interna`,
      quantidade: 1,
      dimensoes: {
        largura: internalFrontWidthMm,
        altura: internalFrontHeightMm,
        profundidade: internalFrontThicknessMm,
      },
      espessura: internalFrontThicknessMm,
      material: sideMaterial.label,
      tipo: "gaveta_frente_int",
      sourceType: "parametric",
      boxId: item.parentBoxId,
      materialId: sideMaterial.materialId,
      grainDirection: resolveIndustrialGrainCode({ tipo: "gaveta_frente_int" }),
      metadata: {
        drawerHardware,
        drawerRules: structuralDrawerRules,
      },
    },
    item,
    safeBoxName,
    drawerIndex1Based
  );

  if (hasMetalBox) {
    pieces.push(internalFrontPiece);
  }

  pieces.push(externalFrontPiece);

  const hasLeftSide =
    (item.leftSideWidth ?? 0) > 0 ||
    (item.leftSideHeight ?? 0) > 0 ||
    (item.leftSideDepth ?? 0) > 0;
  const hasRightSide =
    (item.rightSideWidth ?? 0) > 0 ||
    (item.rightSideHeight ?? 0) > 0 ||
    (item.rightSideDepth ?? 0) > 0;

  // LATERAL ESQUERDA (1×) — só gaveta de madeira
  if (!hasMetalBox && hasLeftSide) {
    pieces.push(
      withDrawerIndustrialMeta(
        {
          id: `${baseId}-left`,
          nome: `Gaveta ${drawerIndex1Based} - Lateral Esquerda`,
          quantidade: 1,
          dimensoes: {
            largura: item.leftSideDepth ?? 0,
            altura: item.leftSideHeight ?? 0,
            profundidade: sideThickness,
          },
          espessura: sideThickness,
          material: sideMaterial.label,
          tipo: "gaveta_lat_esq",
          sourceType: "parametric",
          boxId: item.parentBoxId,
          materialId: sideMaterial.materialId,
          grainDirection: resolveIndustrialGrainCode({ tipo: "gaveta_lat_esq" }),
          metadata: { drawerRules: structuralDrawerRules },
        },
        item,
        safeBoxName,
        drawerIndex1Based
      )
    );
  }

  // LATERAL DIREITA (1×) — só gaveta de madeira
  if (!hasMetalBox && hasRightSide) {
    pieces.push(
      withDrawerIndustrialMeta(
        {
          id: `${baseId}-right`,
          nome: `Gaveta ${drawerIndex1Based} - Lateral Direita`,
          quantidade: 1,
          dimensoes: {
            largura: item.rightSideDepth ?? 0,
            altura: item.rightSideHeight ?? 0,
            profundidade: sideThickness,
          },
          espessura: sideThickness,
          material: sideMaterial.label,
          tipo: "gaveta_lat_dir",
          sourceType: "parametric",
          boxId: item.parentBoxId,
          materialId: sideMaterial.materialId,
          grainDirection: resolveIndustrialGrainCode({ tipo: "gaveta_lat_dir" }),
          metadata: { drawerRules: structuralDrawerRules },
        },
        item,
        safeBoxName,
        drawerIndex1Based
      )
    );
  }

  // FUNDO (10 mm)
  if (bottomMaterial.thicknessMm > 0 && (item.bottomWidth ?? 0) > 0 && (item.bottomDepth ?? 0) > 0) {
    pieces.push(
      withDrawerIndustrialMeta(
        {
          id: `${baseId}-bottom`,
          nome: `Gaveta ${drawerIndex1Based} - Fundo`,
          quantidade: 1,
          dimensoes: {
            largura: item.bottomWidth ?? 0,
            altura: item.bottomDepth ?? 0,
            profundidade: bottomMaterial.thicknessMm,
          },
          espessura: bottomMaterial.thicknessMm,
          material: bottomMaterial.label,
          tipo: "gaveta_fundo",
          sourceType: "parametric",
          boxId: item.parentBoxId,
          materialId: bottomMaterial.materialId,
          grainDirection: resolveIndustrialGrainCode({ tipo: "gaveta_fundo" }),
        },
        item,
        safeBoxName,
        drawerIndex1Based
      )
    );
  }

  // COSTAS / TRASEIRA (16 mm)
  if ((item.backWidth ?? 0) > 0 && (item.backHeight ?? 0) > 0) {
    pieces.push(
      withDrawerIndustrialMeta(
        {
          id: `${baseId}-back`,
          nome: `Gaveta ${drawerIndex1Based} - Costas`,
          quantidade: 1,
          dimensoes: {
            largura: item.backWidth ?? 0,
            altura: item.backHeight ?? 0,
            profundidade: backThickness,
          },
          espessura: backThickness,
          material: sideMaterial.label,
          tipo: "gaveta_traseira",
          sourceType: "parametric",
          boxId: item.parentBoxId,
          materialId: sideMaterial.materialId,
          grainDirection: resolveIndustrialGrainCode({ tipo: "gaveta_traseira" }),
          metadata: { drawerRules: structuralDrawerRules },
        },
        item,
        safeBoxName,
        drawerIndex1Based
      )
    );
  }

  return pieces;
}

/**
 * Converte todas as DrawerLayerItems de um box em CutListItems
 */
export function extractDrawerCutlistFromLayerItems(
  layerItems: DrawerLayerItem[],
  bodyMaterialIdOrLegacyLabel?: string,
  boxName?: string
): CutListItem[] {
  const allPieces: CutListItem[] = [];
  const count = layerItems.length;

  for (let i = 0; i < layerItems.length; i++) {
    const item = layerItems[i];
    const pieces = drawerLayerItemToCutList(
      item,
      i,
      bodyMaterialIdOrLegacyLabel,
      boxName,
      count
    );
    allPieces.push(...pieces);
  }

  return allPieces;
}
