/**
 * Regras de furação industrial para módulos base (cavilhas, dobradiças, prateleira, costa).
 */

import { calcLateralDowelHoles } from "../../drill/lateralDowels";
import { defaultRulesConfig } from "../../rules/rulesConfig";
import { getHingeYPositions, getNumDobradicas } from "../../rules/rulesConfig";
import {
  addDesignDrillHole,
  insertDesignHoleWithCavilhaPairing,
  nextDesignId,
} from "../designModel";
import { isLeftLateral, isRightLateral } from "../cavilhaPairing";
import type { DesignPanel, IndustrialDesignBox } from "../types";

const edgeOffsetMm = (panel: DesignPanel) => Math.max(4, panel.thicknessMm / 2);

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Cavilhas estruturais laterais ↔ cima/fundo (4 por lateral). */
export function applyLateralStructuralDowels(box: IndustrialDesignBox): IndustrialDesignBox {
  let current = box;
  const laterals = box.panels.filter((p) => p.tipo === "lateral");

  for (const lateral of laterals) {
    const offset = edgeOffsetMm(lateral);
    const dowels = calcLateralDowelHoles(lateral.widthMm);
    for (const d of dowels) {
      const yMm = d.edge === "top" ? lateral.heightMm - offset : offset;
      current = insertDesignHoleWithCavilhaPairing(
        current,
        lateral.id,
        "cavilha_10x30",
        d.x,
        yMm,
        "espessura"
      ).box;
    }
  }

  return current;
}

/** Cavilhas prateleira ↔ laterais (frente e fundo da prateleira). */
export function applyShelfDowelHoles(box: IndustrialDesignBox, shelf: DesignPanel): IndustrialDesignBox {
  const laterals = box.panels.filter((p) => p.tipo === "lateral");
  if (!laterals.length) return box;

  let current: IndustrialDesignBox = {
    ...box,
    constraints: [
      ...box.constraints,
      ...laterals.map((lat) => ({
        id: nextDesignId("constraint"),
        panelAId: shelf.id,
        panelBId: lat.id,
        tipo: "encaixe_cavilha" as const,
      })),
    ],
  };

  const inset = 50;
  const positions: Array<[number, number]> = [
    [inset, inset],
    [inset, shelf.heightMm - inset],
    [shelf.widthMm - inset, inset],
    [shelf.widthMm - inset, shelf.heightMm - inset],
  ];

  for (const [xMm, yMm] of positions) {
    current = insertDesignHoleWithCavilhaPairing(
      current,
      shelf.id,
      "cavilha_10x30",
      xMm,
      yMm,
      "espessura"
    ).box;
  }

  return current;
}

export type ShelfTechnicalMarginOverride = {
  margemTopo: number;
  margemBase: number;
};

function applyShelfTechnicalHolesOnLateral(
  box: IndustrialDesignBox,
  lateral: DesignPanel,
  marginOverride?: ShelfTechnicalMarginOverride
): IndustrialDesignBox {
  const cfg = defaultRulesConfig.furos.tecnicos.prateleira;
  if (!cfg.enabled) return box;

  const margemFrente = cfg.margemFrente ?? cfg.distanciaDaBorda ?? 60;
  const margemFundo = cfg.margemFundo ?? cfg.distanciaDaBorda ?? 60;
  const margemTopo = marginOverride?.margemTopo ?? cfg.margemTopo ?? 200;
  const margemBase = marginOverride?.margemBase ?? cfg.margemBase ?? 200;
  const minFuros = cfg.minFurosPorColuna ?? 6;
  const maxFuros = cfg.maxFurosPorColuna ?? 40;

  const zonaUtil = Math.max(0, lateral.heightMm - margemTopo - margemBase);
  if (zonaUtil <= 0) return box;

  const numFuros = clamp(Math.ceil(zonaUtil / 32), minFuros, maxFuros);
  const step = numFuros > 1 ? zonaUtil / (numFuros - 1) : zonaUtil;

  const isEsquerda = isLeftLateral(lateral);
  const xFrente = isEsquerda ? lateral.widthMm - margemFrente : margemFrente;
  const xFundo = isEsquerda ? margemFundo : lateral.widthMm - margemFundo;

  let current = box;
  for (let i = 0; i < numFuros; i++) {
    const y = margemTopo + (numFuros > 1 ? i * step : zonaUtil / 2);
    current = addDesignDrillHole(current, lateral.id, {
      holeTypeId: "tecnico_prateleira",
      xMm: xFrente,
      yMm: y,
      face: "face",
    }).box;
    current = addDesignDrillHole(current, lateral.id, {
      holeTypeId: "tecnico_prateleira",
      xMm: xFundo,
      yMm: y,
      face: "face",
    }).box;
  }

  return current;
}

function applyDoorHingeHoles(
  box: IndustrialDesignBox,
  door: DesignPanel,
  hingePositionsLocal: number[],
  hingeSide: "left" | "right"
): IndustrialDesignBox {
  const cfg = defaultRulesConfig.furos.tecnicos.dobradica;
  const distBorda = cfg.distanciaBordaLateral ?? cfg.distanciaCentroDaBorda ?? 22.5;
  const xHinge = hingeSide === "left" ? distBorda : door.widthMm - distBorda;

  let current = box;
  for (const y of hingePositionsLocal) {
    current = addDesignDrillHole(current, door.id, {
      holeTypeId: "dobradica_caneco",
      xMm: xHinge,
      yMm: y,
      face: "face",
    }).box;
  }
  return current;
}

