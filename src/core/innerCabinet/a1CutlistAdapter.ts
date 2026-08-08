/**
 * Adapter cutlist — carcaça a_1 + gavetas internas + compensador 40 mm.
 * Path aditivo no final de cutlistComPrecoFromBox.
 */

import type { BoxModule, CutListItem } from "../types";
import { resolveIndustrialGrainCode } from "../materials/grainDirection";
import { getMaterialDisplayInfo } from "../materials/materialsService";
import { resolveIndustrialMaterialKey } from "../materials/service";
import { buildCutlistRotationMetadata } from "../manufacturing/cutlistRotationMetadata";
import { DRAWER_FRONT_LATERAL_GAP_MM } from "../drawers/drawerGeometryConstants";
import {
  DRAWER_BOTTOM_DEFAULT_THICKNESS_MM,
  DRAWER_SIDE_THICKNESS_MM,
} from "../materials/materials.api";
import {
  boxUsesInnerCabinetA1,
  computeA1Layout,
  type A1Layout,
} from "./a1Geometry";
import {
  A1_DRAWER_TIPO_TO_TOKEN,
  buildA1CarcassIndustrialLabel,
  buildA1DrawerIndustrialLabel,
  type A1CarcassToken,
  type A1DrawerPieceToken,
} from "./a1Naming";
import { buildHingeCompensation40CutlistItem } from "./hingeCompensation40";

export const A1_CARCASS_TIPOS = [
  "a1_cx_lat_dir",
  "a1_cx_lat_esq",
  "a1_cx_cima",
  "a1_cx_fundo",
] as const;

export type A1CarcassTipo = (typeof A1_CARCASS_TIPOS)[number];

const DRAWER_BACK_THICKNESS_MM = 16;

function carcassDims(
  tipo: A1CarcassTipo,
  layout: A1Layout
): { largura: number; altura: number; espessura: number } {
  const e = layout.espessuraMm;
  switch (tipo) {
    case "a1_cx_lat_dir":
    case "a1_cx_lat_esq":
      return {
        largura: layout.lateralProfundidadeMm,
        altura: layout.lateralAlturaMm,
        espessura: e,
      };
    case "a1_cx_cima":
      return {
        largura: layout.cimaLarguraMm,
        altura: layout.cimaProfundidadeMm,
        espessura: e,
      };
    case "a1_cx_fundo":
      return {
        largura: layout.fundoLarguraMm,
        altura: layout.fundoProfundidadeMm,
        espessura: e,
      };
  }
}

function carcassToken(tipo: A1CarcassTipo): A1CarcassToken {
  if (tipo === "a1_cx_lat_dir") return "cx_lat_dir";
  if (tipo === "a1_cx_lat_esq") return "cx_lat_esq";
  if (tipo === "a1_cx_cima") return "cx_cima";
  return "cx_fundo";
}

