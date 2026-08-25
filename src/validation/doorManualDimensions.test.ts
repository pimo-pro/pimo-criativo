import { describe, expect, it } from "vitest";
import { cutlistComPrecoFromBox } from "../core/manufacturing/cutlistFromBoxes";
import { defaultRulesConfig } from "../core/rules/rulesConfig";
import type { BoxModule } from "../core/types";
import type { DoorLayerItem } from "../models/BoxLayers";
import {
  applyDoorHeightWithOrigin,
  computeDoorVerticalGaps,
  mergeDoorDimensionUpdate,
} from "../core/doors/doorLayerGeometry";

function baseDoor(overrides: Partial<DoorLayerItem> = {}): DoorLayerItem {
  return {
    id: "door-1",
    parentBoxId: "box-1",
    width: 594,
    height: 1994,
    thickness: 19,
    openDirection: "left",
    isOpen: false,
    hingeSide: "left",
    pivot: "left-edge",
    posX: -297,
    posY: 0,
    posZ: 300,
    rotY: 0,
    ...overrides,
  };
}

function baseBox(doorsLayer: DoorLayerItem[]): BoxModule {
  return {
    id: "box-1",
    nome: "Caixa",
    dimensoes: { largura: 600, altura: 2000, profundidade: 300 },
    espessura: 19,
    tipoBorda: "reta",
    tipoFundo: "integrado",
    models: [],
    prateleiras: 0,
    portaTipo: "porta_simples",
    gavetas: 0,
    alturaGaveta: 0,
    doorsLayer,
    drawersLayer: [],
    cutList: [],
    cutListComPreco: [],
    ferragens: [],
    precoTotalPecas: 0,
    estrutura3D: null,
  } as unknown as BoxModule;
}

describe("doorLayerGeometry", () => {
  it("ajuste a partir de cima mantém a borda superior", () => {
    const door = baseDoor({ height: 2000, posY: 0 });
    const next = applyDoorHeightWithOrigin(door, 1980, "top");
    expect(next.height).toBe(1980);
    expect(next.posY).toBe(10);
    const beforeTop = door.posY + door.height / 2;
    expect(next.posY! + next.height / 2).toBeCloseTo(beforeTop, 4);
  });

  it("ajuste a partir de baixo mantém a borda inferior", () => {
    const door = baseDoor({ height: 2000, posY: 0 });
    const next = applyDoorHeightWithOrigin(door, 1960, "bottom");
    expect(next.height).toBe(1960);
    expect(next.posY).toBe(-20);
    expect(next.posY! - next.height / 2).toBeCloseTo(door.posY - door.height / 2, 4);
  });

  it("applyVerticalAdjustMm altera altura com origem configurada", () => {
    const door = baseDoor();
    const next = mergeDoorDimensionUpdate(door, { applyVerticalAdjustMm: -20, verticalAdjustOrigin: "top" }, 1962);
    expect(next.height).toBe(1974);
    expect(next.manualDimensions).toBe(true);
  });
});

describe("cutlist — dimensões manuais da porta", () => {
  it("usa width/height de doorsLayer na peça porta_simples", () => {
    const door = baseDoor({ width: 580, height: 1900, manualDimensions: true });
    const list = cutlistComPrecoFromBox(baseBox([door]), defaultRulesConfig);
    const porta = list.find((item) => item.tipo === "porta_simples");
    expect(porta?.dimensoes.largura).toBe(580);
    expect(porta?.dimensoes.altura).toBe(1900);
  });

  it("recalcula folgas verticais quando posY muda", () => {
    const centered = computeDoorVerticalGaps(1962, 1900, 0);
    const lowered = computeDoorVerticalGaps(1962, 1900, -20);
    expect(lowered.bottomGapMm).toBeLessThan(centered.bottomGapMm);
    expect(lowered.topGapMm).toBeGreaterThan(centered.topGapMm);
  });

  it("nome e doorPositionKind — posição lateral (port_esq / Porta Esquerda)", () => {
    const door = baseDoor({ hingeSide: "left" });
    const list = cutlistComPrecoFromBox(baseBox([door]), defaultRulesConfig);
    const porta = list.find((item) => item.tipo === "porta_simples");
    expect(porta?.nome).toBe("port_esq");
    expect(porta?.metadata?.industrialLabel).toBeUndefined();
    expect(porta?.metadata?.doorDisplayLabel).toBe("Porta Esquerda");
    expect(porta?.metadata?.doorPositionKind).toBe("esq");
  });

  it("porta dupla — port_dir e port_esq na cutlist", () => {
    const left = baseDoor({ id: "d-esq", hingeSide: "left" });
    const right = baseDoor({
      id: "d-dir",
      hingeSide: "right",
      openDirection: "right",
      pivot: "right-edge",
      posX: 297,
    });
    const box = {
      ...baseBox([left, right]),
      portaTipo: "porta_dupla" as const,
    };
    const list = cutlistComPrecoFromBox(box, defaultRulesConfig);
    const portas = list.filter((item) => item.tipo === "porta_dupla");
    expect(portas).toHaveLength(2);
    expect(portas.map((p) => p.nome).sort()).toEqual(["port_dir", "port_esq"]);
  });
});
