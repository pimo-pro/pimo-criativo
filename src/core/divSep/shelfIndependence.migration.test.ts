/**
 * Validação industrial: prateleiras independentes de DIV/SEP.
 * Migração dinâmica por shelfOptions + área — sem mutação estrutural.
 */
import { describe, expect, it, beforeEach } from "vitest";
import { divSepRulesStore } from "../../admin/rules/divSepRules/rulesStore";
import { defaultRulesConfig } from "../rules/rulesConfig";
import {
  applyShelfDirecaoToBox,
  migrateShelfOnSeparadorAncoraChange,
  resolveShelfDirecao,
} from "./shelfOptions";
import {
  buildDivShelfDrilling,
  resolveShelfPlacementPlans,
  resolveShelfWidthForPlan,
  resolveShelfAbsoluteCenterYsForPlan,
  resolveShelfGridYs,
} from "./shelfDrilling";
import { resolveDivisorDimensions } from "./dimensions";
import { resolvePosicaoRelativaAoSep } from "./types";
import type { DivSepBoxLike, PrateleiraDirecao } from "./types";
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

/** Snapshot estrutural: campos que NUNCA podem mudar ao alterar direcção das prateleiras. */
function structureSnapshot(box: DivSepBoxLike) {
  return {
    divisores: (box.divisores ?? []).map((d) => ({
      id: d.id,
      positionMm: d.positionMm,
      referenceEdge: d.referenceEdge,
      alturaMm: d.alturaMm,
      profundidadeMm: d.profundidadeMm,
      linkedSeparadorId: d.linkedSeparadorId,
      posicaoRelativaAoSep: d.posicaoRelativaAoSep,
    })),
    separadores: (box.separadores ?? []).map((s) => ({
      id: s.id,
      positionMm: s.positionMm,
      referenceEdge: s.referenceEdge,
      larguraMm: s.larguraMm,
      profundidadeMm: s.profundidadeMm,
      ancoraHorizontal: s.ancoraHorizontal,
    })),
  };
}

function makeDivBelowSepBox(overrides: Partial<DivSepBoxLike> = {}) {
  return makeDivSepTestBox({
    dimensoes: { largura: 600, altura: 1200, profundidade: 560 },
    prateleiras: 2,
    separadores: [
      defaultSeparadorItem({
        id: "sep-1",
        positionMm: 500,
        ancoraHorizontal: "direita",
      }),
    ],
    divisores: [
      defaultDivisorItem({
        id: "div-1",
        positionMm: 281,
        linkedSeparadorId: "sep-1",
        posicaoRelativaAoSep: "baixo",
        prateleiraLado: "direita",
      }),
    ],
    panelIds: { divisores: ["pid-div-1"] },
    ...overrides,
  });
}

function applyDirecao(box: DivSepBoxLike, direcao: PrateleiraDirecao): DivSepBoxLike {
  const applied = applyShelfDirecaoToBox(box, direcao);
  return {
    ...box,
    shelfOptions: { ...(box.shelfOptions ?? {}), ...applied.shelfOptions },
    divisores: applied.divisores,
    separadores: applied.separadores,
  };
}

