import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { divSepRulesStore } from "../../admin/rules/divSepRules/rulesStore";
import { DIV_SEP_RULES_DEFAULTS } from "../../admin/rules/divSepRules/rulesDefaults";
import { defaultRulesConfig } from "../rules/rulesConfig";
import { getDivSepInternalDims, resolveDivisorDimensions } from "./dimensions";
import { resolveSeparadorBottomY } from "./coupling";
import {
  boxUsesDivShelfMode,
  buildDivShelfDrilling,
  countDivShelfPanels,
  MIN_ABOVE_SEP_SHELF_HEIGHT_MM,
  resolveDivShelfAbsoluteCenterYs,
  resolveDivShelfGridYs,
  resolveDivShelfPlacementZones,
  resolvePrimaryDivShelfPlacementZone,
  resolveShelfWidthForDivSide,
  resolveVerticalCompartments,
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

function toAbsoluteLateralYs(espessura: number, ys: number[]): number[] {
  // LAT industrial: Y desde a base do painel inset → absoluto = y + espessura.
  return ys.map((y) => roundMm(y + espessura)).sort((a, b) => a - b);
}

function toAbsoluteDivYs(divBottomY: number, ys: number[]): number[] {
  // DIV industrial: Y desde a base do painel → absoluto = y + divBottomY.
  return ys.map((y) => roundMm(y + divBottomY)).sort((a, b) => a - b);
}

describe("buildDivShelfDrilling — prateleiras com DIV", () => {
  beforeEach(() => {
    divSepRulesStore.patch({ enableShelfHoles: true });
  });

  const sep = defaultSeparadorItem({ id: "sep-shelf", positionMm: 400 });
  const div = defaultDivisorItem({
    id: "div-shelf",
    positionMm: 281,
    prateleiraLado: "direita",
  });
  const box = makeDivSepTestBox({
    dimensoes: { largura: 600, altura: 900, profundidade: 560 },
    prateleiras: 2,
    separadores: [sep],
    divisores: [div],
    panelIds: {
      divisores: ["pid-div-shelf"],
    },
  });

  it("activa modo prateleira com DIV", () => {
    expect(boxUsesDivShelfMode(box)).toBe(true);
  });

  it("cria compartimentos verticais delimitados pelos SEP", () => {
    const zones = resolveVerticalCompartments(box);
    expect(zones.length).toBeGreaterThanOrEqual(1);
    expect(zones.some((zone) => zone.shelfEnabled)).toBe(true);
    expect(zones.some((zone) => !zone.shelfEnabled)).toBe(true);
  });

  it("fura apenas a lateral escolhida e o DIV", () => {
    const result = buildDivShelfDrilling(box, box.panelIds, SHELF_RULES);
    expect(result).not.toBeNull();
    expect(result!.lateral_esquerda.length).toBe(0);
    expect(result!.lateral_direita.length).toBeGreaterThan(0);
    expect(result!.divisorio.get("pid-div-shelf")?.length).toBeGreaterThan(0);
  });

  it("alinha Y dos furos entre lateral e DIV", () => {
    const result = buildDivShelfDrilling(box, box.panelIds, SHELF_RULES)!;
    const divBottomY = getDivSepInternalDims(box).espessura;
    const lateralYs = [
      ...new Set(toAbsoluteLateralYs(box.espessura, result.lateral_direita.map((h) => roundMm(h.y)))),
    ];
    const divYs = [
      ...new Set(toAbsoluteDivYs(divBottomY, (result.divisorio.get("pid-div-shelf") ?? []).map((h) => roundMm(h.y)))),
    ];
    expect(divYs).toEqual(lateralYs);
  });

  it("LAT e DIV têm exactamente os mesmos Y locais (1:1 na chapa)", () => {
    const result = buildDivShelfDrilling(box, box.panelIds, SHELF_RULES)!;
    const latLocal = [...new Set(result.lateral_direita.map((h) => roundMm(h.y)))].sort((a, b) => a - b);
    const divLocal = [
      ...new Set((result.divisorio.get("pid-div-shelf") ?? []).map((h) => roundMm(h.y))),
    ].sort((a, b) => a - b);
    expect(latLocal.length).toBeGreaterThan(0);
    expect(divLocal).toEqual(latLocal);
    expect(divLocal[0]).toBe(latLocal[0]);
    expect(divLocal[divLocal.length - 1]).toBe(latLocal[latLocal.length - 1]);
  });

  it("usa passo industrial exacto de 32 mm por compartimento", () => {
    const result = buildDivShelfDrilling(box, box.panelIds, SHELF_RULES)!;
    const cfg = SHELF_RULES.furos.tecnicos.prateleira;
    const absoluteYs = [...new Set(toAbsoluteLateralYs(box.espessura, result.lateral_direita.map((h) => roundMm(h.y))))];
    for (const zone of resolveVerticalCompartments(box).filter((z) => z.shelfEnabled)) {
      const minY = roundMm(zone.yMin + (cfg.margemBase ?? 0));
      const maxY = roundMm(zone.yMax - (cfg.margemTopo ?? 0));
      const zoneYs = absoluteYs.filter((y) => y >= minY && y <= maxY);
      const steps = zoneYs.slice(1).map((y, index) => roundMm(y - zoneYs[index]!));
      expect(new Set(steps)).toEqual(new Set([32]));
    }
  });

  it("deduplica furos laterais com múltiplos DIV no mesmo lado", () => {
    const multiDivBox = makeDivSepTestBox({
      dimensoes: { largura: 900, altura: 900, profundidade: 560 },
      prateleiras: 2,
      separadores: [sep],
      divisores: [
        defaultDivisorItem({ id: "div-a", positionMm: 200, prateleiraLado: "direita" }),
        defaultDivisorItem({ id: "div-b", positionMm: 500, prateleiraLado: "direita" }),
      ],
    });
    const result = buildDivShelfDrilling(multiDivBox, multiDivBox.panelIds, SHELF_RULES)!;
    const signatures = new Set(
      result.lateral_direita.map((h) => [roundMm(h.x), roundMm(h.y), roundMm(h.diameter), roundMm(h.depth)].join("|"))
    );
    expect(signatures.size).toBe(result.lateral_direita.length);
  });

  it("respeita compartimentos com SEP sem furos fora da grelha util", () => {
    const result = buildDivShelfDrilling(box, box.panelIds, SHELF_RULES)!;
    const zones = resolveVerticalCompartments(box).filter((zone) => zone.shelfEnabled);
    const absoluteYs = [
      ...new Set(toAbsoluteLateralYs(box.espessura, result.lateral_direita.map((h) => roundMm(h.y)))),
    ];
    const cfg = SHELF_RULES.furos.tecnicos.prateleira;
    for (const y of absoluteYs) {
      const inSomeZone = zones.some((zone) => {
        const minY = roundMm(zone.yMin + (cfg.margemBase ?? 0));
        const maxY = roundMm(zone.yMax - (cfg.margemTopo ?? 0));
        return y >= minY && y <= maxY;
      });
      expect(inSomeZone).toBe(true);
    }
  });

  it("calcula largura da prateleira sem atravessar o DIV", () => {
    const width = resolveShelfWidthForDivSide(box, div);
    expect(width).toBeGreaterThan(0);
    expect(width).toBeLessThan(box.dimensoes.largura - box.espessura * 2);
  });

  it("com DIV+SEP, nenhum furo de prateleira acima do SEP", () => {
    const linkedDiv = defaultDivisorItem({
      id: "div-linked-shelf",
      positionMm: 281,
      linkedSeparadorId: "sep-shelf",
      prateleiraLado: "direita",
    });
    const linkedBox = makeDivSepTestBox({
      dimensoes: { largura: 600, altura: 900, profundidade: 560 },
      prateleiras: 2,
      separadores: [sep],
      divisores: [linkedDiv],
      panelIds: { divisores: ["pid-div-linked-shelf"] },
    });
    const result = buildDivShelfDrilling(linkedBox, linkedBox.panelIds, SHELF_RULES);
    expect(result).not.toBeNull();

    const sepBottomY = roundMm(resolveSeparadorBottomY(linkedBox, sep));
    const cfg = SHELF_RULES.furos.tecnicos.prateleira;
    const margemBase = cfg.margemBase ?? 0;
    const forbiddenMinY = roundMm(sepBottomY + margemBase);
    const disabledZones = resolveVerticalCompartments(linkedBox).filter((zone) => !zone.shelfEnabled);

    const absoluteYs = [
      ...new Set(
        toAbsoluteLateralYs(
          linkedBox.espessura,
          result!.lateral_direita.map((h) => roundMm(h.y))
        )
      ),
    ];

    expect(absoluteYs.length).toBeGreaterThan(0);
    expect(absoluteYs.every((y) => y < forbiddenMinY)).toBe(true);
    for (const y of absoluteYs) {
      const inDisabledZone = disabledZones.some((zone) => {
        const minY = roundMm(zone.yMin + margemBase);
        const maxY = roundMm(zone.yMax - (cfg.margemTopo ?? 0));
        return y >= minY && y <= maxY;
      });
      expect(inDisabledZone).toBe(false);
    }
  });

  it("com prateleiras, o DIV recebe furos no lado correspondente", () => {
    const right = buildDivShelfDrilling(box, box.panelIds, SHELF_RULES)!;
    const rightHoles = right.divisorio.get("pid-div-shelf") ?? [];
    expect(rightHoles.length).toBeGreaterThan(0);
    expect(rightHoles.every((h) => h.face === "A")).toBe(true);

    const leftDiv = defaultDivisorItem({
      id: "div-left-shelf",
      positionMm: 281,
      prateleiraLado: "esquerda",
    });
    const leftBox = makeDivSepTestBox({
      dimensoes: { largura: 600, altura: 900, profundidade: 560 },
      prateleiras: 2,
      separadores: [sep],
      divisores: [leftDiv],
      panelIds: { divisores: ["pid-div-left-shelf"] },
    });
    const left = buildDivShelfDrilling(leftBox, leftBox.panelIds, SHELF_RULES)!;
    expect(left.lateral_direita.length).toBe(0);
    expect(left.lateral_esquerda.length).toBeGreaterThan(0);
    const leftHoles = left.divisorio.get("pid-div-left-shelf") ?? [];
    expect(leftHoles.length).toBeGreaterThan(0);
    expect(leftHoles.every((h) => h.face === "B")).toBe(true);
  });

  it("DIV e lateral têm grelha idêntica", () => {
    const result = buildDivShelfDrilling(box, box.panelIds, SHELF_RULES)!;
    const divBottomY = getDivSepInternalDims(box).espessura;
    const lateralYs = [
      ...new Set(toAbsoluteLateralYs(box.espessura, result.lateral_direita.map((h) => roundMm(h.y)))),
    ];
    const divYs = [
      ...new Set(toAbsoluteDivYs(divBottomY, (result.divisorio.get("pid-div-shelf") ?? []).map((h) => roundMm(h.y)))),
    ];
    expect(divYs.length).toBeGreaterThan(0);
    expect(divYs).toEqual(lateralYs);
  });

  it("nenhum furo no DIV acima do SEP", () => {
    const linkedDiv = defaultDivisorItem({
      id: "div-no-above",
      positionMm: 281,
      linkedSeparadorId: "sep-shelf",
      prateleiraLado: "direita",
    });
    const linkedBox = makeDivSepTestBox({
      dimensoes: { largura: 600, altura: 900, profundidade: 560 },
      prateleiras: 2,
      separadores: [sep],
      divisores: [linkedDiv],
      panelIds: { divisores: ["pid-div-no-above"] },
    });
    const result = buildDivShelfDrilling(linkedBox, linkedBox.panelIds, SHELF_RULES)!;
    const divBottomY = getDivSepInternalDims(linkedBox).espessura;
    const sepBottomY = roundMm(resolveSeparadorBottomY(linkedBox, sep));
    const divYs = [
      ...new Set(
        toAbsoluteDivYs(divBottomY, (result.divisorio.get("pid-div-no-above") ?? []).map((h) => roundMm(h.y)))
      ),
    ];
    expect(divYs.length).toBeGreaterThan(0);
    expect(divYs.every((y) => y < sepBottomY)).toBe(true);
  });

  it("usa panelId industrial divisorio-N quando panelIds.divisores está vazio", () => {
    const bare = makeDivSepTestBox({
      dimensoes: { largura: 600, altura: 900, profundidade: 560 },
      prateleiras: 2,
      separadores: [sep],
      divisores: [defaultDivisorItem({ id: "uuid-only", prateleiraLado: "direita" })],
    });
    bare.panelIds = { ...bare.panelIds!, divisores: [] };
    const result = buildDivShelfDrilling(bare, bare.panelIds, SHELF_RULES)!;
    expect(result.divisorio.get("divisorio-1")?.length ?? 0).toBeGreaterThan(0);
    expect(result.divisorio.get("uuid-only")?.length ?? 0).toBeGreaterThan(0);
  });

  it(`desactiva zona acima do SEP sem DIV acima (mesmo se altura < ${MIN_ABOVE_SEP_SHELF_HEIGHT_MM} mm)`, () => {
    const zones = resolveVerticalCompartments(box);
    const topZone = zones[zones.length - 1]!;
    expect(topZone.yMax - topZone.yMin).toBeLessThan(MIN_ABOVE_SEP_SHELF_HEIGHT_MM);
    expect(topZone.shelfEnabled).toBe(false);
  });

  it("activa zona acima do SEP quando existe DIV ligado acima", () => {
    const sepLow = defaultSeparadorItem({ id: "sep-low", positionMm: 400 });
    const divAbove = defaultDivisorItem({
      id: "div-above-shelf",
      linkedSeparadorId: "sep-low",
      posicaoRelativaAoSep: "cima",
      positionMm: 281,
      prateleiraLado: "direita",
    });
    const tallBox = makeDivSepTestBox({
      dimensoes: { largura: 600, altura: 2000, profundidade: 560 },
      prateleiras: 2,
      separadores: [sepLow],
      divisores: [divAbove],
      panelIds: { divisores: ["pid-div-above"] },
    });
    const zones = resolveVerticalCompartments(tallBox);
    const topZone = zones[zones.length - 1]!;
    expect(topZone.shelfEnabled).toBe(true);

    const placement = resolveDivShelfPlacementZones(tallBox, divAbove);
    expect(placement.length).toBeGreaterThan(0);
    expect(placement.some((z) => z.yMin >= topZone.yMin - 0.5)).toBe(true);

    const result = buildDivShelfDrilling(tallBox, tallBox.panelIds, SHELF_RULES);
    expect(result).not.toBeNull();
    const sepBottomY = roundMm(resolveSeparadorBottomY(tallBox, sepLow));
    const absYs = toAbsoluteLateralYs(
      tallBox.espessura,
      result!.lateral_direita.map((h) => roundMm(h.y))
    );
    expect(absYs.some((y) => y > sepBottomY)).toBe(true);
  });

  it("prateleiraYsMm escolhe posições exactas na grelha", () => {
    const linkedDiv = defaultDivisorItem({
      id: "div-exact",
      positionMm: 281,
      linkedSeparadorId: "sep-shelf",
      prateleiraLado: "direita",
    });
    const linkedBox = makeDivSepTestBox({
      dimensoes: { largura: 600, altura: 900, profundidade: 560 },
      prateleiras: 2,
      separadores: [sep],
      divisores: [linkedDiv],
    });
    const grid = resolveDivShelfGridYs(linkedBox, linkedDiv, SHELF_RULES);
    expect(grid.length).toBeGreaterThanOrEqual(2);
    const chosen = [grid[0]!, grid[2] ?? grid[1]!];
    const withExact = {
      ...linkedDiv,
      prateleiraYsMm: chosen,
    };
    const ys = resolveDivShelfAbsoluteCenterYs(linkedBox, withExact, 2, SHELF_RULES);
    expect(ys).toEqual(chosen.slice(0, 2));
  });

  it("com N prateleiras e DIV+SEP, countDivShelfPanels = N (sem duplicar acima do SEP)", () => {
    const linkedDiv = defaultDivisorItem({
      id: "div-count",
      positionMm: 281,
      linkedSeparadorId: "sep-shelf",
      prateleiraLado: "direita",
    });
    const linkedBox = makeDivSepTestBox({
      dimensoes: { largura: 600, altura: 900, profundidade: 560 },
      prateleiras: 2,
      separadores: [sep],
      divisores: [linkedDiv],
    });
    expect(resolveVerticalCompartments(linkedBox).length).toBeGreaterThanOrEqual(2);
    expect(resolveDivShelfPlacementZones(linkedBox, linkedDiv).length).toBeGreaterThanOrEqual(1);
    expect(countDivShelfPanels(linkedBox)).toBe(2);
  });

  it("placement zones nunca incluem a zona acima do SEP", () => {
    const linkedDiv = defaultDivisorItem({
      id: "div-no-above-zone",
      linkedSeparadorId: "sep-shelf",
      prateleiraLado: "direita",
    });
    const linkedBox = makeDivSepTestBox({
      dimensoes: { largura: 600, altura: 900, profundidade: 560 },
      prateleiras: 3,
      separadores: [sep],
      divisores: [linkedDiv],
    });
    const sepBottom = resolveSeparadorBottomY(linkedBox, sep);
    const zones = resolveDivShelfPlacementZones(linkedBox, linkedDiv);
    expect(zones.length).toBeGreaterThan(0);
    expect(zones.every((z) => z.yMax <= sepBottom + 0.5)).toBe(true);
    expect(zones.every((z) => z.shelfEnabled)).toBe(true);
    expect(countDivShelfPanels(linkedBox)).toBe(3);
  });

  it("Y absolutos das N prateleiras ficam todos abaixo do SEP (zero acima)", () => {
    const linkedDiv = defaultDivisorItem({
      id: "div-abs-ys",
      linkedSeparadorId: "sep-shelf",
      prateleiraLado: "direita",
    });
    const linkedBox = makeDivSepTestBox({
      dimensoes: { largura: 600, altura: 900, profundidade: 560 },
      prateleiras: 2,
      separadores: [sep],
      divisores: [linkedDiv],
    });
    const sepBottom = resolveSeparadorBottomY(linkedBox, sep);
    const allZones = resolveVerticalCompartments(linkedBox);
    // Bug antigo: N × todas as zonas (incluindo acima do SEP) → 4 peças.
    expect(allZones.length * 2).toBeGreaterThan(2);

    const ys = resolveDivShelfAbsoluteCenterYs(linkedBox, linkedDiv, 2);
    expect(ys).toHaveLength(2);
    expect(ys.every((y) => y < sepBottom)).toBe(true);
    expect(resolvePrimaryDivShelfPlacementZone(linkedBox, linkedDiv)?.yMax).toBeLessThanOrEqual(
      sepBottom + 0.5
    );
  });

  it("DIV não ligado: Ys industriais também nunca acima do SEP", () => {
    const unlinkedDiv = defaultDivisorItem({
      id: "div-unlinked-ys",
      prateleiraLado: "direita",
    });
    const unlinkedBox = makeDivSepTestBox({
      dimensoes: { largura: 600, altura: 900, profundidade: 560 },
      prateleiras: 2,
      separadores: [sep],
      divisores: [unlinkedDiv],
    });
    const sepBottom = resolveSeparadorBottomY(unlinkedBox, sep);
    const ys = resolveDivShelfAbsoluteCenterYs(unlinkedBox, unlinkedDiv, 2);
    expect(ys).toHaveLength(2);
    expect(ys.every((y) => y < sepBottom)).toBe(true);
    expect(countDivShelfPanels(unlinkedBox)).toBe(2);
  });

  it("Y industrial da LAT fica abaixo do SEP e não o sobrepõe", () => {
    const linkedDiv = defaultDivisorItem({
      id: "div-y-lat",
      positionMm: 281,
      linkedSeparadorId: "sep-shelf",
      prateleiraLado: "direita",
    });
    const linkedBox = makeDivSepTestBox({
      dimensoes: { largura: 600, altura: 900, profundidade: 560 },
      prateleiras: 2,
      separadores: [sep],
      divisores: [linkedDiv],
      panelIds: { divisores: ["pid-div-y-lat"] },
    });
    const result = buildDivShelfDrilling(linkedBox, linkedBox.panelIds, SHELF_RULES)!;
    // SEP na LAT grava Y = centerY absoluto (convenção desde a base / valor absoluto).
    const sepYOnLat = roundMm(
      resolveSeparadorBottomY(linkedBox, sep) + linkedBox.espessura / 2
    );
    const latPanelYs = result.lateral_direita.map((h) => roundMm(h.y));
    expect(latPanelYs.length).toBeGreaterThan(0);
    expect(Math.max(...latPanelYs)).toBeLessThan(sepYOnLat);
  });
});

describe("buildDivShelfDrilling — flag enableShelfHoles", () => {
  afterEach(() => {
    divSepRulesStore.reset();
  });

  it("retorna null quando enableShelfHoles=false nas regras DIV/SEP", () => {
    divSepRulesStore.patch({ enableShelfHoles: false });
    const box = makeDivSepTestBox({
      prateleiras: 2,
      divisores: [defaultDivisorItem()],
    });
    expect(buildDivShelfDrilling(box, box.panelIds, SHELF_RULES)).toBeNull();
    divSepRulesStore.patch({ enableShelfHoles: DIV_SEP_RULES_DEFAULTS.enableShelfHoles });
  });

  it("retorna null quando furos de prateleira estão desactivados nas regras gerais", () => {
    const rules = {
      ...SHELF_RULES,
      furos: {
        ...SHELF_RULES.furos,
        tecnicos: {
          ...SHELF_RULES.furos.tecnicos,
          prateleira: {
            ...SHELF_RULES.furos.tecnicos.prateleira,
            enabled: false,
          },
        },
      },
    };
    const box = makeDivSepTestBox({
      prateleiras: 2,
      divisores: [defaultDivisorItem()],
    });
    expect(buildDivShelfDrilling(box, box.panelIds, rules)).toBeNull();
  });
});
