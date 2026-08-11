import { describe, expect, it, beforeEach } from "vitest";
import { divSepRulesStore } from "../../admin/rules/divSepRules/rulesStore";
import { defaultRulesConfig } from "../rules/rulesConfig";
import {
  applyShelfDirecaoToBox,
  migrateShelfOnSeparadorAncoraChange,
  resolveAvailableShelfDirecoes,
  resolveShelfDirecao,
} from "./shelfOptions";
import {
  boxUsesDivShelfMode,
  buildDivShelfDrilling,
  buildSegmentedShelfGridYs,
  resolveSepOnlyShelfPlacementZone,
  resolveShelfGridYs,
  resolveShelfPlacementPlans,
  resolveShelfWidthForPlan,
  resolveShelfWidthForSepOnly,
} from "./shelfDrilling";
import { defaultDivisorItem, defaultSeparadorItem, makeDivSepTestBox, roundMm } from "./divSepTestHelpers";

const SHELF_RULES = {
  ...defaultRulesConfig,
  furos: {
    ...defaultRulesConfig.furos,
    tecnicos: {
      ...defaultRulesConfig.furos.tecnicos,
      prateleira: {
        ...defaultRulesConfig.furos.tecnicos.prateleira,
        margemTopo: 80,
        margemBase: 80,
        minFurosPorColuna: 4,
      },
    },
  },
};

function uniqueLateralYs(holes: { y: number }[], espessura: number): number[] {
  return [...new Set(holes.map((h) => roundMm(h.y + espessura)))].sort((a, b) => a - b);
}

function stepsOf(ys: number[]): number[] {
  return ys.slice(1).map((y, i) => roundMm(y - ys[i]!));
}

