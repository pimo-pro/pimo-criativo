/**
 * Furação industrial cx_gav — toda a lógica concentrada aqui.
 * Cavilha 10×30 @ 20 mm das bordas; encaixe 10×13 @ 30/70 mm da traseira;
 * fixação adicional via catálogo (parafuso_4x19).
 */

import type { PanelDrillHole } from "../types";
import {
  CAVILHA_10x40_DIAMETER_MM,
  CAVILHA_10x40_FERRAGEM_ID,
  CAVILHA_EDGE_DEPTH_MM,
  CAVILHA_EDGE_HOLE_TYPE_ID,
  CAVILHA_FACE_DEPTH_MM,
  CAVILHA_FACE_HOLE_TYPE_ID,
} from "../drill/cavilha10x40Rule";
import { getHoleTypeById } from "../drill/holeCatalog";
import {
  CX_GAV_CIMA_DEPTH_MM,
  CX_GAV_EDGE_INSET_MM,
  CX_GAV_FACE_FROM_REAR_MM,
  type CxGavLayout,
  type CxGavPieceTipo,
} from "./cxGavGeometry";

function edgeCavilha(x: number, y: number, pairedHoleKey: string): PanelDrillHole {
  return {
    x,
    y,
    diameter: CAVILHA_10x40_DIAMETER_MM,
    depth: CAVILHA_EDGE_DEPTH_MM,
    holeType: "cavilha",
    face: "B",
    topDrillable: false,
    holeCatalogId: CAVILHA_EDGE_HOLE_TYPE_ID,
    ferragemId: CAVILHA_10x40_FERRAGEM_ID,
    pairedHoleKey,
  };
}

function faceCavilha(x: number, y: number, pairedHoleKey: string): PanelDrillHole {
  return {
    x,
    y,
    diameter: CAVILHA_10x40_DIAMETER_MM,
    depth: CAVILHA_FACE_DEPTH_MM,
    holeType: "cavilha",
    face: "B",
    topDrillable: true,
    holeCatalogId: CAVILHA_FACE_HOLE_TYPE_ID,
    ferragemId: CAVILHA_10x40_FERRAGEM_ID,
    pairedHoleKey,
  };
}

function fixationHole(x: number, y: number): PanelDrillHole {
  const p = getHoleTypeById("parafuso_4x19");
  return {
    x,
    y,
    diameter: p.diametroMm,
    depth: p.profundidadeMm,
    holeType: p.drillType,
    face: "B",
    topDrillable: true,
    holeCatalogId: p.id,
  };
}

/** Frame lateral: x ao longo da profundidade (0 = frente, D = traseira). */
function buildLateralHoles(side: "esq" | "dir", layout: CxGavLayout): PanelDrillHole[] {
  const D = layout.lateralProfundidadeMm;
  const H = layout.lateralAlturaMm;
  const T = layout.espessuraMm;
  const inset = CX_GAV_EDGE_INSET_MM;
  if (D <= 0 || H <= 0) return [];

  const yBot = Math.min(inset, H / 2);
  const yTop = Math.max(H - inset, H / 2);
  const xFront = inset;
  const xBack = Math.max(inset, D - inset);
  const prefix = `cxgav-lat-${side}`;

  const holes: PanelDrillHole[] = [
    // Aresta fundo: 10×30 a 20 mm das bordas
    edgeCavilha(xFront, yBot, `${prefix}-bot-front`),
    edgeCavilha(xBack, yBot, `${prefix}-bot-back`),
    // Aresta cima (zona traseira 100 mm): 10×30 a 20 mm das bordas da cima
    edgeCavilha(Math.max(inset, D - CX_GAV_CIMA_DEPTH_MM + inset), yTop, `${prefix}-top-front`),
    edgeCavilha(xBack, yTop, `${prefix}-top-back`),
  ];

  // Encaixe 10×13 na face a 30 mm e 70 mm da borda traseira
  for (const fromRear of CX_GAV_FACE_FROM_REAR_MM) {
    const x = Math.max(inset, D - fromRear);
    holes.push(faceCavilha(x, yTop, `${prefix}-face-rear-${fromRear}`));
    holes.push(fixationHole(x, yBot));
  }

  // Fixação adicional junto às cavilhas de aresta
  holes.push(fixationHole(xFront, T));
  holes.push(fixationHole(xBack, T));

  return holes;
}

function buildFundoHoles(layout: CxGavLayout): PanelDrillHole[] {
  const W = layout.fundoLarguraMm;
  const D = layout.fundoProfundidadeMm;
  const inset = CX_GAV_EDGE_INSET_MM;
  if (W <= 0 || D <= 0) return [];

  const yFront = inset;
  const yBack = Math.max(inset, D - inset);
  const xL = inset;
  const xR = Math.max(inset, W - inset);

  return [
    faceCavilha(xL, yFront, "cxgav-lat-esq-bot-front"),
    faceCavilha(xL, yBack, "cxgav-lat-esq-bot-back"),
    faceCavilha(xR, yFront, "cxgav-lat-dir-bot-front"),
    faceCavilha(xR, yBack, "cxgav-lat-dir-bot-back"),
    fixationHole(xL, (yFront + yBack) / 2),
    fixationHole(xR, (yFront + yBack) / 2),
  ];
}

function buildCimaHoles(layout: CxGavLayout): PanelDrillHole[] {
  const W = layout.cimaLarguraMm;
  const D = layout.cimaProfundidadeMm;
  const inset = CX_GAV_EDGE_INSET_MM;
  if (W <= 0 || D <= 0) return [];

  const yFront = inset;
  const yBack = Math.max(inset, D - inset);
  const xL = inset;
  const xR = Math.max(inset, W - inset);

  return [
    faceCavilha(xL, yFront, "cxgav-lat-esq-top-front"),
    faceCavilha(xL, yBack, "cxgav-lat-esq-top-back"),
    faceCavilha(xR, yFront, "cxgav-lat-dir-top-front"),
    faceCavilha(xR, yBack, "cxgav-lat-dir-top-back"),
    fixationHole(xL, (yFront + yBack) / 2),
    fixationHole(xR, (yFront + yBack) / 2),
  ];
}

export function buildCxGavDrillHoles(
  tipo: CxGavPieceTipo,
  layout: CxGavLayout
): PanelDrillHole[] {
  switch (tipo) {
    case "cx_gav_lat_esq":
      return buildLateralHoles("esq", layout);
    case "cx_gav_lat_dir":
      return buildLateralHoles("dir", layout);
    case "cx_gav_fun":
      return buildFundoHoles(layout);
    case "cx_gav_cima":
      return buildCimaHoles(layout);
    default:
      return [];
  }
}
