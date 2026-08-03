/**
 * Costa/frente de gaveta NUNCA recebem ?5 / corrediça.
 * Laterais gaveta_lat_* ? SSOT cx gav lat: grelha ?5 activa.
 * Corrediças de módulo = laterais do módulo (inalterado).
 */
import { describe, expect, it } from "vitest";
import { calculateTechnicalDrillingsForPiece } from "../../drilling/drillingService";
import { buildPanelDrillingResult } from "../../../modules/drilling/drillingAdapter";
import { defaultRulesConfig } from "../../rules/rulesConfig";
import {
  computeDrawerPieceCorredicaHoles,
  getDrawerSlideDrillingRules,
} from "./DrawerDrillingRules";
import { cutlistToPieces } from "../../cutlayout/cutLayoutEngine";
import type { CutListItemComPreco } from "../../types";

const NO_GUIDE_TYPES = ["gaveta_traseira", "gaveta_frente", "gaveta_frente_int"] as const;
const LAT_TYPES = ["gaveta_lat_esq", "gaveta_lat_dir"] as const;
const DIM = { L: 500, H: 150, T: 16 };

function assertNoFiveMm(
  holes: Array<{ diameter?: number; diametro?: number; holeType?: string; tipo?: string }>
) {
  for (const h of holes) {
    const d = h.diameter ?? h.diametro;
    expect(d).not.toBe(5);
    expect(h.holeType ?? h.tipo).not.toBe("corredica");
  }
}

describe("gaveta ? ?5 apenas em gaveta_lat_* (SSOT cx gav lat)", () => {
  it("computeDrawerPieceCorredicaHoles permanece no-op (guias v?m do estrutural)", () => {
    const rules = getDrawerSlideDrillingRules("Hettich ArciTech", "Nenhuma", {
      mode: "drawer_piece",
      panelDepthMm: DIM.L,
    });
    for (const tipo of [...LAT_TYPES, ...NO_GUIDE_TYPES]) {
      expect(
        computeDrawerPieceCorredicaHoles({
          pieceType: tipo,
          largura: DIM.L,
          altura: DIM.H,
          rules,
        })
      ).toEqual([]);
    }
  });

  it.each(NO_GUIDE_TYPES)("%s ? sem ?5", (tipo) => {
    const holes = calculateTechnicalDrillingsForPiece(
      { tipo, largura: DIM.L, altura: DIM.H, espessura: DIM.T },
      defaultRulesConfig
    );
    assertNoFiveMm(holes);
  });

  it.each(LAT_TYPES)("%s ? grelha ?5 activa (15) + 4 cavilhas", (tipo) => {
    const holes = calculateTechnicalDrillingsForPiece(
      { tipo, largura: DIM.L, altura: DIM.H, espessura: DIM.T },
      defaultRulesConfig
    );
    expect(holes.filter((h) => h.tipo === "corredica" || h.diametro === 5)).toHaveLength(15);
    expect(holes.filter((h) => h.tipo === "cavilha")).toHaveLength(4);
    expect(holes.filter((h) => h.holeSubtype === "groove")).toHaveLength(0);
  });

  it.each(LAT_TYPES)("%s ? adapter cutlist com ?5", (tipo) => {
    const result = buildPanelDrillingResult(
      { tipo, larguraMm: DIM.L, alturaMm: DIM.H, espessuraMm: DIM.T },
      defaultRulesConfig
    );
    expect(result.success).toBe(true);
    expect(result.data!.drillHoles.filter((h) => h.diameter === 5)).toHaveLength(15);
  });

  it("lat_esq ? nesting transversal com ?5", () => {
    const result = buildPanelDrillingResult(
      { tipo: "gaveta_lat_esq", larguraMm: DIM.L, alturaMm: DIM.H, espessuraMm: DIM.T },
      defaultRulesConfig
    );
    const item: CutListItemComPreco = {
      id: "lat",
      nome: "lat",
      tipo: "gaveta_lat_esq",
      quantidade: 1,
      dimensoes: { largura: DIM.L, altura: DIM.H, profundidade: DIM.T },
      espessura: DIM.T,
      material: "MDF",
      materialId: "mdf",
      drillHoles: result.data!.drillHoles,
      precoUnitario: 0,
      precoTotal: 0,
    };
    const pieces = cutlistToPieces([item]);
    expect(pieces[0]!.largura_mm).toBe(DIM.H);
    expect(pieces[0]!.altura_mm).toBe(DIM.L);
    expect((pieces[0]!.drillHoles ?? []).filter((h) => h.diameter === 5).length).toBe(15);
  });
});
