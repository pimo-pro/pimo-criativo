/**
 * Testes do Unified Industrial Box Engine (orquestração A–D).
 * cutlistFromBoxes clássico permanece intacto.
 */

import { describe, expect, it } from "vitest";
import type { BoxModule } from "../types";
import { INDUSTRIAL_MODE_IDS } from "../industrialAdmin/industrialModelsRegistry";
import { INDUSTRIAL_FEATURES } from "./industrialFeatures";
import {
  resolveActiveFeaturesForBox,
  shouldSkipClassicDrawerCutlist,
  syncUnifiedIndustrialBox,
  runIndustrialCutlistAdapters,
} from "./UnifiedIndustrialBoxEngine";
import { CX_GAV_PRODUCT_MODE_ID } from "../cxGav/cxGavGeometry";
import { INNER_CABINET_A1_PRODUCT_MODE } from "../innerCabinet/a1Geometry";
import { WARDROBE_PARTIAL_SEP_PRODUCT_MODE } from "../wardrobe/partialSepToDiv";
import type { CutListItemComPreco } from "../types";

function baseBox(partial: Partial<BoxModule> & { baseCabinetId?: string }): BoxModule {
  return {
    id: "t-box",
    nome: "teste",
    dimensoes: { largura: 600, altura: 720, profundidade: 560 },
    espessura: 19,
    tipoBorda: "reta",
    tipoFundo: "integrado",
    models: [],
    portaTipo: "sem_porta",
    gavetas: 0,
    alturaGaveta: 0,
    prateleiras: 0,
    costaAtiva: true,
    doorsLayer: [],
    drawersLayer: [],
    divisores: [],
    separadores: [],
    cutList: [],
    cutListComPreco: [],
    ferragens: [],
    precoTotalPecas: 0,
    estrutura3D: null,
    ...partial,
  } as BoxModule;
}

describe("UnifiedIndustrialBoxEngine", () => {
  it("INDUSTRIAL_FEATURES tem exactamente 4 IDs (= A–D)", () => {
    expect(INDUSTRIAL_FEATURES).toHaveLength(4);
    expect(INDUSTRIAL_FEATURES.map((f) => f.phase).join("")).toBe("ABCD");
  });

  it("IDs do motor ≡ INDUSTRIAL_MODE_IDS (Fase E)", () => {
    expect([...INDUSTRIAL_FEATURES.map((f) => f.id)].sort()).toEqual(
      [...INDUSTRIAL_MODE_IDS].sort()
    );
  });

  it("sync B antes de C (syncOrder 10→20)", () => {
    const withSync = INDUSTRIAL_FEATURES.filter((f) => f.syncPatchIds.length > 0);
    expect(withSync.map((f) => f.phase)).toEqual(["B", "C"]);
  });

  it("adapters A→B→D ordem 10/20/30", () => {
    const withAdapters = INDUSTRIAL_FEATURES.filter((f) => f.adapterIds.length > 0);
    expect(withAdapters.map((f) => f.phase)).toEqual(["A", "B", "D"]);
  });

  it("caixa clássica: sync no-op; adapters não empurram peças", () => {
    const box = baseBox({ baseCabinetId: "classic_box" });
    const synced = syncUnifiedIndustrialBox(box);
    expect(synced).toEqual(box);
    expect(resolveActiveFeaturesForBox(box)).toHaveLength(0);

    const items: CutListItemComPreco[] = [];
    runIndustrialCutlistAdapters({
      syncedBox: synced,
      items,
      baseItem: {},
      bodyMaterialKey: "mdf",
      material: "mdf",
      visualMaterial: undefined,
      boxName: "t",
      priceRaw: (raw) => raw as CutListItemComPreco[],
      resolveMaterialId: (id, fb) => id || fb,
    });
    expect(items).toHaveLength(0);
  });

  it("cx_gav_cavita: emite 4 cx_gav_*", () => {
    const box = baseBox({
      baseCabinetId: `pipro_unified_box__${CX_GAV_PRODUCT_MODE_ID}`,
      gavetas: 1,
      alturaGaveta: 180,
    });
    expect(resolveActiveFeaturesForBox(box).map((f) => f.id)).toContain(CX_GAV_PRODUCT_MODE_ID);

    const items: CutListItemComPreco[] = [];
    runIndustrialCutlistAdapters({
      syncedBox: syncUnifiedIndustrialBox(box),
      items,
      baseItem: {},
      bodyMaterialKey: "mdf",
      material: "mdf",
      visualMaterial: undefined,
      boxName: "t",
      priceRaw: (raw) =>
        raw.map((r) => ({ ...r, preco: 0 })) as CutListItemComPreco[],
      resolveMaterialId: (id, fb) => id || fb,
    });
    const cx = items.filter((i) => String(i.tipo).startsWith("cx_gav_"));
    expect(cx.length).toBeGreaterThanOrEqual(4);
  });

  it("inner_cabinet_a1: shouldSkipClassicDrawerCutlist === true", () => {
    const box = baseBox({
      baseCabinetId: `x__${INNER_CABINET_A1_PRODUCT_MODE}`,
      gavetas: 2,
      alturaGaveta: 400,
    });
    expect(shouldSkipClassicDrawerCutlist(box)).toBe(true);
  });

  it("coexistência C+D: 2 features activas", () => {
    const box = baseBox({
      baseCabinetId: `pipro_unified_box__${WARDROBE_PARTIAL_SEP_PRODUCT_MODE}__${INNER_CABINET_A1_PRODUCT_MODE}`,
      gavetas: 2,
      alturaGaveta: 400,
      separadores: [
        {
          id: "sep1",
          orientation: "horizontal",
          partial: true,
          posMm: 400,
        } as never,
      ],
    });
    const ids = resolveActiveFeaturesForBox(box).map((f) => f.id);
    expect(ids).toContain(WARDROBE_PARTIAL_SEP_PRODUCT_MODE);
    expect(ids).toContain(INNER_CABINET_A1_PRODUCT_MODE);
    expect(ids.length).toBeGreaterThanOrEqual(2);
  });
});