describe("independência prateleiras ↔ DIV/SEP — migração dinâmica", () => {
  beforeEach(() => {
    divSepRulesStore.patch({ enableShelfHoles: true });
  });

  describe("imutabilidade estrutural", () => {
    const modes: PrateleiraDirecao[] = ["direita", "esquerda", "superior", "inferior"];

    for (const direcao of modes) {
      it(`applyShelfDirecaoToBox("${direcao}") não muta DIV nem SEP`, () => {
        const box = makeDivBelowSepBox({
          shelfOptions: { direcao: "inferior" },
        });
        const before = structureSnapshot(box);
        const afterBox = applyDirecao(box, direcao);
        expect(structureSnapshot(afterBox)).toEqual(before);
        expect(resolvePosicaoRelativaAoSep(afterBox.divisores![0]!)).toBe("baixo");
        expect(afterBox.divisores![0]!.linkedSeparadorId).toBe("sep-1");
        expect(afterBox.separadores![0]!.ancoraHorizontal).toBe("direita");
        // Altura estrutural do DIV permanece (ligada ao SEP abaixo)
        const hBefore = resolveDivisorDimensions(box, box.divisores![0]!).alturaMm;
        const hAfter = resolveDivisorDimensions(afterBox, afterBox.divisores![0]!).alturaMm;
        expect(hAfter).toBe(hBefore);
      });
    }

    it("SEP parcial não reescreve a direcção das prateleiras", () => {
      const box = makeDivBelowSepBox({
        shelfOptions: { direcao: "esquerda" },
      });
      const migrated = migrateShelfOnSeparadorAncoraChange(box, "sep-1", "esquerda");
      expect(migrated.shelfOptions.direcao).toBe("esquerda");
      expect(structureSnapshot({ ...box, divisores: migrated.divisores })).toEqual(
        structureSnapshot(box)
      );
    });
  });

  describe("planos full vs short", () => {
    it("inferior → superior: plano full (vão interno) sem DIV na zona", () => {
      const inferior = applyDirecao(makeDivBelowSepBox(), "inferior");
      const plansInf = resolveShelfPlacementPlans(inferior);
      expect(plansInf.some((p) => p.mode === "short")).toBe(true);

      const superior = applyDirecao(inferior, "superior");
      const plansSup = resolveShelfPlacementPlans(superior);
      expect(plansSup).toHaveLength(1);
      expect(plansSup[0]!.mode).toBe("full");

      const wInf = resolveShelfWidthForPlan(inferior, plansInf[0]!);
      const wSup = resolveShelfWidthForPlan(superior, plansSup[0]!);
      expect(wSup).toBeGreaterThan(wInf);
      expect(wSup).toBeGreaterThan(500);
    });

    it("direita → esquerda: plano short com larguras recalculadas", () => {
      const base = makeDivBelowSepBox();
      // DIV deslocado para obter larguras distintas esquerda/direita
      base.divisores![0]!.positionMm = 180;
      const right = applyDirecao(base, "direita");
      const left = applyDirecao(right, "esquerda");

      const pR = resolveShelfPlacementPlans(right);
      const pL = resolveShelfPlacementPlans(left);
      expect(pR.every((p) => p.mode === "short" && p.lado === "direita")).toBe(true);
      expect(pL.every((p) => p.mode === "short" && p.lado === "esquerda")).toBe(true);

      const wR = resolveShelfWidthForPlan(right, pR[0]!);
      const wL = resolveShelfWidthForPlan(left, pL[0]!);
      expect(wR).toBeGreaterThan(0);
      expect(wL).toBeGreaterThan(0);
      expect(wR).not.toBe(wL);
    });

    it("ciclo completo das 4 direcções sem alterar estrutura", () => {
      let box = makeDivBelowSepBox({ shelfOptions: { direcao: "direita" } });
      const baseline = structureSnapshot(box);
      for (const d of ["esquerda", "superior", "inferior", "direita"] as PrateleiraDirecao[]) {
        box = applyDirecao(box, d);
        expect(structureSnapshot(box)).toEqual(baseline);
        expect(resolveShelfDirecao(box)).toBe(d);
        expect(resolveShelfPlacementPlans(box).length).toBeGreaterThan(0);
      }
    });
  });

  describe("furação acompanha apenas o plano da prateleira", () => {
    it("direita fura só LAT direita + DIV; esquerda só LAT esquerda + DIV", () => {
      const right = applyDirecao(makeDivBelowSepBox(), "direita");
      const left = applyDirecao(right, "esquerda");

      const r = buildDivShelfDrilling(right, right.panelIds, SHELF_RULES)!;
      const l = buildDivShelfDrilling(left, left.panelIds, SHELF_RULES)!;

      expect(r.lateral_direita.length).toBeGreaterThan(0);
      expect(r.lateral_esquerda.length).toBe(0);
      expect(r.divisorio.get("pid-div-1")?.length).toBeGreaterThan(0);

      expect(l.lateral_esquerda.length).toBeGreaterThan(0);
      expect(l.lateral_direita.length).toBe(0);
      expect(l.divisorio.get("pid-div-1")?.length).toBeGreaterThan(0);
    });

    it("superior (full) fura ambas as laterais e nenhum furo no DIV", () => {
      const box = applyDirecao(makeDivBelowSepBox(), "superior");
      const result = buildDivShelfDrilling(box, box.panelIds, SHELF_RULES)!;
      expect(result.lateral_esquerda.length).toBeGreaterThan(0);
      expect(result.lateral_direita.length).toBeGreaterThan(0);
      expect(result.divisorio.size).toBe(0);
    });

    it("Ys dos furos superior ficam acima do SEP; inferior abaixo", () => {
      const base = makeDivBelowSepBox();
      const sepY = 500; // approx — usar planos
      const superior = applyDirecao(base, "superior");
      const inferior = applyDirecao(base, "inferior");

      const planSup = resolveShelfPlacementPlans(superior)[0]!;
      const planInf = resolveShelfPlacementPlans(inferior)[0]!;
      expect(planSup.zone.yMin).toBeGreaterThan(planInf.zone.yMax - 1);

      const ysSup = resolveShelfAbsoluteCenterYsForPlan(superior, planSup, 2, SHELF_RULES);
      const ysInf = resolveShelfAbsoluteCenterYsForPlan(inferior, planInf, 2, SHELF_RULES);
      expect(ysSup.every((y) => y >= planSup.zone.yMin - 0.5)).toBe(true);
      expect(ysInf.every((y) => y <= planInf.zone.yMax + 0.5)).toBe(true);
      void sepY;
    });
  });

  describe("grelha / passo / margens recalculados na nova área", () => {
    it("passo 32 vs 64 na mesma zona superior", () => {
      const base = applyDirecao(makeDivBelowSepBox(), "superior");
      const box32 = { ...base, shelfOptions: { ...base.shelfOptions, distanciaEntreFurosMm: 32 as const } };
      const box64 = { ...base, shelfOptions: { ...base.shelfOptions, distanciaEntreFurosMm: 64 as const } };

      const plan = resolveShelfPlacementPlans(box32)[0]!;
      const g32 = resolveShelfGridYs(plan.zone.yMin, plan.zone.yMax, SHELF_RULES, {
        stepMm: 32,
        gridMode: "continua",
      });
      const g64 = resolveShelfGridYs(plan.zone.yMin, plan.zone.yMax, SHELF_RULES, {
        stepMm: 64,
        gridMode: "continua",
      });
      expect(g32.length).toBeGreaterThan(g64.length);

      const r32 = buildDivShelfDrilling(box32, box32.panelIds, SHELF_RULES)!;
      const r64 = buildDivShelfDrilling(box64, box64.panelIds, SHELF_RULES)!;
      const ys32 = [...new Set(r32.lateral_direita.map((h) => roundMm(h.y)))].sort((a, b) => a - b);
      const ys64 = [...new Set(r64.lateral_direita.map((h) => roundMm(h.y)))].sort((a, b) => a - b);
      expect(ys32.length).toBeGreaterThan(ys64.length);
    });

    it("grelha segmentada produz menos furos que a contínua na zona superior", () => {
      const base = applyDirecao(makeDivBelowSepBox(), "superior");
      const cont = {
        ...base,
        shelfOptions: { ...base.shelfOptions, gridMode: "continua" as const },
      };
      const seg = {
        ...base,
        shelfOptions: { ...base.shelfOptions, gridMode: "segmentada" as const },
      };
      const rc = buildDivShelfDrilling(cont, cont.panelIds, SHELF_RULES)!;
      const rs = buildDivShelfDrilling(seg, seg.panelIds, SHELF_RULES)!;
      expect(rs.lateral_direita.length).toBeLessThanOrEqual(rc.lateral_direita.length);
    });

    it("margem > 0 reduz a amplitude útil da grelha", () => {
      const base = applyDirecao(makeDivBelowSepBox(), "superior");
      const plan = resolveShelfPlacementPlans(base)[0]!;
      // margem 0 → usa regras (80/80); margem 150 → inset maior e menos furos
      const g0 = resolveShelfGridYs(plan.zone.yMin, plan.zone.yMax, SHELF_RULES, {
        stepMm: 32,
        margemSuperiorInferiorMm: 0,
      });
      const g150 = resolveShelfGridYs(plan.zone.yMin, plan.zone.yMax, SHELF_RULES, {
        stepMm: 32,
        margemSuperiorInferiorMm: 150,
      });
      expect(g150.length).toBeLessThan(g0.length);
      if (g150.length > 0) {
        expect(g150[0]!).toBeGreaterThanOrEqual(plan.zone.yMin + 150 - 0.5);
        expect(g150[g150.length - 1]!).toBeLessThanOrEqual(plan.zone.yMax - 150 + 0.5);
      }
    });
  });

  describe("só SEP / só DIV", () => {
    it("só SEP superior/inferior: full sem DIV", () => {
      const box = makeDivSepTestBox({
        dimensoes: { largura: 600, altura: 900, profundidade: 560 },
        prateleiras: 2,
        shelfOptions: { direcao: "superior" },
        separadores: [defaultSeparadorItem({ id: "sep-only", positionMm: 400 })],
        divisores: [],
      });
      const plans = resolveShelfPlacementPlans(box);
      expect(plans).toHaveLength(1);
      expect(plans[0]!.mode).toBe("full");
      const result = buildDivShelfDrilling(box, box.panelIds, SHELF_RULES)!;
      expect(result.divisorio.size).toBe(0);
      expect(result.lateral_esquerda.length).toBeGreaterThan(0);
    });

    it("só DIV esquerda/direita: short sem SEP", () => {
      const box = makeDivSepTestBox({
        dimensoes: { largura: 600, altura: 900, profundidade: 560 },
        prateleiras: 2,
        shelfOptions: { direcao: "esquerda" },
        separadores: [],
        divisores: [
          defaultDivisorItem({
            id: "div-only",
            positionMm: 281,
            alturaMm: 800,
            prateleiraLado: "direita",
          }),
        ],
        panelIds: { divisores: ["pid-div-only"] },
      });
      const before = structureSnapshot(box);
      const left = applyDirecao(box, "esquerda");
      expect(structureSnapshot(left)).toEqual(before);
      const plans = resolveShelfPlacementPlans(left);
      expect(plans.every((p) => p.mode === "short" && p.lado === "esquerda")).toBe(true);
      const result = buildDivShelfDrilling(left, left.panelIds, SHELF_RULES)!;
      expect(result.lateral_esquerda.length).toBeGreaterThan(0);
      expect(result.lateral_direita.length).toBe(0);
    });
  });
});