function applyLateralHingeFixationHoles(
  box: IndustrialDesignBox,
  lateral: DesignPanel,
  hingePositionsMm: number[]
): IndustrialDesignBox {
  const cfg = defaultRulesConfig.furos.tecnicos.dobradica_fixacao;
  const distCalco = cfg.distanciaDaBordaCalco ?? 37;
  const distUniao = cfg.distanciaDaBordaParafusoUniao ?? 53;
  const distEntre = cfg.distanciaEntreFurosCalco ?? 32;
  const half = distEntre / 2;
  const isEsquerda = isLeftLateral(lateral);
  const xCalco = isEsquerda ? lateral.widthMm - distCalco : distCalco;
  const xUniao = isEsquerda ? lateral.widthMm - distUniao : distUniao;

  let current = box;
  for (const y of hingePositionsMm) {
    current = addDesignDrillHole(current, lateral.id, {
      holeTypeId: "dobradica_fixacao_calco",
      xMm: xCalco - half,
      yMm: y,
      face: "face",
    }).box;
    current = addDesignDrillHole(current, lateral.id, {
      holeTypeId: "dobradica_fixacao_calco",
      xMm: xCalco + half,
      yMm: y,
      face: "face",
    }).box;
    current = addDesignDrillHole(current, lateral.id, {
      holeTypeId: "dobradica_parafuso_uniao",
      xMm: xUniao,
      yMm: y,
      face: "face",
    }).box;
  }
  return current;
}

/** Dobradiças na porta + laterais; furos técnicos de prateleira nas laterais. */
export type IndustrialCabinetDrillingOptions = {
  hasShelf: boolean;
  hingeSide?: "left" | "right";
  /** Margens para furos 32 mm (módulos compactos, ex. superior 350 mm). */
  shelfTechnicalMargins?: ShelfTechnicalMarginOverride;
};

export function applyDoorAndLateralTechnicalHoles(
  box: IndustrialDesignBox,
  door: DesignPanel,
  options: IndustrialCabinetDrillingOptions
): IndustrialDesignBox {
  const rules = defaultRulesConfig;
  const innerH = box.outerHeightMm - 2 * box.espessuraMm;
  const doorGap = 2;
  const bottomGapMm = door.positionMm?.y != null ? door.positionMm.y - box.espessuraMm : doorGap;
  const hingeSide = options.hingeSide ?? "left";

  const hingeGlobal = getHingeYPositions(innerH, getNumDobradicas(innerH, rules), rules);
  const hingeLocal = hingeGlobal.map((y) => y - bottomGapMm);

  let current = applyDoorHingeHoles(box, door, hingeLocal, hingeSide);

  const laterals = box.panels.filter((p) => p.tipo === "lateral");
  for (const lateral of laterals) {
    const isHingeLateral =
      (hingeSide === "left" && isLeftLateral(lateral)) ||
      (hingeSide === "right" && isRightLateral(lateral));

    if (isHingeLateral) {
      current = applyLateralHingeFixationHoles(current, lateral, hingeGlobal);
    }
    if (options.hasShelf) {
      current = applyShelfTechnicalHolesOnLateral(
        current,
        lateral,
        options.shelfTechnicalMargins
      );
    }
  }

  return current;
}

/** Furos de fixação estrutural na costa. */
export function applyBackStructuralFixation(box: IndustrialDesignBox): IndustrialDesignBox {
  const costa = box.panels.find((p) => p.tipo === "costa");
  if (!costa) return box;

  const margin = 50;
  const midX = costa.widthMm / 2;
  const midY = costa.heightMm / 2;
  const positions: Array<[number, number]> = [
    [margin, margin],
    [costa.widthMm - margin, margin],
    [margin, costa.heightMm - margin],
    [costa.widthMm - margin, costa.heightMm - margin],
    [midX, margin],
    [midX, costa.heightMm - margin],
    [margin, midY],
    [costa.widthMm - margin, midY],
  ];

  let current = box;
  for (const [xMm, yMm] of positions) {
    current = addDesignDrillHole(current, costa.id, {
      holeTypeId: "fixacao_estrutural",
      xMm,
      yMm,
      face: "espessura",
    }).box;
  }

  return current;
}

export function applyAllIndustrialBaseDrillingRules(
  box: IndustrialDesignBox,
  options: IndustrialCabinetDrillingOptions
): IndustrialDesignBox {
  let current = applyLateralStructuralDowels(box);

  const shelf = box.panels.find((p) => p.tipo === "prateleira");
  if (options.hasShelf && shelf) {
    current = applyShelfDowelHoles(current, shelf);
  }

  const door = box.panels.find((p) => p.tipo === "frente");
  if (door) {
    current = applyDoorAndLateralTechnicalHoles(current, door, options);
  }

  return applyBackStructuralFixation(current);
}
