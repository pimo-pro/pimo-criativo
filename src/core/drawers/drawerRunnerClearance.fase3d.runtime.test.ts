/**
 * Fase 3D — evidência: gavetaRecuoProfundidadeCorredicaMm (legado UI, default 20)
 * vs SSOT industrial sideDepth = bodyDepth − 10 (DRAWER_SIDE_DEPTH_SLIDE_CLEARANCE_MM).
 * Quadro V6 / X1=38 / corredica_marca não dependem do setting de 20 mm.
 */
import { describe, expect, it } from "vitest";

import { calculateDrawerSpecs } from "@/core/drawers/DrawerParametrics";
import { generateDrawerGroup } from "@/core/drawers/DrawerGenerationService";
import {
  DRAWER_SIDE_DEPTH_SLIDE_CLEARANCE_MM,
  resolveDrawerSideDepthMm,
} from "@/core/drawers/drawerSlideDepth";
import { settingsDefaults } from "@/core/settings/settingsSchema";
import {
  MODULE_SLIDE_EDGE_SETBACK_MM,
  MODULE_SLIDE_MARK_DEPTH_MM,
  QUADRO_V6_YOU_M_FRONT_X_MM,
  HETTICH_QUADRO_V6_YOU_M_SILENT_SYSTEM,
  resolveSlideDrillingPattern,
} from "@/core/drawers/drilling/drawerSlideDrillingCatalog";

describe("Fase 3D — runner clearance legado vs SSOT industrial", () => {
  const baseDims = {
    boxInternalWidth: 562,
    boxExternalWidth: 600,
    boxInternalHeight: 720,
    boxInternalDepth: 560,
    boxThickness: 19,
    drawerHeight: 200,
    totalDrawers: 3,
    type: "normal" as const,
  };

  it("SSOT: sideDepth = bodyDepth − 10; setting legado default 20", () => {
    expect(DRAWER_SIDE_DEPTH_SLIDE_CLEARANCE_MM).toBe(10);
    expect(settingsDefaults.gavetas.gavetaRecuoProfundidadeCorredicaMm).toBe(20);
    expect(resolveDrawerSideDepthMm(550)).toBe(540);
  });

  it("calculateDrawerSpecs: clearance 5 vs 25 (boxInternalDepth fixo) — body.depth igual", () => {
    const with25 = calculateDrawerSpecs(
      baseDims,
      settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm,
      { ...settingsDefaults.gavetas, gavetaRecuoProfundidadeCorredicaMm: 25 },
    );
    const with5 = calculateDrawerSpecs(
      baseDims,
      settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm,
      { ...settingsDefaults.gavetas, gavetaRecuoProfundidadeCorredicaMm: 5 },
    );

    expect(with25.runnerClearanceMm).toBe(25);
    expect(with5.runnerClearanceMm).toBe(5);
    expect(with25.body.depth).toBe(with5.body.depth);
    expect(with25.nominalDepthMm).toBe(with5.nominalDepthMm);
    expect(with25.body.depth).toBe(with25.nominalDepthMm);
    expect(resolveDrawerSideDepthMm(with25.body.depth)).toBe(with25.body.depth - 10);
  });

  it("normalizePositiveNumber: clearance 0 cai no default 20 (não dá para desligar via settings)", () => {
    const specs = calculateDrawerSpecs(
      baseDims,
      settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm,
      { ...settingsDefaults.gavetas, gavetaRecuoProfundidadeCorredicaMm: 0 },
    );
    expect(specs.runnerClearanceMm).toBe(20);
  });

  it("generateDrawerGroup: clearance 20 vs 0 altera slide na fronteira (boxDepth 590)", () => {
    // util ≈ 590−10−19=561 → c0:561→550; c20:541→500
    const common = {
      drawerCount: 2,
      boxWidth: 600,
      boxHeight: 720,
      boxDepth: 590,
      boxThickness: 19,
      heightMode: "equal" as const,
      availableDepths: settingsDefaults.gavetas.gavetaProfundidadesDisponiveisMm,
      costaAtiva: true,
      espessuraCostaMm: 10,
    };

    const g20 = generateDrawerGroup({
      ...common,
      drawerSettings: {
        ...settingsDefaults.gavetas,
        gavetaRecuoProfundidadeCorredicaMm: 20,
      },
    });
    const g0 = generateDrawerGroup({
      ...common,
      drawerSettings: {
        ...settingsDefaults.gavetas,
        gavetaRecuoProfundidadeCorredicaMm: 0,
      },
    });

    const depth20 = g20.drawers[0]?.specs.nominalDepthMm;
    const depth0 = g0.drawers[0]?.specs.nominalDepthMm;
    expect(depth20).toBe(500);
    expect(depth0).toBe(550);
    expect(depth20).not.toBe(depth0);
  });

  it("Quadro V6 / X1=38 / corredica_marca: independente do clearance 20", () => {
    expect(MODULE_SLIDE_EDGE_SETBACK_MM).toBe(38);
    expect(QUADRO_V6_YOU_M_FRONT_X_MM).toBe(38);
    expect(MODULE_SLIDE_MARK_DEPTH_MM).toBe(1);

    const pattern = resolveSlideDrillingPattern({
      slideType: HETTICH_QUADRO_V6_YOU_M_SILENT_SYSTEM,
      panelDepthMm: 550,
      preferredLengthMm: 550,
    });
    expect(pattern.holes[0]?.xFromFrontMm).toBe(38);
    expect(pattern.holes.every((h) => h.isMarkOnly === true)).toBe(true);
    expect(pattern.profundidadeMarkMm).toBe(1);
    // Não há dependência do setting gavetaRecuoProfundidadeCorredicaMm (20)
    expect(pattern.source).toMatch(/Quadro V6/i);
  });
});