describe("expansão prateleiras DIV/SEP — opções avançadas", () => {
  beforeEach(() => {
    divSepRulesStore.patch({ enableShelfHoles: true });
  });

  describe("direcções disponíveis na UI", () => {
    it("DIV + SEP → Direita, Esquerda, Superior, Inferior", () => {
      const box = makeDivSepTestBox({
        divisores: [defaultDivisorItem()],
        separadores: [defaultSeparadorItem()],
      });
      expect(resolveAvailableShelfDirecoes(box)).toEqual([
        "direita",
        "esquerda",
        "superior",
        "inferior",
      ]);
    });

    it("apenas DIV → Direita, Esquerda", () => {
      const box = makeDivSepTestBox({
        divisores: [defaultDivisorItem()],
        separadores: [],
      });
      expect(resolveAvailableShelfDirecoes(box)).toEqual(["direita", "esquerda"]);
    });

    it("apenas SEP → Superior, Inferior", () => {
      const box = makeDivSepTestBox({
        divisores: [],
        separadores: [defaultSeparadorItem()],
      });
      expect(resolveAvailableShelfDirecoes(box)).toEqual(["superior", "inferior"]);
    });

    it("sem DIV nem SEP → lista vazia (campo oculto)", () => {
      const box = makeDivSepTestBox({ divisores: [], separadores: [] });
      expect(resolveAvailableShelfDirecoes(box)).toEqual([]);
    });
  });

  describe("grelha contínua 32 / 64 mm", () => {
    const boxBase = makeDivSepTestBox({
      dimensoes: { largura: 600, altura: 900, profundidade: 560 },
      prateleiras: 2,
      separadores: [defaultSeparadorItem({ id: "sep-1", positionMm: 400 })],
      divisores: [
        defaultDivisorItem({
          id: "div-1",
          positionMm: 281,
          prateleiraLado: "direita",
          linkedSeparadorId: "sep-1",
        }),
      ],
      panelIds: { divisores: ["pid-div-1"] },
    });

    it("passo 32 mm (padrão)", () => {
      const result = buildDivShelfDrilling(boxBase, boxBase.panelIds, SHELF_RULES)!;
      const ys = uniqueLateralYs(result.lateral_direita, boxBase.espessura);
      expect(ys.length).toBeGreaterThan(2);
      expect(new Set(stepsOf(ys))).toEqual(new Set([32]));
    });

    it("passo 64 mm (dobro)", () => {
      const box64 = {
        ...boxBase,
        shelfOptions: { distanciaEntreFurosMm: 64 as const },
      };
      const result = buildDivShelfDrilling(box64, box64.panelIds, SHELF_RULES)!;
      const ys = uniqueLateralYs(result.lateral_direita, box64.espessura);
      expect(ys.length).toBeGreaterThan(1);
      expect(new Set(stepsOf(ys))).toEqual(new Set([64]));
    });
  });

  describe("grelha segmentada", () => {
    it("cria blocos de 4–8 furos com gaps", () => {
      const continuous = Array.from({ length: 40 }, (_, i) => 100 + i * 32);
      const segmented = buildSegmentedShelfGridYs(continuous, 32, 1200);
      expect(segmented.length).toBeGreaterThan(0);
      expect(segmented.length).toBeLessThan(continuous.length);

      // Detecta pelo menos um gap > passo dentro da sequência filtrada vs contínua.
      const set = new Set(segmented);
      let gapFound = false;
      for (let i = 1; i < continuous.length; i++) {
        const prev = continuous[i - 1]!;
        const cur = continuous[i]!;
        if (set.has(prev) && !set.has(cur)) {
          gapFound = true;
          break;
        }
      }
      expect(gapFound).toBe(true);
    });

    it("aplica modo segmentado na furação DIV+SEP", () => {
      const box = makeDivSepTestBox({
        dimensoes: { largura: 600, altura: 1200, profundidade: 560 },
        prateleiras: 2,
        shelfOptions: { gridMode: "segmentada", distanciaEntreFurosMm: 32 },
        separadores: [defaultSeparadorItem({ id: "sep-s", positionMm: 500 })],
        divisores: [
          defaultDivisorItem({
            id: "div-s",
            positionMm: 281,
            prateleiraLado: "direita",
            linkedSeparadorId: "sep-s",
          }),
        ],
        panelIds: { divisores: ["pid-div-s"] },
      });
      const continuousYs = resolveShelfGridYs(19, 500, SHELF_RULES, {
        stepMm: 32,
        gridMode: "continua",
      });
      const result = buildDivShelfDrilling(box, box.panelIds, SHELF_RULES)!;
      const ys = uniqueLateralYs(result.lateral_direita, box.espessura);
      expect(ys.length).toBeGreaterThan(0);
      expect(ys.length).toBeLessThanOrEqual(continuousYs.length);
    });
  });

  describe("margem superior/inferior", () => {
    it("margem 0 usa grelha padrão das regras", () => {
      const ys0 = resolveShelfGridYs(19, 700, SHELF_RULES, {
        stepMm: 32,
        margemSuperiorInferiorMm: 0,
      });
      const ysDefault = resolveShelfGridYs(19, 700, SHELF_RULES);
      expect(ys0).toEqual(ysDefault);
    });

    it("margem > 0 centra a grelha com inset igual", () => {
      const ys = resolveShelfGridYs(0, 1000, SHELF_RULES, {
        stepMm: 32,
        margemSuperiorInferiorMm: 20,
      });
      expect(ys[0]).toBeGreaterThanOrEqual(20);
      expect(ys[ys.length - 1]!).toBeLessThanOrEqual(980);
    });
  });

  describe("migração Direita ↔ Esquerda", () => {
    it("ao mudar direcção, furação migra de LAT sem mover DIV/SEP", () => {
      const base = makeDivSepTestBox({
        dimensoes: { largura: 600, altura: 900, profundidade: 560 },
        prateleiras: 2,
        separadores: [
          defaultSeparadorItem({
            id: "sep-m",
            positionMm: 400,
            ancoraHorizontal: "direita",
          }),
        ],
        divisores: [
          defaultDivisorItem({
            id: "div-m",
            positionMm: 281,
            prateleiraLado: "direita",
            linkedSeparadorId: "sep-m",
            posicaoRelativaAoSep: "baixo",
          }),
        ],
        panelIds: { divisores: ["pid-div-m"] },
      });

      const right = buildDivShelfDrilling(base, base.panelIds, SHELF_RULES)!;
      expect(right.lateral_direita.length).toBeGreaterThan(0);
      expect(right.lateral_esquerda.length).toBe(0);

      const applied = applyShelfDirecaoToBox(base, "esquerda");
      expect(applied.divisores[0]?.posicaoRelativaAoSep).toBe("baixo");
      expect(applied.divisores[0]?.linkedSeparadorId).toBe("sep-m");
      expect(applied.separadores[0]?.ancoraHorizontal).toBe("direita");

      const leftBox = {
        ...base,
        shelfOptions: applied.shelfOptions,
        divisores: applied.divisores,
        separadores: applied.separadores,
      };
      const left = buildDivShelfDrilling(leftBox, leftBox.panelIds, SHELF_RULES)!;
      expect(left.lateral_esquerda.length).toBeGreaterThan(0);
      expect(left.lateral_direita.length).toBe(0);
      expect(resolveShelfDirecao(leftBox)).toBe("esquerda");
    });

    it("ao mudar âncora SEP, prateleiras não herdam a direcção estrutural", () => {
      const box = makeDivSepTestBox({
        prateleiras: 2,
        shelfOptions: { direcao: "direita" },
        separadores: [
          defaultSeparadorItem({
            id: "sep-a",
            positionMm: 400,
            ancoraHorizontal: "direita",
          }),
        ],
        divisores: [
          defaultDivisorItem({
            id: "div-a",
            positionMm: 281,
            prateleiraLado: "direita",
            prateleiraYsMm: [200, 300],
          }),
        ],
      });
      const migrated = migrateShelfOnSeparadorAncoraChange(box, "sep-a", "esquerda");
      expect(migrated.shelfOptions.direcao).toBe("direita");
      expect(migrated.divisores[0]?.prateleiraLado).toBe("direita");
      expect(migrated.divisores[0]?.prateleiraYsMm).toBeUndefined();
    });
  });

  describe("migração Superior ↔ Inferior (sem mover DIV)", () => {
    it("direcção superior NÃO move o DIV para cima do SEP", () => {
      const box = makeDivSepTestBox({
        dimensoes: { largura: 600, altura: 1200, profundidade: 560 },
        prateleiras: 2,
        separadores: [defaultSeparadorItem({ id: "sep-v", positionMm: 500 })],
        divisores: [
          defaultDivisorItem({
            id: "div-v",
            positionMm: 281,
            linkedSeparadorId: "sep-v",
            posicaoRelativaAoSep: "baixo",
          }),
        ],
      });
      const beforePos = box.divisores![0]!.posicaoRelativaAoSep;
      const applied = applyShelfDirecaoToBox(box, "superior");
      expect(applied.divisores[0]?.posicaoRelativaAoSep).toBe(beforePos);
      expect(applied.divisores[0]?.linkedSeparadorId).toBe("sep-v");
      expect(applied.shelfOptions.direcao).toBe("superior");
    });

    it("superior com DIV abaixo do SEP → prateleiras completas (vão interno)", () => {
      const box = makeDivSepTestBox({
        dimensoes: { largura: 600, altura: 1200, profundidade: 560 },
        prateleiras: 2,
        shelfOptions: { direcao: "superior" },
        separadores: [
          defaultSeparadorItem({
            id: "sep-full",
            positionMm: 500,
            linkedSeparadorId: undefined,
          }),
        ],
        divisores: [
          defaultDivisorItem({
            id: "div-below",
            positionMm: 281,
            linkedSeparadorId: "sep-full",
            posicaoRelativaAoSep: "baixo",
          }),
        ],
        panelIds: { divisores: ["pid-div-below"] },
      });
      // Force linked correctly
      box.divisores![0]!.linkedSeparadorId = "sep-full";

      const plans = resolveShelfPlacementPlans(box);
      expect(plans.length).toBe(1);
      expect(plans[0]!.mode).toBe("full");
      const width = resolveShelfWidthForPlan(box, plans[0]!);
      expect(width).toBeGreaterThan(500);

      const result = buildDivShelfDrilling(box, box.panelIds, SHELF_RULES)!;
      expect(result.lateral_esquerda.length).toBeGreaterThan(0);
      expect(result.lateral_direita.length).toBeGreaterThan(0);
      expect(result.divisorio.size).toBe(0);
    });

    it("direcção inferior mantém DIV abaixo e prateleiras curtas", () => {
      const box = makeDivSepTestBox({
        dimensoes: { largura: 600, altura: 1200, profundidade: 560 },
        prateleiras: 2,
        shelfOptions: { direcao: "inferior" },
        separadores: [defaultSeparadorItem({ id: "sep-i", positionMm: 500 })],
        divisores: [
          defaultDivisorItem({
            id: "div-i",
            positionMm: 281,
            linkedSeparadorId: "sep-i",
            posicaoRelativaAoSep: "baixo",
            prateleiraLado: "direita",
          }),
        ],
        panelIds: { divisores: ["pid-div-i"] },
      });
      const applied = applyShelfDirecaoToBox(box, "inferior");
      expect(applied.divisores[0]?.posicaoRelativaAoSep).toBe("baixo");
      expect(applied.shelfOptions.direcao).toBe("inferior");

      const plans = resolveShelfPlacementPlans({
        ...box,
        shelfOptions: applied.shelfOptions,
      });
      expect(plans.some((p) => p.mode === "short")).toBe(true);
    });
  });

  describe("apenas SEP", () => {
    it("activa modo prateleira sem DIV", () => {
      const box = makeDivSepTestBox({
        dimensoes: { largura: 600, altura: 900, profundidade: 560 },
        prateleiras: 2,
        shelfOptions: { direcao: "inferior" },
        separadores: [defaultSeparadorItem({ id: "sep-only", positionMm: 400 })],
        divisores: [],
      });
      expect(boxUsesDivShelfMode(box)).toBe(true);
      expect(resolveSepOnlyShelfPlacementZone(box)).not.toBeNull();
      expect(resolveShelfWidthForSepOnly(box)).toBeGreaterThan(100);

      const result = buildDivShelfDrilling(box, box.panelIds, SHELF_RULES)!;
      expect(result.lateral_esquerda.length).toBeGreaterThan(0);
      expect(result.lateral_direita.length).toBeGreaterThan(0);
      expect(result.divisorio.size).toBe(0);
    });

    it("superior fura zona acima do SEP", () => {
      const box = makeDivSepTestBox({
        dimensoes: { largura: 600, altura: 900, profundidade: 560 },
        prateleiras: 2,
        shelfOptions: { direcao: "superior" },
        separadores: [defaultSeparadorItem({ id: "sep-top", positionMm: 400 })],
        divisores: [],
      });
      const zone = resolveSepOnlyShelfPlacementZone(box)!;
      const result = buildDivShelfDrilling(box, box.panelIds, SHELF_RULES)!;
      const ys = uniqueLateralYs(result.lateral_esquerda, box.espessura);
      expect(ys.every((y) => y >= zone.yMin - 0.5 && y <= zone.yMax + 0.5)).toBe(true);
      expect(zone.yMin).toBeGreaterThan(100);
    });
  });

  describe("apenas DIV", () => {
    it("fura LAT+DIV sem SEP", () => {
      const box = makeDivSepTestBox({
        dimensoes: { largura: 600, altura: 900, profundidade: 560 },
        prateleiras: 2,
        shelfOptions: { direcao: "esquerda" },
        separadores: [],
        divisores: [
          defaultDivisorItem({
            id: "div-only",
            positionMm: 281,
            prateleiraLado: "esquerda",
            alturaMm: 800,
          }),
        ],
        panelIds: { divisores: ["pid-div-only"] },
      });
      const result = buildDivShelfDrilling(box, box.panelIds, SHELF_RULES)!;
      expect(result.lateral_esquerda.length).toBeGreaterThan(0);
      expect(result.lateral_direita.length).toBe(0);
      expect(result.divisorio.get("pid-div-only")?.length).toBeGreaterThan(0);
    });
  });
});