function buildA1DrawerPieces(
  box: BoxModule,
  layout: A1Layout,
  materialId: string,
  boxName: string
): CutListItem[] {
  const gap = DRAWER_FRONT_LATERAL_GAP_MM;
  const sideT = DRAWER_SIDE_THICKNESS_MM;
  const bottomT = DRAWER_BOTTOM_DEFAULT_THICKNESS_MM;
  const pieces: CutListItem[] = [];
  const materialLabel = getMaterialDisplayInfo(materialId).label;

  for (let i = 0; i < layout.drawerCount; i++) {
    const idx = i + 1;
    const frontW = Math.max(1, layout.outerWidthMm - 2 * gap);
    const frontH = Math.max(1, layout.drawerZoneHeightMm - 2 * gap);
    const bodyW = Math.max(1, frontW - 2 * sideT);
    const bodyD = Math.max(150, layout.depthMm - 50);
    const sideH = Math.max(1, Math.round(frontH * 0.75));

    const specs: Array<{
      tipo: string;
      token: A1DrawerPieceToken;
      w: number;
      h: number;
      t: number;
    }> = [
      {
        tipo: "gaveta_frente_ext",
        token: "fren",
        w: frontW,
        h: frontH,
        t: layout.espessuraMm,
      },
      { tipo: "gaveta_lat_dir", token: "lat_dir", w: bodyD, h: sideH, t: sideT },
      { tipo: "gaveta_lat_esq", token: "lat_esq", w: bodyD, h: sideH, t: sideT },
      { tipo: "gaveta_fundo", token: "fun", w: bodyW, h: bodyD, t: bottomT },
      {
        tipo: "gaveta_traseira",
        token: "costa",
        w: bodyW,
        h: sideH,
        t: DRAWER_BACK_THICKNESS_MM,
      },
    ];

    for (const s of specs) {
      const token = A1_DRAWER_TIPO_TO_TOKEN[s.tipo] ?? s.token;
      const industrialLabel = buildA1DrawerIndustrialLabel(boxName, idx, token);
      pieces.push({
        id: `${box.id}-a1-gav-${idx}-${s.tipo}`,
        nome: industrialLabel,
        quantidade: 1,
        dimensoes: { largura: s.w, altura: s.h, profundidade: s.t },
        espessura: s.t,
        material: materialLabel,
        materialId,
        tipo: s.tipo,
        sourceType: "parametric",
        boxId: box.id,
        grainDirection: resolveIndustrialGrainCode({ tipo: s.tipo }),
        metadata: {
          industrialLabel,
          innerCabinetId: "a_1",
          drawerIndex: idx,
          a1Drawer: true,
          frontHeightMm: frontH,
        },
      });
    }
  }
  return pieces;
}

/**
 * Emite carcaça a_1 + compensador 40 mm + gavetas internas.
 * Retorna [] se a caixa não usa o modo inner_cabinet_a1.
 */
export function extractA1CutlistFromBox(
  box: BoxModule,
  bodyMaterialIdOrLegacyLabel?: string,
  boxName?: string
): CutListItem[] {
  if (!boxUsesInnerCabinetA1(box)) return [];
  const layout = computeA1Layout(box);
  if (layout.outerWidthMm <= 0 || layout.lateralAlturaMm <= 0 || layout.depthMm <= 0) {
    return [];
  }

  const materialId = resolveIndustrialMaterialKey(bodyMaterialIdOrLegacyLabel);
  const name = boxName ?? box.nome ?? box.id;
  const rotationMeta = buildCutlistRotationMetadata({
    allowPieceRotation: box.allowPieceRotation,
    lockWoodGrain: box.lockWoodGrain,
    materialId,
  });
  const materialLabel = getMaterialDisplayInfo(materialId).label;

  const carcass: CutListItem[] = A1_CARCASS_TIPOS.map((tipo) => {
    const dims = carcassDims(tipo, layout);
    const industrialLabel = buildA1CarcassIndustrialLabel(name, carcassToken(tipo));
    return {
      id: `${box.id}-${tipo}`,
      nome: industrialLabel,
      quantidade: 1,
      dimensoes: {
        largura: dims.largura,
        altura: dims.altura,
        profundidade: dims.espessura,
      },
      espessura: dims.espessura,
      material: materialLabel,
      materialId,
      tipo,
      sourceType: "parametric" as const,
      boxId: box.id,
      grainDirection: resolveIndustrialGrainCode({ tipo }),
      metadata: {
        panelId: `${box.id}-${tipo}`,
        industrialLabel,
        innerCabinetId: "a_1",
        ...rotationMeta,
      },
    };
  });

  const compensator = buildHingeCompensation40CutlistItem({
    box,
    depthMm: layout.depthMm,
    heightMm: layout.lateralAlturaMm,
    espessuraMm: layout.espessuraMm,
    bodyMaterialId: materialId,
    boxName: name,
  });

  const drawers = buildA1DrawerPieces(box, layout, materialId, name);
  return [...carcass, compensator, ...drawers];
}
